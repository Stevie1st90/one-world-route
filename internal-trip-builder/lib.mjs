import {validatePlatformExtensions} from '../one-world-route-public-mvp/scripts/platform-extension-validators.mjs';

export const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const allowedModes=new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);
export const verificationStatuses=new Set(['current-check-required','verified','draft','illustrative']);
export const durationBands=new Set(['7-14','15-30','31-89','90-plus']);
export const paces=new Set(['relaxed','balanced','active']);
export const seasons=new Set(['spring','summer','autumn','winter','multi-season']);
export const parties=new Set(['solo','couples','friends','families']);
export const accessibilityValues=new Set(['standard-check','operator-dependent','vehicle-dependent','complex-planning']);

export function durationBand(days){
  const n=Number(days);
  if(!Number.isFinite(n)||n<1)return '7-14';
  return n<=14?'7-14':n<=30?'15-30':n<=89?'31-89':'90-plus';
}

export function localized(locales,value=''){
  return Object.fromEntries((locales||['en']).map(locale=>[locale,String(value)]));
}

export function createDraft(catalog,input={}){
  const locales=catalog.supportedLocales||['en'];
  const slug=String(input.slug||'').trim();
  const kind=String(input.kind||'custom').trim();
  const days=input.days==null?null:Number(input.days);
  const title=String(input.title||slug.split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ')).trim();
  const trip={
    schemaVersion:1,id:slug,slug,kind,status:'draft',
    defaultLocale:catalog.defaultLocale||'en',supportedLocales:[...locales],
    title:localized(locales,title),summary:localized(locales,''),
    geography:{regions:[],countries:[]},
    planning:{days:Number.isFinite(days)?days:null,currency:'EUR'},
    rendering:{preferred:'standard-globe',terrainOptional:true},
    places:[],stops:[],segments:[],chapters:[],
    travellerContext:{scope:[]},sources:[],extensions:{}
  };
  const catalogEntry={
    id:slug,slug,kind,status:'draft',renderer:'regional-globe',
    dataset:`./data/platform/trips/${slug}.json`,
    title:localized(locales,title),subtitle:localized(locales,''),
    metrics:{days:Number.isFinite(days)?days:null,stops:0,segments:0,countries:0,sourcedSegments:0,verifiedSegments:0,budget:null},
    capabilities:['globe','regional-stops','traveller-context','story','terrain'],
    discovery:{
      regions:[],themes:[],modes:[],durationBand:durationBand(days),
      featured:false,
      fit:{pace:'balanced',seasons:['multi-season'],party:['solo','couples','friends','families'],startRegion:'',accessibility:'standard-check'}
    }
  };
  return {trip,catalogEntry};
}

export function computeMetrics(trip){
  const places=trip.places||[],segments=trip.segments||[],stops=trip.stops||[];
  return {
    days:trip.planning?.days??null,
    stops:stops.length,
    segments:segments.length,
    countries:new Set(places.map(p=>p.countryCode).filter(Boolean)).size,
    sourcedSegments:segments.filter(s=>(s.verification?.sourceIds||[]).length>0).length,
    verifiedSegments:segments.filter(s=>s.verification?.status==='verified').length,
    budget:null
  };
}

export function normalizeCatalogEntry(item,trip,catalog){
  const next=structuredClone(item||{});
  next.id=trip.id;
  next.slug=trip.slug;
  next.kind=trip.kind;
  next.renderer='regional-globe';
  next.dataset=`./data/platform/trips/${trip.slug}.json`;
  next.title=structuredClone(trip.title||{});
  next.metrics={...computeMetrics(trip),...(next.metrics?.nights!=null?{nights:next.metrics.nights}:{}),...(next.metrics?.seaDays!=null?{seaDays:next.metrics.seaDays}:{})};
  const supported=catalog.supportedLocales||trip.supportedLocales||['en'];
  next.subtitle=next.subtitle||localized(supported,'');
  next.capabilities=Array.from(new Set(next.capabilities||['globe','regional-stops','story','terrain']));
  if(!next.capabilities.includes('globe'))next.capabilities.unshift('globe');
  next.discovery=next.discovery||{};
  next.discovery.durationBand=durationBand(trip.planning?.days);
  return next;
}

function hasTodo(value){
  if(typeof value==='string')return /\bTODO\b/i.test(value);
  if(Array.isArray(value))return value.some(hasTodo);
  if(value&&typeof value==='object')return Object.values(value).some(hasTodo);
  return false;
}

export function validateDraft({catalog,item,trip}){
  const errors=[],warnings=[];
  const fail=m=>errors.push(m);
  const warn=m=>warnings.push(m);
  const supportedLocales=Array.isArray(catalog.supportedLocales)?catalog.supportedLocales:[];
  const prefix=trip?.id||item?.id||'draft';
  if(!trip||typeof trip!=='object')return {ok:false,errors:['Draft trip payload missing'],warnings,metrics:null};
  if(!item||typeof item!=='object')return {ok:false,errors:['Draft catalog entry missing'],warnings,metrics:null};
  if(!slugPattern.test(String(trip.id||'')))fail(prefix+': id must be a normalized slug');
  if(trip.slug!==trip.id)fail(prefix+': trip slug must equal id');
  if(item.id!==trip.id||item.slug!==trip.slug)fail(prefix+': catalog/dataset identity mismatch');
  if(!slugPattern.test(String(trip.kind||'')))fail(prefix+': kind must be a normalized slug');
  if(item.kind!==trip.kind)fail(prefix+': catalog kind must match trip kind');
  if(item.status!==trip.status)fail(prefix+': catalog status must match trip status');
  if(!String(trip.status||'').trim()||trip.status==='draft')fail(prefix+': choose a publishable status before publishing');
  if(item.renderer!=='regional-globe')fail(prefix+': internal builder publishes only regional-globe trips');
  if(!Array.isArray(item.capabilities)||!item.capabilities.includes('globe'))fail(prefix+': globe capability required');
  if(hasTodo(trip)||hasTodo(item))fail(prefix+': TODO placeholders must be resolved before publishing');

  for(const locale of supportedLocales){
    if(!String(trip.title?.[locale]||'').trim())fail(prefix+': missing trip title for '+locale);
    if(!String(trip.summary?.[locale]||'').trim())fail(prefix+': missing trip summary for '+locale);
    if(!String(item.title?.[locale]||'').trim())fail(prefix+': missing catalog title for '+locale);
    if(!String(item.subtitle?.[locale]||'').trim())fail(prefix+': missing catalog subtitle for '+locale);
  }

  const discovery=item.discovery||{};
  if(!Array.isArray(discovery.regions)||!discovery.regions.length)fail(prefix+': discovery.regions required');
  if(!Array.isArray(discovery.themes)||!discovery.themes.length)fail(prefix+': discovery.themes required');
  if(!Array.isArray(discovery.modes)||!discovery.modes.length)fail(prefix+': discovery.modes required');
  if(!durationBands.has(discovery.durationBand))fail(prefix+': invalid discovery.durationBand');
  const fit=discovery.fit||{};
  if(!paces.has(fit.pace))fail(prefix+': invalid discovery.fit.pace');
  if(!Array.isArray(fit.seasons)||!fit.seasons.length||fit.seasons.some(v=>!seasons.has(v)))fail(prefix+': invalid discovery.fit.seasons');
  if(!Array.isArray(fit.party)||!fit.party.length||fit.party.some(v=>!parties.has(v)))fail(prefix+': invalid discovery.fit.party');
  if(!String(fit.startRegion||'').trim())fail(prefix+': discovery.fit.startRegion required');
  if(!accessibilityValues.has(fit.accessibility))fail(prefix+': invalid discovery.fit.accessibility');

  const sourceIds=new Set();
  for(const src of trip.sources||[]){
    if(!src.id||sourceIds.has(src.id))fail(prefix+': duplicate or missing source '+String(src.id||'')); else sourceIds.add(src.id);
    if(!/^https:\/\//.test(String(src.url||'')))fail(prefix+': source '+src.id+' requires https URL');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(src.checkedAt||'')))fail(prefix+': source '+src.id+' requires checkedAt date');
    if(!String(src.issuerType||'').trim())fail(prefix+': source '+src.id+' requires issuerType');
  }

  const placeIds=new Set(),placeById=new Map();
  for(const place of trip.places||[]){
    if(!place.id||placeIds.has(place.id))fail(prefix+': duplicate or missing place '+String(place.id||'')); else placeIds.add(place.id);
    placeById.set(place.id,place);
    if(!String(place.countryCode||'').trim())fail(prefix+': place '+place.id+' requires countryCode');
    if(!Number.isFinite(place.coordinates?.lat)||!Number.isFinite(place.coordinates?.lng))fail(prefix+': place '+place.id+' requires numeric coordinates');
    for(const locale of supportedLocales)if(!String(place.name?.[locale]||'').trim())warn(prefix+': place '+place.id+' missing localized name for '+locale);
  }

  const orderedStops=[...(trip.stops||[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  const stopIds=new Set(),stopById=new Map();
  orderedStops.forEach((stop,index)=>{
    if(!stop.id||stopIds.has(stop.id))fail(prefix+': duplicate or missing stop '+String(stop.id||'')); else stopIds.add(stop.id);
    stopById.set(stop.id,stop);
    if(!placeIds.has(stop.placeId))fail(prefix+': stop '+stop.id+' references missing place '+stop.placeId);
    if(Number(stop.sequence)!==index+1)warn(prefix+': stop '+stop.id+' sequence is not contiguous from 1');
  });

  const segs=[...(trip.segments||[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  if(segs.length!==Math.max(0,orderedStops.length-1))fail(prefix+': segments must connect each adjacent stop visit');
  segs.forEach((segment,index)=>{
    const from=orderedStops[index],to=orderedStops[index+1];
    if(segment.fromStopId!==from?.id||segment.toStopId!==to?.id)fail(prefix+': non-continuous segment '+segment.id);
    if(!allowedModes.has(segment.transport?.mode))fail(prefix+': unsupported transport mode '+segment.transport?.mode);
    if(!verificationStatuses.has(segment.verification?.status))fail(prefix+': invalid verification status on '+segment.id);
    const refs=segment.verification?.sourceIds||[];
    for(const id of refs)if(!sourceIds.has(id))fail(prefix+': segment '+segment.id+' references missing source '+id);
    for(const stage of segment.transport?.stages||[])for(const id of stage.sourceIds||[])if(!sourceIds.has(id))fail(prefix+': stage on '+segment.id+' references missing source '+id);
    if(segment.verification?.status==='verified'){
      if(!refs.length)fail(prefix+': verified segment '+segment.id+' requires sourceIds');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(segment.verification?.lastVerified||'')))fail(prefix+': verified segment '+segment.id+' requires lastVerified');
    }
  });

  validatePlatformExtensions({item,trip,orderedStops,segs,stopById,placeById,sourceIds,fail});
  if(item.capabilities?.includes('story')&&!(trip.chapters||[]).length)warn(prefix+': story capability has no chapters');
  if(!(trip.sources||[]).length)warn(prefix+': no source evidence is attached');
  const metrics=computeMetrics(trip);
  for(const [key,value] of Object.entries(metrics)){
    if(item.metrics?.[key]!=null&&Number(item.metrics[key])!==Number(value))warn(prefix+': catalog metric '+key+' will be normalized from '+item.metrics[key]+' to '+value);
  }
  return {ok:errors.length===0,errors,warnings,metrics};
}
