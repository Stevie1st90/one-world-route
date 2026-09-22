import {cp,mkdir,mkdtemp,readFile,rm,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

export const DEFAULT_LOCALES=['en','de','it','es','fr','pt'];
export const SLUG_RE=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ALLOWED_MODES=new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);

const json=v=>JSON.stringify(v,null,2)+'\n';
const localize=(value,locales=DEFAULT_LOCALES)=>Object.fromEntries(locales.map(locale=>[locale,value]));

export function deriveMetrics(trip={}){
  const places=Array.isArray(trip.places)?trip.places:[];
  const stops=Array.isArray(trip.stops)?trip.stops:[];
  const segments=Array.isArray(trip.segments)?trip.segments:[];
  return {
    days:Number.isFinite(Number(trip.planning?.days))?Number(trip.planning.days):null,
    countries:new Set(places.map(place=>place.countryCode).filter(Boolean)).size,
    stops:stops.length,
    segments:segments.length,
    sourcedSegments:segments.filter(segment=>(segment.verification?.sourceIds||[]).length>0).length,
    verifiedSegments:segments.filter(segment=>segment.verification?.status==='verified').length
  };
}

export function createDraftPayload({slug,kind='custom',days=null,title=null,locales=DEFAULT_LOCALES}={}){
  if(!SLUG_RE.test(String(slug||'')))throw new Error('Slug must use lowercase letters, numbers and hyphens only.');
  if(!SLUG_RE.test(String(kind||'')))throw new Error('Kind must be a normalized slug.');
  const normalizedDays=days==null||days===''?null:Number(days);
  if(normalizedDays!==null&&(!Number.isInteger(normalizedDays)||normalizedDays<1))throw new Error('Days must be a positive integer.');
  const human=String(title||slug.split('-').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ')).trim();
  const trip={
    schemaVersion:1,id:slug,slug,kind,status:'draft',defaultLocale:'en',supportedLocales:[...locales],
    title:localize(human,locales),summary:localize('TODO — editorial summary',locales),
    geography:{regions:[],countries:[],primaryCountry:null},
    planning:{days:normalizedDays,currency:'EUR',pace:'balanced',distanceKm:null},
    rendering:{preferred:'standard-globe',terrainOptional:true},
    places:[],stops:[],segments:[],chapters:[],travellerContext:{scope:[]},sources:[],extensions:{}
  };
  const catalogEntry={
    id:slug,slug,kind,status:'draft',renderer:'regional-globe',dataset:`./data/platform/trips/${slug}.json`,
    title:localize(human,locales),subtitle:localize('TODO — public discovery subtitle',locales),
    metrics:deriveMetrics(trip),
    capabilities:['globe','story','terrain'],
    discovery:{regions:[],themes:[],modes:[],durationBand:durationBand(normalizedDays),featured:false,
      fit:{pace:'balanced',seasons:['multi-season'],party:['solo','couples'],startRegion:'',accessibility:'standard-check'}}
  };
  return {trip,catalogEntry};
}

export function normalizeCandidate(candidate){
  const trip=structuredClone(candidate?.trip||{});
  const catalogEntry=structuredClone(candidate?.catalogEntry||{});
  const metrics=deriveMetrics(trip);
  catalogEntry.metrics={...(catalogEntry.metrics||{}),...metrics};
  catalogEntry.id=trip.id;
  catalogEntry.slug=trip.slug;
  catalogEntry.kind=trip.kind;
  catalogEntry.status=trip.status;
  catalogEntry.dataset=`./data/platform/trips/${trip.slug}.json`;
  catalogEntry.renderer='regional-globe';
  catalogEntry.discovery=catalogEntry.discovery||{};
  catalogEntry.discovery.durationBand=durationBand(metrics.days);
  trip.geography=trip.geography||{};
  trip.geography.countries=[...new Set((trip.places||[]).map(place=>place.countryCode).filter(Boolean))];
  return {trip,catalogEntry};
}

export function validateDraftCandidate(candidate,catalog={}){
  const {trip,catalogEntry}=normalizeCandidate(candidate);
  const errors=[],warnings=[];
  const fail=m=>errors.push(m);
  const warn=m=>warnings.push(m);
  const locales=Array.isArray(catalog.supportedLocales)&&catalog.supportedLocales.length?catalog.supportedLocales:DEFAULT_LOCALES;

  if(trip.schemaVersion!==1)fail('trip.schemaVersion must equal 1');
  if(!SLUG_RE.test(String(trip.id||'')))fail('trip.id must be a normalized slug');
  if(trip.id!==trip.slug)fail('trip.id and trip.slug must match');
  if(!SLUG_RE.test(String(trip.kind||'')))fail('trip.kind must be a normalized slug');
  if(catalogEntry.id!==trip.id||catalogEntry.slug!==trip.slug)fail('catalog identity must match trip identity');
  if(catalogEntry.renderer!=='regional-globe')fail('builder publishes only the shared regional-globe renderer');
  if(catalogEntry.status==='draft'||trip.status==='draft')warn('Trip is still marked draft; change status before publishing.');

  for(const locale of locales){
    if(!String(trip.title?.[locale]||'').trim())fail(`missing trip title for ${locale}`);
    if(!String(catalogEntry.title?.[locale]||'').trim())fail(`missing catalog title for ${locale}`);
    if(!String(catalogEntry.subtitle?.[locale]||'').trim())fail(`missing catalog subtitle for ${locale}`);
  }

  const sourceIds=new Set();
  for(const source of trip.sources||[]){
    if(!source.id||sourceIds.has(source.id))fail('source IDs must be unique: '+source.id); else sourceIds.add(source.id);
    if(!/^https:\/\//.test(String(source.url||'')))fail('source '+source.id+' requires an https URL');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(source.checkedAt||'')))fail('source '+source.id+' requires checkedAt YYYY-MM-DD');
  }

  const placeIds=new Set();
  for(const place of trip.places||[]){
    if(!place.id||placeIds.has(place.id))fail('place IDs must be unique: '+place.id); else placeIds.add(place.id);
    if(!Number.isFinite(Number(place.coordinates?.lat))||!Number.isFinite(Number(place.coordinates?.lng)))fail('place '+place.id+' requires numeric coordinates');
    if(!String(place.countryCode||'').trim())warn('place '+place.id+' has no countryCode');
    if(!String(place.name?.en||'').trim())fail('place '+place.id+' requires name.en');
  }

  const stops=[...(trip.stops||[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  const stopIds=new Set();
  for(let i=0;i<stops.length;i++){
    const stop=stops[i];
    if(!stop.id||stopIds.has(stop.id))fail('stop IDs must be unique: '+stop.id); else stopIds.add(stop.id);
    if(Number(stop.sequence)!==i+1)fail('stop sequences must be contiguous starting at 1');
    if(!placeIds.has(stop.placeId))fail('stop '+stop.id+' references missing place '+stop.placeId);
  }

  const segments=[...(trip.segments||[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  if(segments.length!==Math.max(0,stops.length-1))fail('segments must connect every adjacent stop');
  const segmentIds=new Set();
  for(let i=0;i<segments.length;i++){
    const segment=segments[i];
    if(!segment.id||segmentIds.has(segment.id))fail('segment IDs must be unique: '+segment.id); else segmentIds.add(segment.id);
    if(Number(segment.sequence)!==i+1)fail('segment sequences must be contiguous starting at 1');
    if(segment.fromStopId!==stops[i]?.id||segment.toStopId!==stops[i+1]?.id)fail('segment '+segment.id+' must connect adjacent ordered stops');
    if(!ALLOWED_MODES.has(segment.transport?.mode))fail('segment '+segment.id+' uses unsupported mode '+segment.transport?.mode);
    const status=segment.verification?.status;
    if(!['current-check-required','verified','draft','illustrative'].includes(status))fail('segment '+segment.id+' has invalid verification status');
    for(const sourceId of segment.verification?.sourceIds||[])if(!sourceIds.has(sourceId))fail('segment '+segment.id+' references missing source '+sourceId);
    if(status==='verified'&&!(segment.verification?.sourceIds||[]).length)fail('verified segment '+segment.id+' requires sourceIds');
  }

  const chapterIds=new Set();
  let previousChapterStop=-1;
  const orderedStopIndex=new Map(stops.map((stop,index)=>[stop.id,index]));
  for(const chapter of trip.chapters||[]){
    if(!chapter.id||chapterIds.has(chapter.id))fail('chapter IDs must be unique: '+chapter.id); else chapterIds.add(chapter.id);
    if(!String(chapter.title?.en||'').trim())fail('chapter '+chapter.id+' requires title.en');
    if(!(chapter.stopIds||[]).length)fail('chapter '+chapter.id+' requires at least one stopId');
    for(const stopId of chapter.stopIds||[]){
      if(!stopIds.has(stopId))fail('chapter '+chapter.id+' references missing stop '+stopId);
      const index=orderedStopIndex.get(stopId);
      if(Number.isInteger(index)&&index<previousChapterStop)warn('chapter '+chapter.id+' references a stop before the previous chapter boundary');
      if(Number.isInteger(index))previousChapterStop=Math.max(previousChapterStop,index);
    }
  }

  const discovery=catalogEntry.discovery||{};
  if(!(discovery.regions||[]).length)fail('catalog discovery.regions requires at least one value');
  if(!(discovery.themes||[]).length)fail('catalog discovery.themes requires at least one value');
  if(!(discovery.modes||[]).length)fail('catalog discovery.modes requires at least one value');
  if(!['7-14','15-30','31-89','90-plus'].includes(discovery.durationBand))fail('catalog discovery.durationBand is invalid');
  const fit=discovery.fit||{};
  if(!['relaxed','balanced','active'].includes(fit.pace))fail('catalog discovery.fit.pace is invalid');
  if(!(fit.seasons||[]).length)fail('catalog discovery.fit.seasons requires at least one value');
  if(!(fit.party||[]).length)fail('catalog discovery.fit.party requires at least one value');
  if(!String(fit.startRegion||'').trim())fail('catalog discovery.fit.startRegion is required');
  if(!['standard-check','operator-dependent','vehicle-dependent','complex-planning'].includes(fit.accessibility))fail('catalog discovery.fit.accessibility is invalid');

  const metrics=deriveMetrics(trip);
  return {ok:errors.length===0,errors,warnings,metrics,candidate:{trip,catalogEntry}};
}

export function durationBand(days){
  const n=Number(days);
  if(!Number.isFinite(n)||n<1)return '7-14';
  if(n<=14)return '7-14';
  if(n<=30)return '15-30';
  if(n<=89)return '31-89';
  return '90-plus';
}

export async function loadCatalog(publicRoot){
  return JSON.parse(await readFile(join(publicRoot,'data/platform/trips.json'),'utf8'));
}

export async function listDrafts(workspace){
  await mkdir(workspace,{recursive:true});
  const {readdir}=await import('node:fs/promises');
  const entries=await readdir(workspace,{withFileTypes:true});
  const drafts=[];
  for(const entry of entries.filter(item=>item.isDirectory())){
    try{
      const data=await loadDraft(workspace,entry.name);
      drafts.push({slug:entry.name,title:data.trip?.title?.en||entry.name,kind:data.trip?.kind||'custom',status:data.trip?.status||'draft',metrics:deriveMetrics(data.trip)});
    }catch{}
  }
  return drafts.sort((a,b)=>a.title.localeCompare(b.title));
}

export async function loadDraft(workspace,slug){
  if(!SLUG_RE.test(String(slug||'')))throw new Error('Invalid draft slug.');
  const dir=join(workspace,slug);
  const [trip,catalogEntry]=await Promise.all([
    readFile(join(dir,'trip.json'),'utf8').then(JSON.parse),
    readFile(join(dir,'catalog.json'),'utf8').then(JSON.parse)
  ]);
  return {trip,catalogEntry};
}

export async function saveDraft(workspace,slug,candidate){
  if(!SLUG_RE.test(String(slug||'')))throw new Error('Invalid draft slug.');
  const normalized=normalizeCandidate(candidate);
  if(normalized.trip.slug!==slug)throw new Error('Draft slug cannot be changed in place.');
  const dir=join(workspace,slug);
  await mkdir(dir,{recursive:true});
  await Promise.all([
    writeFile(join(dir,'trip.json'),json(normalized.trip)),
    writeFile(join(dir,'catalog.json'),json(normalized.catalogEntry))
  ]);
  return normalized;
}

export async function createDraft(workspace,options){
  const candidate=createDraftPayload(options);
  const dir=join(workspace,candidate.trip.slug);
  try{await access(dir);throw new Error('Draft already exists: '+candidate.trip.slug)}catch(error){if(error.code!=='ENOENT')throw error;}
  return saveDraft(workspace,candidate.trip.slug,candidate);
}

function injectCandidate(publicRoot,candidate,catalog){
  return (async()=>{
    const {trip,catalogEntry}=normalizeCandidate(candidate);
    const nextCatalog=structuredClone(catalog);
    if((nextCatalog.trips||[]).some(item=>item.id===trip.id||item.slug===trip.slug))throw new Error('Public catalog already contains '+trip.slug);
    nextCatalog.trips.push(catalogEntry);
    await mkdir(join(publicRoot,'data/platform/trips'),{recursive:true});
    await writeFile(join(publicRoot,`data/platform/trips/${trip.slug}.json`),json(trip));
    await writeFile(join(publicRoot,'data/platform/trips.json'),json(nextCatalog));
    return nextCatalog;
  })();
}

export async function runPublishGate({repoRoot,publicRoot,workspace,slug}){
  const [candidate,catalog]=await Promise.all([loadDraft(workspace,slug),loadCatalog(publicRoot)]);
  const local=validateDraftCandidate(candidate,catalog);
  if(!local.ok)return {ok:false,stage:'draft-validation',...local};
  if(local.warnings.some(w=>/still marked draft/.test(w)))return {ok:false,stage:'draft-status',errors:['Trip and catalog status must be changed from draft before publishing.'],warnings:local.warnings,metrics:local.metrics};

  const sandbox=await mkdtemp(join(tmpdir(),'owr-trip-gate-'));
  const sandboxPublic=join(sandbox,'one-world-route-public-mvp');
  try{
    await cp(publicRoot,sandboxPublic,{recursive:true,filter:src=>!/(?:^|[\\/])(?:node_modules|test-results|playwright-report|qa-artifacts-)(?:[\\/]|$)/.test(src)});
    const sandboxCatalog=await loadCatalog(sandboxPublic);
    await injectCandidate(sandboxPublic,candidate,sandboxCatalog);
    const commands=[
      ['node',['scripts/validate-platform-data.mjs']],
      ['node',['--test','scripts/test-platform-model.mjs']],
      ['node',['--test','scripts/test-platform-navigation.mjs']],
      ['node',['--test','scripts/test-platform-i18n.mjs']]
    ];
    const checks=[];
    for(const [command,args] of commands){
      const result=spawnSync(command,args,{cwd:sandboxPublic,encoding:'utf8'});
      checks.push({command:[command,...args].join(' '),ok:result.status===0,output:(result.stdout||'')+(result.stderr||'')});
      if(result.status!==0)return {ok:false,stage:'platform-gate',errors:['Platform gate failed: '+[command,...args].join(' ')],warnings:local.warnings,metrics:local.metrics,checks};
    }
    return {ok:true,stage:'complete',errors:[],warnings:local.warnings,metrics:local.metrics,checks};
  }finally{
    await rm(sandbox,{recursive:true,force:true});
  }
}

export async function publishDraft({repoRoot,publicRoot,workspace,slug}){
  const gate=await runPublishGate({repoRoot,publicRoot,workspace,slug});
  if(!gate.ok)return gate;
  const [candidate,catalog]=await Promise.all([loadDraft(workspace,slug),loadCatalog(publicRoot)]);
  await injectCandidate(publicRoot,candidate,catalog);
  return {...gate,published:true,tripPath:`data/platform/trips/${slug}.json`,catalogPath:'data/platform/trips.json'};
}
