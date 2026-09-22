import {validatePlatformExtensions} from '../../one-world-route-public-mvp/scripts/platform-extension-validators.mjs';

export const SLUG_PATTERN=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ALLOWED_MODES=new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);
export const VERIFICATION_STATUSES=new Set(['current-check-required','verified','draft','illustrative']);
export const PUBLISH_STATUSES=new Set(['sourced-beta','illustrative-template','planned']);
export const PACES=new Set(['relaxed','balanced','active']);
export const SEASONS=new Set(['spring','summer','autumn','winter','multi-season']);
export const PARTIES=new Set(['solo','couples','friends','families']);
export const ACCESSIBILITY=new Set(['standard-check','operator-dependent','vehicle-dependent','complex-planning']);
export const DURATION_BANDS=new Set(['7-14','15-30','31-89','90-plus']);

const clean=value=>String(value??'').trim();
const unique=list=>[...new Set((Array.isArray(list)?list:[]).map(clean).filter(Boolean))];

export function durationBand(days){
  const n=Number(days);
  if(!Number.isFinite(n)||n<1)return null;
  if(n<=14)return '7-14';
  if(n<=30)return '15-30';
  if(n<=89)return '31-89';
  return '90-plus';
}

export function localized(value,locales=['en']){
  return Object.fromEntries(locales.map(locale=>[locale,value]));
}

export function createDraft({slug,kind='custom',days=null,locales=['en','de','it','es','fr','pt'],defaultLocale='en'}={}){
  slug=clean(slug);
  kind=clean(kind)||'custom';
  if(!SLUG_PATTERN.test(slug))throw new Error('Draft slug must be a normalized lowercase slug.');
  if(!SLUG_PATTERN.test(kind))throw new Error('Trip kind must be a normalized lowercase slug.');
  const human=slug.split('-').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
  const supportedLocales=unique(locales);
  if(!supportedLocales.includes(defaultLocale))supportedLocales.unshift(defaultLocale);
  const trip={
    schemaVersion:1,id:slug,slug,kind,status:'draft',defaultLocale,supportedLocales,
    title:localized(human,supportedLocales),
    summary:localized('',supportedLocales),
    geography:{regions:[],countries:[]},
    planning:{days:Number.isFinite(Number(days))?Number(days):null,currency:'EUR'},
    rendering:{preferred:'standard-globe',terrainOptional:true},
    places:[],stops:[],segments:[],chapters:[],
    travellerContext:{scope:[]},sources:[],extensions:{}
  };
  const catalogEntry={
    id:slug,slug,kind,status:'draft',renderer:'regional-globe',
    dataset:`./data/platform/trips/${slug}.json`,
    title:localized(human,supportedLocales),
    subtitle:localized('',supportedLocales),
    metrics:{days:trip.planning.days,countries:0,stops:0,segments:0,budget:null,sourcedSegments:0,verifiedSegments:0},
    capabilities:['globe','regional-stops','story','terrain'],
    discovery:{
      regions:[],themes:[],modes:[],durationBand:durationBand(trip.planning.days),
      featured:false,
      fit:{pace:'balanced',seasons:['multi-season'],party:['solo','couples','friends'],startRegion:'',accessibility:'standard-check'}
    }
  };
  return {version:1,trip,catalogEntry,meta:{createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}};
}

export function deriveMetrics(trip){
  const places=Array.isArray(trip?.places)?trip.places:[];
  const segments=Array.isArray(trip?.segments)?trip.segments:[];
  return {
    days:Number.isFinite(Number(trip?.planning?.days))?Number(trip.planning.days):null,
    countries:new Set(places.map(place=>clean(place?.countryCode)).filter(Boolean)).size,
    stops:Array.isArray(trip?.stops)?trip.stops.length:0,
    segments:segments.length,
    budget:null,
    sourcedSegments:segments.filter(segment=>(segment?.verification?.sourceIds||[]).length>0).length,
    verifiedSegments:segments.filter(segment=>segment?.verification?.status==='verified').length
  };
}

export function synchronizeDraft(input){
  const draft=structuredClone(input||{});
  draft.version=1;
  draft.trip=draft.trip||{};
  draft.catalogEntry=draft.catalogEntry||{};
  const slug=clean(draft.trip.slug||draft.trip.id||draft.catalogEntry.slug||draft.catalogEntry.id);
  if(slug){
    draft.trip.id=slug;
    draft.trip.slug=slug;
    draft.catalogEntry.id=slug;
    draft.catalogEntry.slug=slug;
    draft.catalogEntry.dataset=`./data/platform/trips/${slug}.json`;
  }
  const kind=clean(draft.trip.kind||draft.catalogEntry.kind||'custom');
  draft.trip.kind=kind;
  draft.catalogEntry.kind=kind;
  draft.catalogEntry.renderer='regional-globe';
  draft.catalogEntry.metrics={...deriveMetrics(draft.trip),...(draft.catalogEntry.metrics?.nights!=null?{nights:draft.catalogEntry.metrics.nights}:{}),...(draft.catalogEntry.metrics?.seaDays!=null?{seaDays:draft.catalogEntry.metrics.seaDays}:{})};
  draft.catalogEntry.discovery=draft.catalogEntry.discovery||{};
  draft.catalogEntry.discovery.durationBand=durationBand(draft.trip?.planning?.days);
  draft.catalogEntry.status=draft.trip.status||draft.catalogEntry.status||'draft';
  draft.meta={...(draft.meta||{}),updatedAt:new Date().toISOString()};
  return draft;
}

