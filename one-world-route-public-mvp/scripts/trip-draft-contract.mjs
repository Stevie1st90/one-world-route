import {validatePlatformExtensions} from './platform-extension-validators.mjs';

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedModes=new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);
const verificationStates=new Set(['current-check-required','verified','draft','illustrative']);
const durationBands=new Set(['7-14','15-30','31-89','90-plus']);
const paces=new Set(['relaxed','balanced','active']);
const seasons=new Set(['spring','summer','autumn','winter','multi-season']);
const parties=new Set(['solo','couples','friends','families']);
const accessibilities=new Set(['standard-check','operator-dependent','vehicle-dependent','complex-planning']);

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

export function validateTripDraft({trip,catalogEntry,catalog}){
  const errors=[]; const warnings=[];
  const fail=m=>errors.push(m); const warn=m=>warnings.push(m);
  const locales=Array.isArray(catalog?.supportedLocales)&&catalog.supportedLocales.length?catalog.supportedLocales:['en'];
  if(!trip||typeof trip!=='object')return {valid:false,errors:['Trip payload missing'],warnings,metrics:computeTripMetrics({}),catalogEntry};
  if(!catalogEntry||typeof catalogEntry!=='object')return {valid:false,errors:['Catalog entry missing'],warnings,metrics:computeTripMetrics(trip),catalogEntry};
  if(!slugPattern.test(String(trip.id||'')))fail('trip.id must be a normalized slug');
  if(trip.slug!==trip.id)fail('trip.slug must equal trip.id');
  if(!slugPattern.test(String(trip.kind||'')))fail('trip.kind must be a normalized slug');
  if(catalogEntry.id!==trip.id||catalogEntry.slug!==trip.slug)fail('catalog identity must match trip identity');
  if(catalogEntry.kind!==trip.kind)fail('catalog kind must match trip kind');
  if(catalogEntry.renderer&&catalogEntry.renderer!=='regional-globe')fail('draft trips must use regional-globe renderer');

  for(const lang of locales){
    if(!String(trip.title?.[lang]||'').trim())fail(`trip title missing for ${lang}`);
    if(!String(catalogEntry.title?.[lang]||'').trim())fail(`catalog title missing for ${lang}`);
    if(!String(catalogEntry.subtitle?.[lang]||'').trim())fail(`catalog subtitle missing for ${lang}`);
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
    if(!Number.isFinite(Number(p.coordinates?.lat))||!Number.isFinite(Number(p.coordinates?.lng)))fail('place '+p.id+' requires numeric coordinates');
    if(!String(p.countryCode||'').trim())warn('place '+p.id+' has no countryCode');
  }

  const stops=[...(Array.isArray(trip.stops)?trip.stops:[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  const stopIds=new Set(); const stopById=new Map();
  for(let i=0;i<stops.length;i++){
    const s=stops[i];
    if(!s.id||stopIds.has(s.id))fail('stop IDs must be present and unique: '+s.id); else stopIds.add(s.id);
    stopById.set(s.id,s);
    if(!placeIds.has(s.placeId))fail('stop '+s.id+' references missing place '+s.placeId);
    if(Number(s.sequence)!==i+1)warn('stop '+s.id+' sequence is not contiguous from 1');
  }

  const segs=[...(Array.isArray(trip.segments)?trip.segments:[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  if(segs.length!==Math.max(0,stops.length-1))fail('segments must connect every adjacent stop');
  for(let i=0;i<segs.length;i++){
    const s=segs[i],from=stops[i],to=stops[i+1];
    if(!s.id)fail('segment at index '+i+' requires id');
    if(Number(s.sequence)!==i+1)warn('segment '+s.id+' sequence is not contiguous from 1');
    if(s.fromStopId!==from?.id||s.toStopId!==to?.id)fail('segment '+s.id+' must connect adjacent stops');
    if(!allowedModes.has(s.transport?.mode))fail('segment '+s.id+' uses unsupported mode '+s.transport?.mode);
    if(!verificationStates.has(s.verification?.status))fail('segment '+s.id+' has invalid verification status');
    const refs=s.verification?.sourceIds||[];
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
