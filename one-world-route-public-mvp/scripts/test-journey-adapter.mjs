import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/journey-adapter.js',import.meta.url),'utf8');
const variantSource=await readFile(new URL('../platform/journey-variants.js',import.meta.url),'utf8');

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


test('starting country recommends the nearest policy-allowed route endpoint',()=>{
  const adapter=load();
  const japan={
    id:'japan',
    routePolicy:{startMode:'endpoints',reversible:true,originMode:'traveller-context'},
    places:[
      {id:'tokyo',coordinates:{lat:35.6762,lng:139.6503}},
      {id:'hiroshima',coordinates:{lat:34.3853,lng:132.4553}}
    ],
    stops:[
      {id:'tokyo-stop',sequence:1,placeId:'tokyo',dayStart:1,dayEnd:1},
      {id:'hiroshima-stop',sequence:2,placeId:'hiroshima',dayStart:2,dayEnd:2}
    ],
    segments:[
      {id:'leg',sequence:1,fromStopId:'tokyo-stop',toStopId:'hiroshima-stop',planning:{durationMinutes:1},verification:{status:'verified',sourceIds:['x']}}
    ]
  };
  const suggestion=adapter.recommendEntry(japan,{originCountry:'KR'},[{cca2:'KR',lat:35.9078,lng:127.7669}]);
  assert.equal(suggestion.available,true);
  assert.equal(suggestion.method,'country-centroid');
  assert.equal(suggestion.stopId,'hiroshima-stop');
  const adapted=adapter.apply(japan,{startStopId:suggestion.stopId,startSource:'suggested',entrySuggestion:suggestion});
  assert.equal(adapted.stops[0].id,'hiroshima-stop');
  assert.equal(adapted._personalization.startSource,'suggested');
  assert.equal(adapted._personalization.entrySuggestion.stopId,'hiroshima-stop');
});

test('entry recommendation never invents an alternative for a fixed route',()=>{
  const adapter=load();
  const fixed={...trip,places:[{id:'a',coordinates:{lat:50,lng:8}},{id:'b',coordinates:{lat:48,lng:11}},{id:'c',coordinates:{lat:47,lng:13}}],routePolicy:{startMode:'fixed',reversible:false}};
  const suggestion=adapter.recommendEntry(fixed,{originCountry:'DE'},[{cca2:'DE',lat:51,lng:10}]);
  assert.equal(suggestion.available,false);
  assert.equal(suggestion.reason,'fixed-route');
  assert.equal(suggestion.stopId,'s1');
});


function loadVariants(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,structuredClone:globalThis.structuredClone};
  vm.createContext(context);
  vm.runInContext(variantSource,context);
  return window.ONE_WORLD_PLATFORM_MODULES.journeyVariants;
}

test('journey variants derive a contiguous trip window without duplicating source data',()=>{
  const variants=loadVariants();
  const sourceTrip={
    id:'demo',
    title:{en:'Full'},
    planning:{days:6,pace:'balanced'},
    routePolicy:{startMode:'fixed',reversible:false},
    places:[{id:'a'},{id:'b'},{id:'c'},{id:'d'}],
    stops:[
      {id:'s1',sequence:1,placeId:'a',dayStart:1,dayEnd:2,nights:2},
      {id:'s2',sequence:2,placeId:'b',dayStart:3,dayEnd:3,nights:1},
      {id:'s3',sequence:3,placeId:'c',dayStart:4,dayEnd:5,nights:2},
      {id:'s4',sequence:4,placeId:'d',dayStart:6,dayEnd:6,nights:1}
    ],
    segments:[
      {id:'l1',sequence:1,fromStopId:'s1',toStopId:'s2'},
      {id:'l2',sequence:2,fromStopId:'s2',toStopId:'s3'},
      {id:'l3',sequence:3,fromStopId:'s3',toStopId:'s4'}
    ],
    chapters:[{id:'all',stopIds:['s1','s2','s3','s4']}],
    variants:[{
      id:'middle',
      title:{en:'Middle'},
      summary:{en:'Middle route'},
      startStopId:'s2',
      endStopId:'s3',
      pace:'active'
    }]
  };
  const result=variants.apply(sourceTrip,'middle');
  assert.deepEqual(Array.from(result.stops,x=>x.id),['s2','s3']);
  assert.deepEqual(Array.from(result.segments,x=>x.id),['l2']);
  assert.deepEqual(Array.from(result.places,x=>x.id),['b','c']);
  assert.deepEqual(Array.from(result.chapters[0].stopIds),['s2','s3']);
  assert.equal(result.planning.days,3);
  assert.equal(result.planning.pace,'active');
  assert.equal(result._variant.id,'middle');
  assert.equal(sourceTrip.stops.length,4);
});

test('unknown journey variant falls back to the full source journey',()=>{
  const variants=loadVariants();
  const sourceTrip={id:'demo',stops:[{id:'s1',sequence:1,placeId:'a',dayStart:1,dayEnd:1}],segments:[],places:[{id:'a'}],variants:[]};
  const result=variants.apply(sourceTrip,'missing');
  assert.equal(result._variant.id,'base');
  assert.equal(result._variant.adapted,false);
  assert.equal(result.stops.length,1);
});
