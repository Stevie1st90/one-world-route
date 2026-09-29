import {validatePlatformExtensions} from './platform-extension-validators.mjs';

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedModes=new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);
const verificationStates=new Set(['current-check-required','verified','draft','illustrative']);
const durationBands=new Set(['7-14','15-30','31-89','90-plus']);
const paces=new Set(['relaxed','balanced','active']);
const seasons=new Set(['spring','summer','autumn','winter','multi-season']);
const parties=new Set(['solo','couples','friends','families']);
const accessibilities=new Set(['standard-check','operator-dependent','vehicle-dependent','complex-planning']);
export const publicationStatuses=new Set(['planned','sourced-beta','illustrative-template','editorial-preview']);

const baseCapabilities=['globe','regional-stops','traveller-context','source-evidence','trip-planning','story','terrain'];
const archetypeDefinitions={
  rail:{mode:'rail',themes:['rail','cities','culture'],capabilities:[],reviewDays:90,maintenanceTier:'live-dependent',accessibility:'standard-check',routePolicy:{startMode:'endpoints',reversible:true,reverseEvidenceReusable:false,reversePlanningReusable:false,originAccess:'dynamic',returnMode:'dynamic',preserveCoreRoute:true},visualTheme:'rockies'},
  'road-trip':{mode:'car',themes:['road-trip','nature','cities'],capabilities:['vehicle-context','road-rules'],reviewDays:180,maintenanceTier:'stable-editorial',accessibility:'vehicle-dependent',routePolicy:{startMode:'endpoints',reversible:true,reverseEvidenceReusable:false,reversePlanningReusable:false,originAccess:'dynamic',returnMode:'dynamic',preserveCoreRoute:true},visualTheme:'desert'},
  camper:{mode:'car',themes:['camper','road-trip','nature'],capabilities:['vehicle-context','road-rules'],reviewDays:180,maintenanceTier:'stable-editorial',accessibility:'vehicle-dependent',routePolicy:{startMode:'endpoints',reversible:true,reverseEvidenceReusable:false,reversePlanningReusable:false,originAccess:'dynamic',returnMode:'dynamic',preserveCoreRoute:true},visualTheme:'fern'},
  cruise:{mode:'cruise',themes:['cruise','coast','ports'],capabilities:['cruise-calls','sea-days','border-context'],reviewDays:30,maintenanceTier:'live-dependent',accessibility:'operator-dependent',routePolicy:{startMode:'fixed',reversible:false,originAccess:'dynamic',returnMode:'dynamic',preserveCoreRoute:true},visualTheme:'ocean'},
  'island-hopping':{mode:'ferry',themes:['islands','coast','culture'],capabilities:['border-context'],reviewDays:60,maintenanceTier:'live-dependent',accessibility:'operator-dependent',routePolicy:{startMode:'endpoints',reversible:true,reverseEvidenceReusable:false,reversePlanningReusable:false,originAccess:'dynamic',returnMode:'dynamic',preserveCoreRoute:true},visualTheme:'aegean'},
  'round-trip':{mode:'multimodal',themes:['round-trip','culture','cities'],capabilities:[],reviewDays:180,maintenanceTier:'stable-editorial',accessibility:'standard-check',routePolicy:{startMode:'fixed',reversible:false,originAccess:'dynamic',returnMode:'dynamic',preserveCoreRoute:true},visualTheme:'aegean'},
  multimodal:{mode:'multimodal',themes:['culture','cities','nature'],capabilities:['border-context'],reviewDays:90,maintenanceTier:'live-dependent',accessibility:'complex-planning',routePolicy:{startMode:'endpoints',reversible:true,reverseEvidenceReusable:false,reversePlanningReusable:false,originAccess:'dynamic',returnMode:'dynamic',preserveCoreRoute:true},visualTheme:'andes'}
};
const clone=value=>JSON.parse(JSON.stringify(value));
export function journeyArchetypes(){return Object.keys(archetypeDefinitions)}
export function journeyArchetype(kind){
  const key=String(kind||'').trim();
  const source=archetypeDefinitions[key]||{mode:key||'multimodal',themes:[key||'journey'],capabilities:[],reviewDays:180,maintenanceTier:'stable-editorial',accessibility:'standard-check',routePolicy:{startMode:'fixed',reversible:false,originAccess:'dynamic',returnMode:'dynamic',preserveCoreRoute:true},visualTheme:'ocean'};
  return clone({...source,capabilities:[...baseCapabilities,...source.capabilities]});
}
const localized=(locales,value)=>Object.fromEntries(locales.map(locale=>[locale,value]));
const durationBand=days=>days==null?'7-14':days<=14?'7-14':days<=30?'15-30':days<=89?'31-89':'90-plus';

