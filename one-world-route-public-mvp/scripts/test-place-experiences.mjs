import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/place-experiences.js',import.meta.url),'utf8');

function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,console,Map,Set,Math,Number,String};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.placeExperiences;
}

function fetcher(fixtures,calls){
  return async url=>{
    calls.push(url);
    if(!(url in fixtures))return {ok:false,status:404,json:async()=>({})};
    return {ok:true,status:200,json:async()=>fixtures[url]};
  };
}

test('place experiences load only shards referenced by the active trip',async()=>{
  const experiences=load();
  const calls=[];
  const fixtures={
    './data/platform/place-experiences/index.json':{shards:[
      {countryCode:'JP',dataset:'./data/platform/place-experiences/JP.json'},
      {countryCode:'IT',dataset:'./data/platform/place-experiences/IT.json'}
    ]},
    './data/platform/place-experiences/JP.json':{profiles:[
      {id:'JP:tokyo',essence:{en:'Tokyo essence'},tags:['cities']}
    ]}
  };
  const trip={places:[
    {id:'tokyo',countryCode:'JP',experienceRef:'JP:tokyo'},
    {id:'kyoto',countryCode:'JP'}
  ]};
  const result=await experiences.loadForTrip(trip,{fetcher:fetcher(fixtures,calls)});
  assert.equal(result.requested,1);
  assert.equal(result.loaded,1);
  assert.deepEqual(calls,[
    './data/platform/place-experiences/index.json',
    './data/platform/place-experiences/JP.json'
  ]);
  assert.equal(experiences.resolve(trip.places[0]).id,'JP:tokyo');
  assert.equal(experiences.resolve(trip.places[1]),null);
});

test('place experience route roles are derived from itinerary structure',()=>{
  const experiences=load();
  const trip={stops:[
    {id:'a',sequence:1,dayStart:1,dayEnd:1},
    {id:'b',sequence:2,dayStart:2,dayEnd:5},
    {id:'c',sequence:3,dayStart:6,dayEnd:6},
    {id:'d',sequence:4,dayStart:7,dayEnd:8}
  ]};
  assert.equal(experiences.routeRole(trip,trip.stops[0]),'start');
  assert.equal(experiences.routeRole(trip,trip.stops[1]),'anchor');
  assert.equal(experiences.routeRole(trip,trip.stops[2]),'chapter');
  assert.equal(experiences.routeRole(trip,trip.stops[3]),'finale');
});

test('place experience renderer combines reusable content with route role',async()=>{
  const experiences=load();
  const trip={
    places:[{id:'tokyo',countryCode:'JP',experienceRef:'JP:tokyo'}],
    stops:[{id:'s1',sequence:1,placeId:'tokyo',dayStart:1,dayEnd:2}]
  };
  const calls=[];
  await experiences.loadForTrip(trip,{fetcher:fetcher({
    './data/platform/place-experiences/index.json':{shards:[{countryCode:'JP',dataset:'./data/platform/place-experiences/JP.json'}]},
    './data/platform/place-experiences/JP.json':{profiles:[{id:'JP:tokyo',essence:{en:'Urban culture and food.'},tags:['cities','food']}]}
  },calls)});
  const labels={whatToExpect:'What to expect',experienceRoleStart:'Route opening'};
  const html=experiences.render({
    trip,stop:trip.stops[0],place:trip.places[0],
    t:key=>labels[key]||key,
    esc:value=>String(value),
    local:value=>value?.en||'',
    facetLabel:value=>value==='cities'?'Cities':value==='food'?'Food':value
  });
  assert.match(html,/platform-stop-experience/);
  assert.match(html,/What to expect/);
  assert.match(html,/Route opening/);
  assert.match(html,/Urban culture and food/);
  assert.match(html,/Cities/);
  assert.match(html,/Food/);
});
