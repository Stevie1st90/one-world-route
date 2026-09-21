import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async rel => JSON.parse(await readFile(new URL(rel, root), 'utf8'));
const catalog = await readJson('data/platform/trips.json');
const world = await readJson('data/public-route.json');
const allowedModes = new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);
let failed = false;
const fail = m => { failed = true; console.error('PLATFORM VALIDATION:', m); };
const ids = new Set();
const slugs = new Set();
if (!Array.isArray(catalog.trips) || catalog.trips.length < 2) fail('Trip catalog must contain the flagship and at least one reusable trip');
for (const trip of catalog.trips || []) {
  if (!trip.id || ids.has(trip.id)) fail('Trip IDs must be unique: '+trip.id); else ids.add(trip.id);
  if (!trip.slug || slugs.has(trip.slug)) fail('Trip slugs must be unique: '+trip.slug); else slugs.add(trip.slug);
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
  const placeIds = new Set();
  for (const p of trip.places || []) {
    if (!p.id || placeIds.has(p.id)) fail(item.id+': duplicate place '+p.id); else placeIds.add(p.id);
    if (!Number.isFinite(p.coordinates?.lat) || !Number.isFinite(p.coordinates?.lng)) fail(item.id+': place '+p.id+' requires coordinates');
  }
  const stopIds = new Set();
  const orderedStops = [...(trip.stops || [])].sort((a,b)=>a.sequence-b.sequence);
  for (const s of orderedStops) {
    if (!s.id || stopIds.has(s.id)) fail(item.id+': duplicate stop '+s.id); else stopIds.add(s.id);
    if (!placeIds.has(s.placeId)) fail(item.id+': stop '+s.id+' references missing place '+s.placeId);
  }
  const segs = [...(trip.segments || [])].sort((a,b)=>a.sequence-b.sequence);
  if (segs.length !== Math.max(0, orderedStops.length-1)) fail(item.id+': segments must connect each adjacent stop visit');
  for (let i=0;i<segs.length;i++) {
    const s=segs[i], from=orderedStops[i], to=orderedStops[i+1];
    if (s.fromStopId!==from?.id || s.toStopId!==to?.id) fail(item.id+': non-continuous segment '+s.id);
    if (!allowedModes.has(s.transport?.mode)) fail(item.id+': unsupported transport mode '+s.transport?.mode);
    if (!['current-check-required','verified','draft','illustrative'].includes(s.verification?.status)) fail(item.id+': invalid verification status on '+s.id);
  }
}

if (failed) process.exit(1);
console.log('Platform data validation complete:', catalog.trips.length, 'trips; flagship invariants 195 countries / 194 international legs preserved');
