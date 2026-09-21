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