function localizedMissing(value,locales){
  return locales.filter(locale=>!clean(value?.[locale]));
}

function containsTodo(value){
  if(typeof value==='string')return /\bTODO\b|TBD|PLACEHOLDER/i.test(value);
  if(Array.isArray(value))return value.some(containsTodo);
  if(value&&typeof value==='object')return Object.values(value).some(containsTodo);
  return false;
}

export function validateDraft(input,{publicCatalog=null,publish=false}={}){
  const draft=synchronizeDraft(input);
  const {trip,catalogEntry:item}=draft;
  const errors=[];
  const warnings=[];
  const fail=message=>errors.push(String(message));
  const warn=message=>warnings.push(String(message));
  const id=clean(trip.id||item.id||'draft');

  if(!SLUG_PATTERN.test(clean(trip.id)))fail('trip.id must be a normalized slug');
  if(trip.id!==trip.slug)fail(id+': trip.id and trip.slug must match');
  if(item.id!==trip.id||item.slug!==trip.slug)fail(id+': catalog identity must match trip identity');
  if(!SLUG_PATTERN.test(clean(trip.kind)))fail(id+': trip.kind must be a normalized slug');
  if(item.kind!==trip.kind)fail(id+': catalog kind must match trip kind');
  if(item.renderer!=='regional-globe')fail(id+': internal builder publishes only regional-globe trips');

  if(publicCatalog?.trips?.some(entry=>entry.id===trip.id||entry.slug===trip.slug))fail(id+': trip already exists in public catalog');

  const locales=unique(trip.supportedLocales?.length?trip.supportedLocales:publicCatalog?.supportedLocales);
  if(!locales.length)fail(id+': supportedLocales required');
  if(!locales.includes(trip.defaultLocale))fail(id+': defaultLocale must be included in supportedLocales');
  for(const [label,value] of [['trip title',trip.title],['trip summary',trip.summary],['catalog title',item.title],['catalog subtitle',item.subtitle]]){
    const missing=localizedMissing(value,locales);
    if(missing.length)fail(id+': '+label+' missing locales '+missing.join(', '));
  }

  if(publish&&trip.status==='draft')fail(id+': change trip status from draft before publishing');
  if(publish&&!PUBLISH_STATUSES.has(trip.status))fail(id+': unsupported publish status '+trip.status);
  if(publish&&containsTodo(draft))fail(id+': TODO/TBD/placeholder content must be resolved before publishing');

  if(!Array.isArray(item.capabilities)||!item.capabilities.length)fail(id+': capabilities required');
  else{
    const seen=new Set();
    for(const capability of item.capabilities){
      if(!SLUG_PATTERN.test(clean(capability)))fail(id+': invalid capability '+capability);
      if(seen.has(capability))fail(id+': duplicate capability '+capability);
      seen.add(capability);
    }
    if(!seen.has('globe'))fail(id+': regional renderer requires globe capability');
  }

  const discovery=item.discovery||{};
  if(!unique(discovery.regions).length)fail(id+': discovery.regions required');
  if(!unique(discovery.themes).length)fail(id+': discovery.themes required');
  if(!unique(discovery.modes).length)fail(id+': discovery.modes required');
  if(!DURATION_BANDS.has(discovery.durationBand))fail(id+': valid discovery.durationBand required');
  const fit=discovery.fit||{};
  if(!PACES.has(fit.pace))fail(id+': invalid discovery.fit.pace');
  if(!unique(fit.seasons).length||unique(fit.seasons).some(value=>!SEASONS.has(value)))fail(id+': invalid discovery.fit.seasons');
  if(!unique(fit.party).length||unique(fit.party).some(value=>!PARTIES.has(value)))fail(id+': invalid discovery.fit.party');
  if(!clean(fit.startRegion))fail(id+': discovery.fit.startRegion required');
  if(!ACCESSIBILITY.has(fit.accessibility))fail(id+': invalid discovery.fit.accessibility');

  const sourceIds=new Set();
  for(const source of trip.sources||[]){
    if(!clean(source.id)||sourceIds.has(source.id))fail(id+': duplicate or missing source '+source.id);
    else sourceIds.add(source.id);
    if(!/^https:\/\//.test(clean(source.url)))fail(id+': source '+source.id+' requires https URL');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(clean(source.checkedAt)))fail(id+': source '+source.id+' requires checkedAt YYYY-MM-DD');
    if(!clean(source.title)||!clean(source.issuer)||!clean(source.issuerType))fail(id+': source '+source.id+' requires title, issuer and issuerType');
  }

  const placeIds=new Set();
  const placeById=new Map();
  for(const place of trip.places||[]){
    if(!clean(place.id)||placeIds.has(place.id))fail(id+': duplicate or missing place '+place.id);
    else placeIds.add(place.id);
    placeById.set(place.id,place);
    if(!clean(place.countryCode))fail(id+': place '+place.id+' requires countryCode');
    if(!Number.isFinite(Number(place.coordinates?.lat))||!Number.isFinite(Number(place.coordinates?.lng)))fail(id+': place '+place.id+' requires numeric coordinates');
    const missing=localizedMissing(place.name,locales);
    if(missing.length)fail(id+': place '+place.id+' name missing locales '+missing.join(', '));
  }

  const orderedStops=[...(trip.stops||[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  const stopIds=new Set();
  const stopById=new Map();
  orderedStops.forEach((stop,index)=>{
    if(!clean(stop.id)||stopIds.has(stop.id))fail(id+': duplicate or missing stop '+stop.id);
    else stopIds.add(stop.id);
    stopById.set(stop.id,stop);
    if(Number(stop.sequence)!==index+1)fail(id+': stop '+stop.id+' sequence must be '+(index+1));
    if(!placeIds.has(stop.placeId))fail(id+': stop '+stop.id+' references missing place '+stop.placeId);
    if(!Number.isFinite(Number(stop.dayStart))||!Number.isFinite(Number(stop.dayEnd)))warn(id+': stop '+stop.id+' has incomplete day range');
  });

  const segs=[...(trip.segments||[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  if(segs.length!==Math.max(0,orderedStops.length-1))fail(id+': segments must connect every adjacent stop');
  const segmentIds=new Set();
  segs.forEach((segment,index)=>{
    if(!clean(segment.id)||segmentIds.has(segment.id))fail(id+': duplicate or missing segment '+segment.id);
    else segmentIds.add(segment.id);
    if(Number(segment.sequence)!==index+1)fail(id+': segment '+segment.id+' sequence must be '+(index+1));
    const from=orderedStops[index],to=orderedStops[index+1];
    if(segment.fromStopId!==from?.id||segment.toStopId!==to?.id)fail(id+': non-continuous segment '+segment.id);
    if(!ALLOWED_MODES.has(segment.transport?.mode))fail(id+': unsupported transport mode '+segment.transport?.mode);
    if(!VERIFICATION_STATUSES.has(segment.verification?.status))fail(id+': invalid verification status on '+segment.id);
    const refs=unique(segment.verification?.sourceIds);
    for(const ref of refs)if(!sourceIds.has(ref))fail(id+': segment '+segment.id+' references missing source '+ref);
    for(const stage of segment.transport?.stages||[]){
      if(!ALLOWED_MODES.has(stage.mode))fail(id+': stage on '+segment.id+' uses unsupported mode '+stage.mode);
      for(const ref of unique(stage.sourceIds))if(!sourceIds.has(ref))fail(id+': stage on '+segment.id+' references missing source '+ref);
    }
    if(segment.verification?.status==='verified'){
      if(!refs.length)fail(id+': verified segment '+segment.id+' requires sourceIds');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(clean(segment.verification?.lastVerified)))fail(id+': verified segment '+segment.id+' requires lastVerified YYYY-MM-DD');
    }
  });

  validatePlatformExtensions({item,trip,orderedStops,segs,stopById,placeById,sourceIds,fail});

  if(trip.entryGuidance){
    for(const sourceId of [trip.entryGuidance.officialResolverSourceId,...(trip.entryGuidance.supportingSourceIds||[])].filter(Boolean)){
      if(!sourceIds.has(sourceId))fail(id+': entry guidance references missing source '+sourceId);
    }
    if(trip.entryGuidance.personalizationRequired!==true)fail(id+': entry guidance must require traveller personalization');
  }

  const derived=deriveMetrics(trip);
  for(const name of ['days','countries','stops','segments','sourcedSegments','verifiedSegments']){
    if(item.metrics?.[name]!=null&&Number(item.metrics[name])!==Number(derived[name]))warn(id+': metric '+name+' will be recalculated to '+derived[name]);
  }
  if(trip.planning?.days==null)fail(id+': planning.days required');
  if(Number(trip.planning?.days)<1)fail(id+': planning.days must be positive');
  if((trip.places||[]).length<2)fail(id+': at least two places required');
  if((trip.stops||[]).length<2)fail(id+': at least two stops required');
  if(publish&&!(trip.sources||[]).length)warn(id+': publishing without any source evidence');

  return {ok:errors.length===0,errors,warnings,metrics:derived,draft};
}

export function publicCatalogEntry(input){
  const draft=synchronizeDraft(input);
  return draft.catalogEntry;
}
