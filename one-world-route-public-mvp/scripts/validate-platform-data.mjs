import {readFile} from 'node:fs/promises';
import {validatePlatformExtensions} from './platform-extension-validators.mjs';

const root = new URL('../', import.meta.url);
const readJson = async rel => JSON.parse(await readFile(new URL(rel, root), 'utf8'));
const catalog = await readJson('data/platform/trips.json');
const world = await readJson('data/public-route.json');
const sharedKnowledge = await readJson('data/platform/shared-knowledge.json');
const collections = await readJson('data/platform/collections.json');
const allowedModes = new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);
let failed = false;
const fail = m => { failed = true; console.error('PLATFORM VALIDATION:', m); };
const experienceIndex = await readJson('data/platform/place-experiences/index.json');
const experienceProfiles = new Map();
for (const shardMeta of experienceIndex.shards || []) {
  if (!/^[A-Z]{2}$/.test(String(shardMeta.countryCode||''))) fail('place experience shard requires ISO-like countryCode');
  const shardPath=String(shardMeta.dataset||'').replace(/^\.\//,'');
  const shard=await readJson(shardPath);
  if (shard.countryCode!==shardMeta.countryCode) fail('place experience shard country mismatch: '+shardMeta.countryCode);
  for (const profile of shard.profiles || []) {
    if (!profile.id || experienceProfiles.has(profile.id)) fail('duplicate place experience profile '+profile.id);
    else experienceProfiles.set(profile.id,profile);
    if (!new RegExp('^'+shardMeta.countryCode+':[a-z0-9]+(?:-[a-z0-9]+)*$').test(String(profile.id||''))) fail('invalid place experience id '+profile.id);
    if (profile.contentType!=='editorial-evergreen') fail('place experience '+profile.id+': contentType must be editorial-evergreen');
    if (!Array.isArray(profile.tags)||!profile.tags.length||profile.tags.some(tag=>!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(tag)))) fail('place experience '+profile.id+': normalized tags required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(profile.reviewedAt||''))) fail('place experience '+profile.id+': reviewedAt required');
    if (!Number.isInteger(Number(profile.reviewDays))||Number(profile.reviewDays)<1) fail('place experience '+profile.id+': reviewDays must be positive');
  }
}
const ids = new Set();
const slugs = new Set();
const supportedLocales = Array.isArray(catalog.supportedLocales)?catalog.supportedLocales:[];
if (!supportedLocales.length) fail('Catalog must declare supportedLocales');
if (!supportedLocales.includes(catalog.defaultLocale)) fail('defaultLocale must be included in supportedLocales');
if (!Array.isArray(catalog.trips) || catalog.trips.length < 2) fail('Trip catalog must contain the flagship and at least one reusable trip');
for (const trip of catalog.trips || []) {
  if (!trip.id || ids.has(trip.id)) fail('Trip IDs must be unique: '+trip.id); else ids.add(trip.id);
  if (!trip.slug || slugs.has(trip.slug)) fail('Trip slugs must be unique: '+trip.slug); else slugs.add(trip.slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(trip.kind||''))) fail(trip.id+': kind must be a normalized slug');
  if (!['legacy-world','regional-globe'].includes(trip.renderer)) fail(trip.id+': unsupported renderer '+trip.renderer);
  if (!Array.isArray(trip.capabilities)||!trip.capabilities.length) fail(trip.id+': capabilities required');
  else {
    const seenCapabilities=new Set();
    for (const capability of trip.capabilities) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(capability||''))) fail(trip.id+': invalid capability '+capability);
      if (seenCapabilities.has(capability)) fail(trip.id+': duplicate capability '+capability);
      seenCapabilities.add(capability);
    }
    if (trip.renderer==='regional-globe'&&!seenCapabilities.has('globe')) fail(trip.id+': regional renderer requires globe capability');
  }
  const discovery=trip.discovery||{};
  if (!Array.isArray(discovery.regions)||!discovery.regions.length) fail(trip.id+': discovery.regions required');
  if (!Array.isArray(discovery.themes)||!discovery.themes.length) fail(trip.id+': discovery.themes required');
  if (!Array.isArray(discovery.modes)||!discovery.modes.length) fail(trip.id+': discovery.modes required');
  if (!['7-14','15-30','31-89','90-plus'].includes(discovery.durationBand)) fail(trip.id+': invalid discovery.durationBand');
  const fit=discovery.fit||{};
  if (!['relaxed','balanced','active'].includes(fit.pace)) fail(trip.id+': invalid discovery.fit.pace');
  if (!Array.isArray(fit.seasons)||!fit.seasons.length||fit.seasons.some(v=>!['spring','summer','autumn','winter','multi-season'].includes(v))) fail(trip.id+': invalid discovery.fit.seasons');
  if (!Array.isArray(fit.party)||!fit.party.length||fit.party.some(v=>!['solo','couples','friends','families'].includes(v))) fail(trip.id+': invalid discovery.fit.party');
  if (!fit.startRegion) fail(trip.id+': discovery.fit.startRegion required');
  if (!['standard-check','operator-dependent','vehicle-dependent','complex-planning'].includes(fit.accessibility)) fail(trip.id+': invalid discovery.fit.accessibility');
  for (const lang of supportedLocales) {
    if (!String(trip.title?.[lang]||'').trim()) fail(trip.id+': missing title for '+lang);
    if (!String(trip.subtitle?.[lang]||'').trim()) fail(trip.id+': missing subtitle for '+lang);
  }
}
if (!ids.has(catalog.defaultTripId)) fail('defaultTripId must resolve to a catalog trip');
const flagship = (catalog.trips || []).find(t => t.id === 'world-195');
if (!flagship) fail('world-195 flagship trip missing');
if (world.countries?.length !== 195 || world.segments?.length !== 194) fail('Legacy world trip invariants changed');
if (flagship?.metrics?.countries !== 195 || flagship?.metrics?.internationalLegs !== 194) fail('Flagship catalog metrics must preserve 195/194');

