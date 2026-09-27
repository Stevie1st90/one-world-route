import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/journey-adapter.js',import.meta.url),'utf8');

function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,structuredClone:globalThis.structuredClone};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.journeyAdapter;
}

const trip={
  id:'demo',
  kind:'rail',
  routePolicy:{startMode:'endpoints',reversible:true,reverseEvidenceReusable:false,reversePlanningReusable:false},
  stops:[
    {id:'s1',sequence:1,placeId:'a',dayStart:1,dayEnd:2},
    {id:'s2',sequence:2,placeId:'b',dayStart:3,dayEnd:3},
    {id:'s3',sequence:3,placeId:'c',dayStart:4,dayEnd:5}
  ],
  segments:[
    {id:'l1',sequence:1,fromStopId:'s1',toStopId:'s2',planning:{durationMinutes:90,cost:{amount:10}},verification:{status:'verified',sourceIds:['x'],lastVerified:'2026-09-01'}},
    {id:'l2',sequence:2,fromStopId:'s2',toStopId:'s3',planning:{durationMinutes:80,cost:{amount:12}},verification:{status:'verified',sourceIds:['y'],lastVerified:'2026-09-01'}}
  ]
};

test('endpoint personalization exposes both route ends',()=>{
  const adapter=load();
  assert.deepEqual(Array.from(adapter.eligibleStartStops(trip),x=>String(x.id)),['s1','s3']);
});

test('reverse variant safely reverses route and invalidates directional evidence',()=>{
  const adapter=load();
  const reversed=adapter.apply(trip,{startStopId:'s3'});
  assert.deepEqual(Array.from(reversed.stops,x=>String(x.id)),['s3','s2','s1']);
  assert.deepEqual(Array.from(reversed.segments,x=>[String(x.fromStopId),String(x.toStopId)]),[['s3','s2'],['s2','s1']]);
  assert.equal(reversed.segments[0].verification.status,'draft');
  assert.equal(Array.from(reversed.segments[0].verification.sourceIds).length,0);
  assert.equal(reversed.segments[0].planning.durationMinutes,null);
  assert.equal(reversed._personalization.direction,'reverse');
});

test('fixed routes ignore alternative start requests',()=>{
  const adapter=load();
  const fixed={...trip,routePolicy:{startMode:'fixed',reversible:false}};
  const result=adapter.apply(fixed,{startStopId:'s3'});
  assert.deepEqual(Array.from(result.stops,x=>String(x.id)),['s1','s2','s3']);
  assert.equal(result._personalization.direction,'forward');
});

test('rotatable loops move the chosen stop to the front without breaking the cycle',()=>{
  const adapter=load();
  const loop={
    id:'loop',
    routePolicy:{startMode:'any-stop',reversible:false,originMode:'traveller-context'},
    places:[{id:'a',name:{en:'A'}},{id:'b',name:{en:'B'}},{id:'c',name:{en:'C'}}],
    stops:[
      {id:'s1',sequence:1,placeId:'a',dayStart:1,dayEnd:1},
      {id:'s2',sequence:2,placeId:'b',dayStart:2,dayEnd:2},
      {id:'s3',sequence:3,placeId:'c',dayStart:3,dayEnd:3}
    ],
    segments:[
      {id:'l1',sequence:1,fromStopId:'s1',toStopId:'s2'},
      {id:'l2',sequence:2,fromStopId:'s2',toStopId:'s3'},
      {id:'l3',sequence:3,fromStopId:'s3',toStopId:'s1'}
    ]
  };
  const result=adapter.apply(loop,{startStopId:'s2'});
  assert.deepEqual(Array.from(result.stops,x=>String(x.id)),['s2','s3','s1']);
  assert.deepEqual(Array.from(result.segments,x=>[String(x.fromStopId),String(x.toStopId)]),[['s2','s3'],['s3','s1'],['s1','s2']]);
  assert.equal(result._personalization.rotation,1);
});

test('origin plan keeps access and return separate from the curated core journey',()=>{
  const adapter=load();
  const withPlaces={...trip,places:[{id:'a',name:{en:'A'}},{id:'b',name:{en:'B'}},{id:'c',name:{en:'C'}}],routePolicy:{...trip.routePolicy,originMode:'traveller-context',originAccess:'dynamic',returnMode:'to-origin',preserveCoreRoute:true}};
  const plan=adapter.originPlan(withPlaces,{origin:'Frankfurt',originRegion:'europe'});
  assert.equal(plan.structure,'origin-access-core-return');
  assert.equal(plan.access.from,'Frankfurt');
  assert.equal(plan.core.startPlaceId,'a');
  assert.equal(plan.core.endPlaceId,'c');
  assert.equal(plan.return.to,'Frankfurt');
  assert.equal(plan.preserveCoreRoute,true);
});
