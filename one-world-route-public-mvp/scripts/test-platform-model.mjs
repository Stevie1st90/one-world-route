import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getPlatformExtension,validatePlatformExtensions} from './platform-extension-validators.mjs';

const read=async rel=>JSON.parse(await readFile(new URL('../'+rel,import.meta.url),'utf8'));

test('regional routes can revisit the same place through distinct stop visits',async()=>{
  const trip=await read('data/platform/trips/italy-grand-tour.json');
  const visits=trip.stops.filter(s=>s.placeId==='rome');
  assert.equal(visits.length,2);
  assert.notEqual(visits[0].id,visits[1].id);
  assert.equal(trip.segments.at(-1).toStopId,visits[1].id);
});

test('transport taxonomy is cruise and multimodal ready',async()=>{
  const schema=await read('data/platform/trip-schema.json');
  const modes=schema['x-oneWorldRoute'].transportModes;
  for(const mode of ['cruise','ferry','rail','road','flight','multimodal'])assert.ok(modes.includes(mode),mode);
  const cruiseLoop={
    places:[{id:'port-a'},{id:'port-b'}],
    stops:[{id:'a-1',placeId:'port-a'},{id:'b-1',placeId:'port-b'},{id:'a-2',placeId:'port-a'}],
    segments:[{fromStopId:'a-1',toStopId:'b-1',transport:{mode:'cruise'}},{fromStopId:'b-1',toStopId:'a-2',transport:{mode:'cruise'}}]
  };
  assert.equal(cruiseLoop.stops[0].placeId,cruiseLoop.stops[2].placeId);
  assert.notEqual(cruiseLoop.stops[0].id,cruiseLoop.stops[2].id);
  assert.ok(cruiseLoop.segments.every(s=>s.transport.mode==='cruise'));
});

test('traveller rules require evidence and never infer nationality from language',async()=>{
  const schema=await read('data/platform/traveller-rule-schema.json');
  assert.ok(schema.required.includes('evidence'));
  assert.equal(schema.properties.evidence.minItems,1);
  assert.match(schema.description,/Never infer passport citizenship or residence from language/i);
});