for (const item of catalog.trips || []) {
  if (item.renderer === 'legacy-world') continue;
  const rel = String(item.dataset || '').replace(/^\.\//, '');
  const trip = await readJson(rel);
  if (trip.id !== item.id || trip.slug !== item.slug) fail('Catalog/dataset identity mismatch for '+item.id);
  const sourceIds = new Set();
  const sourceById = new Map();
  for (const src of trip.sources || []) {
    if (!src.id || sourceIds.has(src.id)) fail(item.id+': duplicate source '+src.id); else sourceIds.add(src.id);
    sourceById.set(src.id,src);
    if (!/^https:\/\//.test(String(src.url||''))) fail(item.id+': source '+src.id+' requires https URL');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(src.checkedAt||''))) fail(item.id+': source '+src.id+' requires checkedAt date');
  }
  const placeIds = new Set();
  const placeById = new Map();
  for (const p of trip.places || []) {
    if (!p.id || placeIds.has(p.id)) fail(item.id+': duplicate place '+p.id); else placeIds.add(p.id);
    placeById.set(p.id,p);
    if (!Number.isFinite(p.coordinates?.lat) || !Number.isFinite(p.coordinates?.lng)) fail(item.id+': place '+p.id+' requires coordinates');
    if (p.experienceRef) {
      if (!/^[A-Z]{2}:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(p.experienceRef))) fail(item.id+': invalid experienceRef on '+p.id);
      else if (!experienceProfiles.has(p.experienceRef)) fail(item.id+': place '+p.id+' references missing experience profile '+p.experienceRef);
      else if (!String(p.experienceRef).startsWith(String(p.countryCode||'')+':')) fail(item.id+': place '+p.id+' experienceRef country mismatch');
    }
  }
  const stopIds = new Set();
  const stopById = new Map();
  const orderedStops = [...(trip.stops || [])].sort((a,b)=>a.sequence-b.sequence);
  for (const s of orderedStops) {
    if (!s.id || stopIds.has(s.id)) fail(item.id+': duplicate stop '+s.id); else stopIds.add(s.id);
    stopById.set(s.id,s);
    if (!placeIds.has(s.placeId)) fail(item.id+': stop '+s.id+' references missing place '+s.placeId);
  }
  const variants=Array.isArray(trip.variants)?trip.variants:[];
  const variantIds=new Set();
  for(const variant of variants){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(variant.id||''))||variant.id==='base') fail(item.id+': invalid journey variant id '+String(variant.id||''));
    else if(variantIds.has(variant.id)) fail(item.id+': duplicate journey variant '+variant.id);
    else variantIds.add(variant.id);
    const startIndex=orderedStops.findIndex(stop=>stop.id===variant.startStopId);
    const endIndex=orderedStops.findIndex(stop=>stop.id===variant.endStopId);
    if(startIndex<0||endIndex<0||endIndex<startIndex) fail(item.id+': journey variant '+variant.id+' requires an ordered stop window');
    for(const lang of supportedLocales){
      if(!String(variant.title?.[lang]||'').trim()) fail(item.id+': journey variant '+variant.id+' missing title for '+lang);
      if(!String(variant.summary?.[lang]||'').trim()) fail(item.id+': journey variant '+variant.id+' missing summary for '+lang);
    }
    if(variant.pace&&!['relaxed','balanced','active'].includes(variant.pace)) fail(item.id+': journey variant '+variant.id+' invalid pace');
    if(variant.routePolicy?.startMode&&!['fixed','endpoints','any-stop'].includes(variant.routePolicy.startMode)) fail(item.id+': journey variant '+variant.id+' invalid startMode');
  }
  const routePolicy=trip.routePolicy||{startMode:'fixed',reversible:false,originMode:'traveller-context',originAccess:'dynamic',returnMode:'to-origin',preserveCoreRoute:true};
  const segs = [...(trip.segments || [])].sort((a,b)=>a.sequence-b.sequence);
  const loopRoute=routePolicy.startMode==='any-stop';
  const expectedSegments=loopRoute?orderedStops.length:Math.max(0,orderedStops.length-1);
  if (segs.length !== expectedSegments) fail(item.id+': segment count does not match routePolicy ('+segs.length+' vs '+expectedSegments+')');

  const actualCountries = new Set((trip.places || []).map(place=>place.countryCode).filter(Boolean)).size;
  const actualSourcedSegments = segs.filter(segment=>(segment.verification?.sourceIds||[]).length).length;
  const actualVerifiedSegments = segs.filter(segment=>segment.verification?.status==='verified').length;
  const metricChecks = [
    ['days', item.metrics?.days, trip.planning?.days],
    ['stops', item.metrics?.stops, orderedStops.length],
    ['segments', item.metrics?.segments, segs.length],
    ['countries', item.metrics?.countries, actualCountries],
    ['sourcedSegments', item.metrics?.sourcedSegments, actualSourcedSegments],
    ['verifiedSegments', item.metrics?.verifiedSegments, actualVerifiedSegments]
  ];
  for (const [name, declared, actual] of metricChecks) {
    if (declared != null && Number(declared) !== Number(actual)) fail(item.id+': catalog metric '+name+' mismatch (declared '+declared+', actual '+actual+')');
  }
  for (let i=0;i<segs.length;i++) {
    const s=segs[i], from=orderedStops[i], to=(loopRoute&&i===orderedStops.length-1)?orderedStops[0]:orderedStops[i+1];
    if (s.fromStopId!==from?.id || s.toStopId!==to?.id) fail(item.id+': non-continuous segment '+s.id);
    if (!allowedModes.has(s.transport?.mode)) fail(item.id+': unsupported transport mode '+s.transport?.mode);
    if (!['current-check-required','verified','draft','illustrative'].includes(s.verification?.status)) fail(item.id+': invalid verification status on '+s.id);
    const refs = s.verification?.sourceIds || [];
    for (const id of refs) if (!sourceIds.has(id)) fail(item.id+': segment '+s.id+' references missing source '+id);
    for (const stage of s.transport?.stages || []) for (const id of stage.sourceIds || []) if (!sourceIds.has(id)) fail(item.id+': stage on '+s.id+' references missing source '+id);
    if (s.verification?.status === 'verified') {
      if (!refs.length) fail(item.id+': verified segment '+s.id+' requires sourceIds');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.verification?.lastVerified||''))) fail(item.id+': verified segment '+s.id+' requires lastVerified');
    }
  }
  validatePlatformExtensions({item,trip,orderedStops,segs,stopById,placeById,sourceIds,fail});
  if(!['fixed','endpoints','any-stop'].includes(routePolicy.startMode||'fixed')) fail(item.id+': invalid routePolicy.startMode');
  if(!['traveller-context','fixed'].includes(routePolicy.originMode||'traveller-context')) fail(item.id+': invalid routePolicy.originMode');
  if(!['none','dynamic'].includes(routePolicy.originAccess||'dynamic')) fail(item.id+': invalid routePolicy.originAccess');
  if(!['none','to-origin'].includes(routePolicy.returnMode||'to-origin')) fail(item.id+': invalid routePolicy.returnMode');
  if(routePolicy.preserveCoreRoute!==undefined&&typeof routePolicy.preserveCoreRoute!=='boolean') fail(item.id+': routePolicy.preserveCoreRoute must be boolean');
  if(routePolicy.reversible===true&&!['endpoints','any-stop'].includes(routePolicy.startMode)) fail(item.id+': reversible route requires endpoints or any-stop startMode');
  if(routePolicy.startMode==='any-stop'){
    const first=orderedStops[0]?.id,last=orderedStops.at(-1)?.id;
    const closesLoop=segs.some(segment=>segment.fromStopId===last&&segment.toStopId===first);
    if(!closesLoop) fail(item.id+': any-stop route requires an explicitly modelled closing segment');
  }
  const maintenance=trip.maintenance||null;
  if(maintenance){
    if(!['evergreen','seasonal','live-dependent'].includes(maintenance.tier)) fail(item.id+': invalid maintenance.tier');
    if(!Number.isInteger(Number(maintenance.sourceReviewDays))||Number(maintenance.sourceReviewDays)<1) fail(item.id+': maintenance.sourceReviewDays must be a positive integer');
    if(maintenance.sharedKnowledge!==true&&maintenance.sharedKnowledge!==false) fail(item.id+': maintenance.sharedKnowledge must be boolean');
  }
  const media=trip.media||null;
  const heroMedia=media?.hero||null;
  if(heroMedia){
    if(!['art-directed','image'].includes(heroMedia.type)) fail(item.id+': unsupported media.hero.type '+heroMedia.type);
    if(heroMedia.type==='art-directed'&&!String(heroMedia.theme||'').trim()) fail(item.id+': art-directed media hero requires a theme');
    if(heroMedia.type==='image'){
      if(!String(heroMedia.asset||'').trim()) fail(item.id+': image media hero requires an asset');
      if(!String(heroMedia.attribution||'').trim()) fail(item.id+': image media hero requires attribution');
      if(!String(heroMedia.license||'').trim()) fail(item.id+': image media hero requires license metadata');
    }
  }

  const entry = trip.entryGuidance;
  if (entry) {
    for (const id of [entry.officialResolverSourceId,...(entry.supportingSourceIds||[])].filter(Boolean)) if (!sourceIds.has(id)) fail(item.id+': entry guidance references missing source '+id);
    if (entry.personalizationRequired !== true) fail(item.id+': entry guidance must require traveller personalization');
    const entryDestinations=Array.isArray(entry.destinations)&&entry.destinations.length?entry.destinations:[entry.destinationCountry].filter(Boolean);
    if (!entryDestinations.length) fail(item.id+': entry guidance requires destinationCountry or destinations');
    for (const code of entryDestinations) if (!(trip.geography?.countries||[]).includes(code)) fail(item.id+': entry guidance destination '+code+' must be part of trip geography');
    if (!String(entry.tripPurpose||'').trim()) fail(item.id+': entry guidance requires tripPurpose');
    if (!entry.message || (typeof entry.message==='object'&&!Object.keys(entry.message).length)) fail(item.id+': entry guidance requires a user-facing message');
    const resolver=sourceById.get(entry.officialResolverSourceId);
    if (resolver&&!['government','international-organization'].includes(resolver.issuerType)) fail(item.id+': entry guidance resolver must be a government or international-organization source');
  }
}

