import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

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