export function scaffoldTripDraft({slug,kind,days,catalog}){
  const locales=Array.isArray(catalog?.supportedLocales)&&catalog.supportedLocales.length?catalog.supportedLocales:['en'];
  const human=String(slug||'').split('-').filter(Boolean).map(part=>part[0]?.toUpperCase()+part.slice(1)).join(' ');
  const normalizedDays=days===null||days===undefined||days===''?null:Number(days);
  const archetype=journeyArchetype(kind);
  const trip={
    schemaVersion:1,id:slug,slug,kind,status:'draft',
    defaultLocale:catalog?.defaultLocale||'en',supportedLocales:[...locales],
    title:localized(locales,human),summary:localized(locales,'TODO — editorial summary'),
    geography:{regions:[],countries:[]},
    planning:{days:normalizedDays,currency:null},
    maintenance:{tier:archetype.maintenanceTier,sourceReviewDays:archetype.reviewDays},
    routePolicy:archetype.routePolicy,
    rendering:{},places:[],stops:[],segments:[],chapters:[],
    travellerContext:{scope:[]},sources:[],extensions:{}
  };
  const catalogEntry={
    id:slug,slug,kind,status:'draft',renderer:'regional-globe',
    dataset:'./data/platform/trips/'+slug+'.json',
    title:localized(locales,human),subtitle:localized(locales,'TODO — discovery subtitle'),
    metrics:{},capabilities:archetype.capabilities,
    visual:{theme:archetype.visualTheme,mediaState:'art-directed'},
    discovery:{
      regions:['global'],themes:archetype.themes,modes:[archetype.mode],
      durationBand:durationBand(normalizedDays),featured:false,
      fit:{pace:'balanced',seasons:['multi-season'],party:['solo','couples','friends'],startRegion:'global',accessibility:archetype.accessibility}
    }
  };
  return {trip,catalogEntry,archetype};
}

export function computeTripMetrics(trip={}){
  const segments=Array.isArray(trip.segments)?trip.segments:[];
  const places=Array.isArray(trip.places)?trip.places:[];
  return {
    days:Number.isFinite(Number(trip.planning?.days))?Number(trip.planning.days):null,
    stops:Array.isArray(trip.stops)?trip.stops.length:0,
    segments:segments.length,
    countries:new Set(places.map(p=>p.countryCode).filter(Boolean)).size,
    sourcedSegments:segments.filter(s=>(s.verification?.sourceIds||[]).length).length,
    verifiedSegments:segments.filter(s=>s.verification?.status==='verified').length
  };
}

export function normalizeDraftMetadata({trip={},catalogEntry={}}={}){
  const nextTrip=clone(trip||{});
  const nextEntry=clone(catalogEntry||{});
  const countries=[...new Set((nextTrip.places||[]).map(place=>String(place.countryCode||'').trim()).filter(code=>/^[A-Z]{2}$/.test(code)))];
  nextTrip.geography={...(nextTrip.geography||{}),countries};
  nextTrip.planning={...(nextTrip.planning||{})};
  if(!Number.isFinite(Number(nextTrip.planning.days))||Number(nextTrip.planning.days)<=0){
    const stopDays=(nextTrip.stops||[]).flatMap(stop=>[stop.dayEnd,stop.dayStart]).map(Number).filter(value=>Number.isFinite(value)&&value>0);
    if(stopDays.length)nextTrip.planning.days=Math.max(...stopDays);
  }
  const normalized=normalizeCatalogEntry(nextEntry,nextTrip);
  const archetype=journeyArchetype(nextTrip.kind);
  const existingCapabilities=Array.isArray(normalized.capabilities)?normalized.capabilities:[];
  normalized.capabilities=[...new Set([...archetype.capabilities,...existingCapabilities])];
  const actualModes=[...new Set((nextTrip.segments||[]).map(segment=>segment.transport?.mode).filter(mode=>allowedModes.has(mode)))];
  const existingModes=Array.isArray(normalized.discovery?.modes)?normalized.discovery.modes:[];
  normalized.discovery={
    ...(normalized.discovery||{}),
    modes:[...new Set([...existingModes,...actualModes])],
    durationBand:durationBand(nextTrip.planning.days)
  };
  return {trip:nextTrip,catalogEntry:normalized};
}