const knowledgeIds=new Set();
for(const entry of sharedKnowledge.items||[]){
  if(!entry.id||knowledgeIds.has(entry.id)) fail('shared knowledge ids must be unique: '+entry.id); else knowledgeIds.add(entry.id);
  if(!entry.type) fail('shared knowledge '+entry.id+': type required');
  if(entry.type!=='planning-policy'&&entry.sourceRequired!==false){
    if(!/^https:\/\//.test(String(entry.source?.url||''))) fail('shared knowledge '+entry.id+': factual entry requires https source.url');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.checkedAt||''))) fail('shared knowledge '+entry.id+': factual entry requires checkedAt');
  }
}

const collectionIds=new Set();
for(const collection of collections.collections||[]){
  if(!collection.id||collectionIds.has(collection.id)) fail('collection ids must be unique: '+collection.id); else collectionIds.add(collection.id);
  if(!collection.filters||typeof collection.filters!=='object') fail('collection '+collection.id+': filters required');
  if(collection.filters.duration&&!['7-14','15-30','31-89','90-plus'].includes(collection.filters.duration)) fail('collection '+collection.id+': invalid duration filter');
  if(collection.filters.themeAny&&!Array.isArray(collection.filters.themeAny)) fail('collection '+collection.id+': themeAny must be an array');
  if(collection.filters.modeAny&&!Array.isArray(collection.filters.modeAny)) fail('collection '+collection.id+': modeAny must be an array');
  if(collection.filters.kind&&typeof collection.filters.kind!=='string') fail('collection '+collection.id+': kind must be a string');
  if(collection.filters.pace&&typeof collection.filters.pace!=='string') fail('collection '+collection.id+': pace must be a string');
  if(collection.filters.party&&typeof collection.filters.party!=='string') fail('collection '+collection.id+': party must be a string');
  if(collection.filters.accessibility&&typeof collection.filters.accessibility!=='string') fail('collection '+collection.id+': accessibility must be a string');
  for(const lang of supportedLocales){
    if(!String(collection.title?.[lang]||'').trim()) fail('collection '+collection.id+': missing title for '+lang);
    if(!String(collection.description?.[lang]||'').trim()) fail('collection '+collection.id+': missing description for '+lang);
  }
}

for (const [id,profile] of experienceProfiles) {
  for (const lang of supportedLocales) if (!String(profile.essence?.[lang]||'').trim()) fail('place experience '+id+': missing essence for '+lang);
}
if (failed) process.exit(1);
console.log('Platform data validation complete:', catalog.trips.length, 'trips;', collectionIds.size, 'collections; shared knowledge', knowledgeIds.size, 'items; place experiences', experienceProfiles.size, 'profiles; flagship invariants 195 countries / 194 international legs preserved');
