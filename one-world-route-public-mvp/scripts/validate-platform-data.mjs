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
const supportedLocales = Array.isArray(catalog.supportedLocales)?catalog.supportedLocales:[];
if (!supportedLocales.length) fail('Catalog must declare supportedLocales');
if (!supportedLocales.includes(catalog.defaultLocale)) fail('defaultLocale must be included in supportedLocales');
if (!Array.isArray(catalog.trips) || catalog.trips.length < 2) fail('Trip catalog must contain the flagship and at least one reusable trip');
for (const trip of catalog.trips || []) {
  if (!trip.id || ids.has(trip.id)) fail('Trip IDs must be unique: '+trip.id); else ids.add(trip.id);
  if (!trip.slug || slugs.has(trip.slug)) fail('Trip slugs must be unique: '+trip.slug); else slugs.add(trip.slug);
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
    for (const id of p.port?.sourceIds || []) if (!sourceIds.has(id)) fail(item.id+': port '+p.id+' references missing source '+id);
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
  if (trip.kind === 'cruise') {
    if (!trip.cruise) fail(item.id+': cruise trip requires cruise metadata');
    if (!orderedStops.length || trip.cruise?.embarkationStopId !== orderedStops[0]?.id) fail(item.id+': cruise embarkation must be first stop');
    if (!orderedStops.length || trip.cruise?.disembarkationStopId !== orderedStops.at(-1)?.id) fail(item.id+': cruise disembarkation must be final stop');
    if (orderedStops[0]?.placeId !== orderedStops.at(-1)?.placeId) fail(item.id+': loop cruise demonstrator must return to the same home port place');
    const onboardNights=segs.reduce((n,s)=>n+Number(s.cruise?.onboardNights||0),0);
    const seaDayNumbers=segs.flatMap(s=>s.cruise?.seaDayNumbers||[]);
    if (onboardNights !== Number(trip.cruise?.nights||0)) fail(item.id+': cruise onboard night total mismatch');
    if (new Set(seaDayNumbers).size !== seaDayNumbers.length) fail(item.id+': duplicate cruise sea day');
    if (seaDayNumbers.length !== Number(trip.cruise?.seaDays||0)) fail(item.id+': cruise sea day total mismatch');
    for (const s of segs) {
      if (s.transport?.mode !== 'cruise') fail(item.id+': cruise segment '+s.id+' must use cruise mode');
      if (!s.cruise || s.cruise.serviceStatus !== 'illustrative') fail(item.id+': unselected cruise sailing must remain illustrative');
      const fromStop=stopById.get(s.fromStopId),toStop=stopById.get(s.toStopId);
      const fromCountry=placeById.get(fromStop?.placeId)?.countryCode,toCountry=placeById.get(toStop?.placeId)?.countryCode;
      if (s.borderContext?.fromCountry!==fromCountry || s.borderContext?.toCountry!==toCountry) fail(item.id+': border context mismatch on '+s.id);
      if (['schengen-exit','schengen-entry'].includes(s.borderContext?.zoneTransition) && s.borderContext?.personalizationRequired!==true) fail(item.id+': external Schengen transition must require traveller personalization on '+s.id);
    }
  }
  if (trip.kind === 'road-trip') {
    if (trip.roadTrip?.vehicleContextRequired !== true) fail(item.id+': road-trip must require Vehicle Context');
    if (!trip.travellerContext?.scope?.includes('vehicle')) fail(item.id+': road-trip traveller scope must include vehicle');
    for (const s of segs) {
      if (s.transport?.mode !== 'car') fail(item.id+': road-trip segment '+s.id+' must use car mode');
      if (!s.roadContext) fail(item.id+': road-trip segment '+s.id+' requires roadContext');
      if (s.roadContext?.crossBorder && s.roadContext?.rentalApprovalRequired !== true) fail(item.id+': cross-border road segment '+s.id+' must flag rental approval');
      if (!(s.verification?.sourceIds||[]).length) fail(item.id+': road-trip segment '+s.id+' requires source evidence');
    }
  }
  const entry = trip.entryGuidance;
  if (entry) {
    for (const id of [entry.officialResolverSourceId,...(entry.supportingSourceIds||[])].filter(Boolean)) if (!sourceIds.has(id)) fail(item.id+': entry guidance references missing source '+id);
    if (entry.personalizationRequired !== true) fail(item.id+': entry guidance must require traveller personalization');
  }
}

if (failed) process.exit(1);
console.log('Platform data validation complete:', catalog.trips.length, 'trips; flagship invariants 195 countries / 194 international legs preserved');