export function normalizeCatalogEntry(entry={},trip={}){
  const metrics=computeTripMetrics(trip);
  return {
    ...entry,
    id:trip.id,
    slug:trip.slug,
    kind:trip.kind,
    renderer:'regional-globe',
    dataset:`./data/platform/trips/${trip.slug}.json`,
    metrics:{...(entry.metrics||{}),...metrics}
  };
}

export function validatePublicationReadiness({trip,catalogEntry}={}){
  const errors=[];
  const tripStatus=String(trip?.status||'').trim();
  const catalogStatus=String(catalogEntry?.status||'').trim();
  if(!tripStatus||tripStatus==='draft')errors.push('trip.status must be an explicit public status before publish');
  if(!catalogStatus||catalogStatus==='draft')errors.push('catalog status must be an explicit public status before publish');
  if(tripStatus&&catalogStatus&&tripStatus!==catalogStatus)errors.push('trip and catalog publication status must match');
  if(tripStatus&&tripStatus!=='draft'&&!publicationStatuses.has(tripStatus))errors.push('unsupported trip publication status: '+tripStatus);
  if(catalogStatus&&catalogStatus!=='draft'&&!publicationStatuses.has(catalogStatus))errors.push('unsupported catalog publication status: '+catalogStatus);
  return {valid:errors.length===0,errors,status:tripStatus||catalogStatus||''};
}

