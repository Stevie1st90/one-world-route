import {readFile} from 'node:fs/promises';
import {validatePlatformExtensions} from './platform-extension-validators.mjs';

const root = new URL('../', import.meta.url);
const readJson = async rel => JSON.parse(await readFile(new URL(rel, root), 'utf8'));
const catalog = await readJson('data/platform/trips.json');
const world = await readJson('data/public-route.json');
const allowedModes = new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);
let failed = false;
const fail = m => { failed = true; console.error('PLATFORM VALIDATION:', m); };
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
  for (const src of trip.sources || []) {
    if (!src.id || sourceIds.has(src.id)) fail(item.id+': duplicate source '+src.id); else sourceIds.add(src.id);
    if (!/^https:\/\//.test(String(src.url||''))) fail(item.id+': source '+src.id+' requires https URL');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(src.checkedAt||''))) fail(item.id+': source '+src.id+' requires checkedAt date');
  }
  const placeIds = new Set();
  const placeById = new Map();
  for (const p of trip.places || []) {
    if (!p.id || placeIds.has(p.id)) fail(item.id+': duplicate place '+p.id); else placeIds.add(p.id);
    placeById.set(p.id,p);
    if (!Number.isFinite(p.coordinates?.lat) || !Number.isFinite(p.coordinates?.lng)) fail(item.id+': place '+p.id+' requires coordinates');
  }
  const stopIds = new Set();
  const stopById = new Map();
  const orderedStops = [...(trip.stops || [])].sort((a,b)=>a.sequence-b.sequence);
  for (const s of orderedStops) {
    if (!s.id || stopIds.has(s.id)) fail(item.id+': duplicate stop '+s.id); else stopIds.add(s.id);
    stopById.set(s.id,s);
    if (!placeIds.has(s.placeId)) fail(item.id+': stop '+s.id+' references missing place '+s.placeId);
  }
  const segs = [...(trip.segments || [])].sort((a,b)=>a.sequence-b.sequence);
  if (segs.length !== Math.max(0, orderedStops.length-1)) fail(item.id+': segments must connect each adjacent stop visit');
  for (let i=0;i<segs.length;i++) {
    const s=segs[i], from=orderedStops[i], to=orderedStops[i+1];
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
  const entry = trip.entryGuidance;
  if (entry) {
    for (const id of [entry.officialResolverSourceId,...(entry.supportingSourceIds||[])].filter(Boolean)) if (!sourceIds.has(id)) fail(item.id+': entry guidance references missing source '+id);
    if (entry.personalizationRequired !== true) fail(item.id+': entry guidance must require traveller personalization');
  }
}

if (failed) process.exit(1);
console.log('Platform data validation complete:', catalog.trips.length, 'trips; flagship invariants 195 countries / 194 international legs preserved');