test('Italy sourced beta keeps evidence separate from unresolved schedule assumptions',async()=>{
  const trip=await read('data/platform/trips/italy-grand-tour.json');
  const sources=new Map(trip.sources.map(s=>[s.id,s]));
  assert.equal(trip.status,'sourced-beta');
  assert.equal(trip.segments.length,10);
  assert.equal(trip.segments.filter(s=>(s.verification?.sourceIds||[]).length>0).length,10);
  assert.equal(trip.segments.filter(s=>s.verification?.status==='verified').length,4);
  for(const s of trip.segments){
    for(const id of s.verification?.sourceIds||[])assert.ok(sources.has(id),id);
    if(s.verification?.status==='verified')assert.match(s.verification.lastVerified,/^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(trip.entryGuidance.personalizationRequired,true);
  assert.ok(sources.has(trip.entryGuidance.officialResolverSourceId));
  assert.match(trip.entryGuidance.message.en,/passport citizenship, country of residence/i);
});

test('Italy transport model includes sourced multimodal stages rather than fictional direct legs',async()=>{
  const trip=await read('data/platform/trips/italy-grand-tour.json');
  const byId=new Map(trip.segments.map(s=>[s.id,s]));
  assert.equal(byId.get('it-leg-02').transport.mode,'multimodal');
  assert.deepEqual(byId.get('it-leg-02').transport.stages.map(s=>s.mode),['rail','ferry']);
  assert.equal(byId.get('it-leg-03').verification.status,'current-check-required');
  assert.equal(byId.get('it-leg-07').verification.status,'current-check-required');
  assert.equal(byId.get('it-leg-09').transport.mode,'bus');
  assert.equal(byId.get('it-leg-10').transport.mode,'multimodal');
});

test('cruise demonstrator models repeated home port, onboard nights and sea days without fake places',async()=>{
  const trip=await read('data/platform/trips/western-mediterranean-cruise-loop.json');
  assert.equal(trip.kind,'cruise');
  const cruise=getPlatformExtension(trip,'cruise');
  assert.equal(cruise.nights,7);
  assert.equal(cruise.seaDays,1);
  assert.equal(trip.cruise,undefined);
  assert.equal(trip.stops[0].placeId,trip.stops.at(-1).placeId);
  assert.notEqual(trip.stops[0].id,trip.stops.at(-1).id);
  assert.equal(trip.places.some(p=>/sea.?day/i.test(p.id)||/sea.?day/i.test(String(p.name?.en||''))),false);
  assert.equal(trip.segments.reduce((n,s)=>n+Number(getPlatformExtension(s,'cruise')?.onboardNights||0),0),7);
  assert.deepEqual(trip.segments.flatMap(s=>getPlatformExtension(s,'cruise')?.seaDayNumbers||[]),[6]);
  assert.ok(trip.segments.every(s=>s.transport.mode==='cruise'));
  assert.ok(trip.segments.every(s=>s.verification.status==='illustrative'));
});

test('cruise border context detects Schengen exit and re-entry and requires traveller context',async()=>{
  const trip=await read('data/platform/trips/western-mediterranean-cruise-loop.json');
  const exit=trip.segments.find(s=>getPlatformExtension(s,'border')?.zoneTransition==='schengen-exit');
  const entry=trip.segments.find(s=>getPlatformExtension(s,'border')?.zoneTransition==='schengen-entry');
  assert.equal(getPlatformExtension(exit,'border').toCountry,'TN');
  assert.equal(getPlatformExtension(entry,'border').fromCountry,'TN');
  assert.equal(getPlatformExtension(exit,'border').personalizationRequired,true);
  assert.equal(getPlatformExtension(entry,'border').personalizationRequired,true);
  assert.equal(trip.entryGuidance.personalizationRequired,true);
  assert.ok(trip.sources.some(s=>s.id===trip.entryGuidance.officialResolverSourceId));
  assert.ok(trip.sources.some(s=>s.id==='eu-entry-exit-system'));
});

test('route discovery catalog has normalized filters for every public trip',async()=>{
  const catalog=await read('data/platform/trips.json');
  for(const trip of catalog.trips){
    assert.ok(trip.discovery);
    assert.ok(Array.isArray(trip.discovery.regions)&&trip.discovery.regions.length>0,trip.id);
    assert.ok(Array.isArray(trip.discovery.themes)&&trip.discovery.themes.length>0,trip.id);
    assert.ok(Array.isArray(trip.discovery.modes)&&trip.discovery.modes.length>0,trip.id);
    assert.ok(['7-14','15-30','31-89','90-plus'].includes(trip.discovery.durationBand),trip.id);
  }
  assert.equal(catalog.trips.find(t=>t.id==='southern-europe-road-trip').discovery.durationBand,'15-30');
});

test('Southern Europe road trip requires vehicle context and flags cross-border rental approval',async()=>{
  const trip=await read('data/platform/trips/southern-europe-road-trip.json');
  assert.equal(trip.kind,'road-trip');
  const roadTrip=getPlatformExtension(trip,'roadTrip');
  assert.equal(roadTrip.vehicleContextRequired,true);
  assert.equal(trip.roadTrip,undefined);
  assert.ok(trip.travellerContext.scope.includes('vehicle'));
  assert.equal(trip.geography.countries.length,4);
  assert.equal(trip.stops.length,11);
  assert.equal(trip.segments.length,10);
  assert.ok(trip.segments.every(s=>s.transport.mode==='car'));
  assert.ok(trip.segments.every(s=>getPlatformExtension(s,'road')));
  assert.ok(trip.segments.every(s=>(s.verification?.sourceIds||[]).length>0));
  const cross=trip.segments.filter(s=>getPlatformExtension(s,'road').crossBorder);
  assert.equal(cross.length,3);
  assert.ok(cross.every(s=>getPlatformExtension(s,'road').rentalApprovalRequired===true));
});

test('Vehicle Context schema avoids secret identifiers and supports road-rule inputs',async()=>{
  const schema=await read('data/platform/traveller-context-schema.json');
  const vehicle=schema.properties.vehicle;
  assert.ok(vehicle);
  assert.ok(vehicle.properties.registrationCountry);
  assert.ok(vehicle.properties.fuelType);
  assert.ok(vehicle.properties.euroClass);
  assert.ok(vehicle.properties.rentalCrossBorderApproved);
  assert.match(schema.description,/Never store passport numbers/i);
  assert.match(schema.description,/vehicle VINs/i);
});



test('Route Fit metadata stays transparent and complete',async()=>{
  const catalog=await read('data/platform/trips.json');
  const pace=new Set(['relaxed','balanced','active']);
  const seasons=new Set(['spring','summer','autumn','winter','multi-season']);
  const party=new Set(['solo','couples','friends','families']);
  for(const trip of catalog.trips){
    const fit=trip.discovery?.fit;
    assert.ok(fit,trip.id);
    assert.ok(pace.has(fit.pace),trip.id);
    assert.ok(fit.seasons.every(v=>seasons.has(v)),trip.id);
    assert.ok(fit.party.every(v=>party.has(v)),trip.id);
    assert.ok(fit.startRegion,trip.id);
    assert.ok(fit.accessibility,trip.id);
  }
  assert.equal(catalog.trips.find(t=>t.id==='italy-grand-tour').discovery.fit.pace,'balanced');
  assert.ok(catalog.trips.find(t=>t.id==='southern-europe-road-trip').discovery.fit.party.includes('families'));
});


test('extension validators allow open-jaw cruises without a loop-only assumption',()=>{
  const trip={
    extensions:{cruise:{nights:2,seaDays:0,embarkationStopId:'s1',disembarkationStopId:'s3',bookingState:'selected'}},
    sources:[],
    travellerContext:{scope:['passport']},
    places:[{id:'a',countryCode:'ES'},{id:'b',countryCode:'FR'},{id:'c',countryCode:'IT'}],
    stops:[{id:'s1',sequence:1,placeId:'a'},{id:'s2',sequence:2,placeId:'b'},{id:'s3',sequence:3,placeId:'c'}],
    segments:[
      {id:'x1',transport:{mode:'cruise'},extensions:{cruise:{onboardNights:1,seaDayNumbers:[],serviceStatus:'selected'}},verification:{sourceIds:[]}},
      {id:'x2',transport:{mode:'cruise'},extensions:{cruise:{onboardNights:1,seaDayNumbers:[],serviceStatus:'selected'}},verification:{sourceIds:[]}}
    ]
  };
  const stopById=new Map(trip.stops.map(s=>[s.id,s])),placeById=new Map(trip.places.map(p=>[p.id,p]));
  const errors=[];
  validatePlatformExtensions({item:{id:'open-jaw'},trip,orderedStops:trip.stops,segs:trip.segments,stopById,placeById,sourceIds:new Set(),fail:m=>errors.push(m)});
  assert.deepEqual(errors,[]);
  assert.notEqual(trip.stops[0].placeId,trip.stops.at(-1).placeId);
});

test('road extension allows non-driving connector segments such as ferries',()=>{
  const trip={
    extensions:{roadTrip:{vehicleContextRequired:true,vehicleOwnershipModes:['private','rental']}},
    travellerContext:{scope:['vehicle']},
    sources:[],
    places:[{id:'a',countryCode:'ES'},{id:'b',countryCode:'ES'},{id:'c',countryCode:'IT'}],
    stops:[{id:'s1',sequence:1,placeId:'a'},{id:'s2',sequence:2,placeId:'b'},{id:'s3',sequence:3,placeId:'c'}],
    segments:[
      {id:'drive',transport:{mode:'car'},extensions:{road:{crossBorder:false,fromCountry:'ES'}},verification:{sourceIds:['road-source']}},
      {id:'ferry',transport:{mode:'ferry'},verification:{sourceIds:['ferry-source']}}
    ]
  };
  const errors=[],stopById=new Map(trip.stops.map(s=>[s.id,s])),placeById=new Map(trip.places.map(p=>[p.id,p]));
  validatePlatformExtensions({item:{id:'road-ferry'},trip,orderedStops:trip.stops,segs:trip.segments,stopById,placeById,sourceIds:new Set(['road-source','ferry-source']),fail:m=>errors.push(m)});
  assert.deepEqual(errors,[]);
});


test('trip kind schema stays open for future route types',async()=>{
  const schema=await read('data/platform/trip-schema.json');
  assert.equal(schema.properties.kind.type,'string');
  assert.ok(schema.properties.kind.pattern);
  assert.equal(schema.properties.kind.enum,undefined);
  assert.ok(schema['x-oneWorldRoute'].extensionContract);
});

test('pilot specialized data uses namespaced extensions',async()=>{
  const cruise=await read('data/platform/trips/western-mediterranean-cruise-loop.json');
  const road=await read('data/platform/trips/southern-europe-road-trip.json');
  assert.ok(cruise.extensions?.cruise);
  assert.equal(cruise.cruise,undefined);
  assert.ok(cruise.stops.some(s=>s.extensions?.cruiseCall));
  assert.ok(cruise.segments.every(s=>s.extensions?.cruise));
  assert.ok(cruise.segments.some(s=>s.extensions?.border));
  assert.ok(cruise.places.some(p=>p.extensions?.port));
  assert.ok(road.extensions?.roadTrip);
  assert.equal(road.roadTrip,undefined);
  assert.ok(road.segments.every(s=>s.extensions?.road));
});