export function validateTripDraft({trip,catalogEntry,catalog}){
  const errors=[]; const warnings=[];
  const fail=m=>errors.push(m); const warn=m=>warnings.push(m);
  const locales=Array.isArray(catalog?.supportedLocales)&&catalog.supportedLocales.length?catalog.supportedLocales:['en'];
  if(!trip||typeof trip!=='object')return {valid:false,errors:['Trip payload missing'],warnings,metrics:computeTripMetrics({}),catalogEntry};
  if(!catalogEntry||typeof catalogEntry!=='object')return {valid:false,errors:['Catalog entry missing'],warnings,metrics:computeTripMetrics(trip),catalogEntry};
  if(Number(trip.schemaVersion)!==1)fail('trip.schemaVersion must be 1');
  if(!slugPattern.test(String(trip.id||'')))fail('trip.id must be a normalized slug');
  if(trip.slug!==trip.id)fail('trip.slug must equal trip.id');
  if(!slugPattern.test(String(trip.kind||'')))fail('trip.kind must be a normalized slug');
  if(catalogEntry.id!==trip.id||catalogEntry.slug!==trip.slug)fail('catalog identity must match trip identity');
  if(catalogEntry.kind!==trip.kind)fail('catalog kind must match trip kind');
  if(catalogEntry.renderer&&catalogEntry.renderer!=='regional-globe')fail('draft trips must use regional-globe renderer');

  for(const lang of locales){
    const tripTitle=String(trip.title?.[lang]||'').trim();
    const catalogTitle=String(catalogEntry.title?.[lang]||'').trim();
    const subtitle=String(catalogEntry.subtitle?.[lang]||'').trim();
    const summary=String(trip.summary?.[lang]||'').trim();
    if(!tripTitle)fail(`trip title missing for ${lang}`);
    if(!summary)fail(`trip summary missing for ${lang}`);
    if(!catalogTitle)fail(`catalog title missing for ${lang}`);
    if(!subtitle)fail(`catalog subtitle missing for ${lang}`);
    if(/^TODO\b/i.test(tripTitle)||/^TODO\b/i.test(summary)||/^TODO\b/i.test(catalogTitle)||/^TODO\b/i.test(subtitle))fail(`placeholder localization remains for ${lang}`);
  }

  const sources=Array.isArray(trip.sources)?trip.sources:[];
  const sourceIds=new Set();
  for(const src of sources){
    if(!src.id||sourceIds.has(src.id))fail('source IDs must be present and unique: '+src.id); else sourceIds.add(src.id);
    if(!/^https:\/\//.test(String(src.url||'')))fail('source '+src.id+' requires https URL');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(src.checkedAt||'')))fail('source '+src.id+' requires checkedAt date');
  }

  const places=Array.isArray(trip.places)?trip.places:[];
  const placeIds=new Set(); const placeById=new Map();
  for(const p of places){
    if(!p.id||placeIds.has(p.id))fail('place IDs must be present and unique: '+p.id); else placeIds.add(p.id);
    placeById.set(p.id,p);
    const lat=Number(p.coordinates?.lat),lng=Number(p.coordinates?.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))fail('place '+p.id+' requires numeric coordinates');
    else if(lat < -90 || lat > 90 || lng < -180 || lng > 180)fail('place '+p.id+' coordinates are out of range');
    if(!String(p.countryCode||'').trim())warn('place '+p.id+' has no countryCode');
    else if(!/^[A-Z]{2}$/.test(String(p.countryCode)))fail('place '+p.id+' countryCode must be ISO alpha-2');
    for(const lang of locales){
      const name=String(p.name?.[lang]||'').trim();
      if(!name)fail(`place ${p.id} name missing for ${lang}`);
      if(/^TODO\b/i.test(name))fail(`place ${p.id} has placeholder name for ${lang}`);
    }
  }

  const stops=[...(Array.isArray(trip.stops)?trip.stops:[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  const stopIds=new Set(); const stopById=new Map();
  for(let i=0;i<stops.length;i++){
    const s=stops[i];
    if(!s.id||stopIds.has(s.id))fail('stop IDs must be present and unique: '+s.id); else stopIds.add(s.id);
    stopById.set(s.id,s);
    if(!placeIds.has(s.placeId))fail('stop '+s.id+' references missing place '+s.placeId);
    if(Number(s.sequence)!==i+1)fail('stop '+s.id+' sequence must be contiguous from 1');
  }

  const segs=[...(Array.isArray(trip.segments)?trip.segments:[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  const segmentIds=new Set();
  if(segs.length!==Math.max(0,stops.length-1))fail('segments must connect every adjacent stop');
  for(let i=0;i<segs.length;i++){
    const s=segs[i],from=stops[i],to=stops[i+1];
    if(!s.id)fail('segment at index '+i+' requires id');
    else if(segmentIds.has(s.id))fail('segment IDs must be unique: '+s.id);
    else segmentIds.add(s.id);
    if(Number(s.sequence)!==i+1)fail('segment '+s.id+' sequence must be contiguous from 1');
    if(s.fromStopId!==from?.id||s.toStopId!==to?.id)fail('segment '+s.id+' must connect adjacent stops');
    if(!allowedModes.has(s.transport?.mode))fail('segment '+s.id+' uses unsupported mode '+s.transport?.mode);
    if(!verificationStates.has(s.verification?.status))fail('segment '+s.id+' has invalid verification status');
    const refs=s.verification?.sourceIds||[];
    if(catalogEntry.capabilities?.includes('source-evidence')&&!refs.length)fail('segment '+s.id+' requires source evidence for source-evidence capability');
    for(const id of refs)if(!sourceIds.has(id))fail('segment '+s.id+' references missing source '+id);
    for(const stage of s.transport?.stages||[])for(const id of stage.sourceIds||[])if(!sourceIds.has(id))fail('stage on '+s.id+' references missing source '+id);
    if(s.verification?.status==='verified'){
      if(!refs.length)fail('verified segment '+s.id+' requires sourceIds');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s.verification?.lastVerified||'')))fail('verified segment '+s.id+' requires lastVerified');
    }
  }

  const d=catalogEntry.discovery||{}; const fit=d.fit||{};
  if(!Array.isArray(d.regions)||!d.regions.length)fail('discovery.regions required');
  if(!Array.isArray(d.themes)||!d.themes.length)fail('discovery.themes required');
  if(!Array.isArray(d.modes)||!d.modes.length)fail('discovery.modes required');
  if(!durationBands.has(d.durationBand))fail('invalid discovery.durationBand');
  if(!paces.has(fit.pace))fail('invalid discovery.fit.pace');
  if(!Array.isArray(fit.seasons)||!fit.seasons.length||fit.seasons.some(v=>!seasons.has(v)))fail('invalid discovery.fit.seasons');
  if(!Array.isArray(fit.party)||!fit.party.length||fit.party.some(v=>!parties.has(v)))fail('invalid discovery.fit.party');
  if(!fit.startRegion)fail('discovery.fit.startRegion required');
  if(!accessibilities.has(fit.accessibility))fail('invalid discovery.fit.accessibility');
  if(!Array.isArray(catalogEntry.capabilities)||!catalogEntry.capabilities.includes('globe'))fail('regional draft requires globe capability');

  try{validatePlatformExtensions({item:catalogEntry,trip,orderedStops:stops,segs,stopById,placeById,sourceIds,fail});}
  catch(error){fail('extension validation failed: '+error.message);}

  const metrics=computeTripMetrics(trip);
  const normalized=normalizeCatalogEntry(catalogEntry,trip);
  return {valid:errors.length===0,errors,warnings,metrics,catalogEntry:normalized};
}
