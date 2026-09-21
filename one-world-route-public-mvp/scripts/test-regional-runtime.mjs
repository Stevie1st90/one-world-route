import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const readText=rel=>readFile(new URL('../'+rel,import.meta.url),'utf8');
const readJson=async rel=>JSON.parse(await readText(rel));

async function loadRuntime(){
  const nodes=[];
  const document={
    querySelectorAll(){return nodes}
  };
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,document,Map,Set,Object,Array,Number,Math,String,console};
  vm.createContext(context);
  for(const rel of [
    'platform/runtime.js',
    'platform/model.js',
    'platform/extensions.js',
    'platform/extensions/cruise.js',
    'platform/extensions/road.js',
    'platform/extensions/border.js',
    'platform/regional-selection.js'
  ]){
    vm.runInContext(await readText(rel),context,{filename:rel});
  }
  return {window,document,nodes};
}

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const local=value=>typeof value==='string'?value:value?.en||Object.values(value||{})[0]||'';
const t=key=>key;

test('regional runtime composes every current regional dataset without route-kind branching',async()=>{
  const catalog=await readJson('data/platform/trips.json');
  const {window}=await loadRuntime();
  const modules=window.ONE_WORLD_PLATFORM_MODULES;
  assert.deepEqual(Array.from(modules.runtime.listExtensions(),extension=>extension.id),['cruise','road','border']);

  const regional=catalog.trips.filter(item=>item.renderer==='regional-globe');
  assert.ok(regional.length>=1,'catalog must expose at least one regional trip');

  for(const item of regional){
    const trip=await readJson(item.dataset.replace(/^\.\//,''));
    const geometry=modules.model.routeGeometry(trip);
    const bounds=modules.model.routeBounds(trip);
    assert.equal(geometry.length,trip.segments.length,item.id+' route geometry');
    assert.ok(bounds,item.id+' route bounds');

    const base={trip,profile:{},t,esc,local};
    const overview=modules.extensions.composeTripOverview(base);
    assert.equal(typeof overview.cards,'string',item.id+' overview cards');
    assert.equal(typeof overview.notices,'string',item.id+' overview notices');

    const stop=trip.stops[0];
    const place=modules.model.stopPlace(trip,stop);
    const stopDetail=modules.extensions.composeStopDetail({...base,stop,place});
    assert.equal(typeof stopDetail.cards,'string',item.id+' stop cards');
    assert.ok(Array.isArray(stopDetail.sourceIds),item.id+' stop source ids');

    const segment=trip.segments[0];
    const segmentDetail=modules.extensions.composeSegmentDetail({...base,segment});
    assert.equal(typeof segmentDetail.panels,'string',item.id+' segment panels');
    assert.ok(Array.isArray(segmentDetail.sourceIds),item.id+' segment source ids');
  }
});

test('specialized presenter output is attached only when matching namespaced data exists',async()=>{
  const catalog=await readJson('data/platform/trips.json');
  const {window}=await loadRuntime();
  const modules=window.ONE_WORLD_PLATFORM_MODULES;

  const byId=new Map(catalog.trips.map(item=>[item.id,item]));
  const italy=await readJson(byId.get('italy-grand-tour').dataset.replace(/^\.\//,''));
  const cruise=await readJson(byId.get('western-mediterranean-cruise-loop').dataset.replace(/^\.\//,''));
  const road=await readJson(byId.get('southern-europe-road-trip').dataset.replace(/^\.\//,''));

  const italyOverview=modules.extensions.composeTripOverview({trip:italy,profile:{},t,esc,local});
  assert.equal(italyOverview.cards,'');
  assert.equal(italyOverview.notices,'');

  const cruiseOverview=modules.extensions.composeTripOverview({trip:cruise,profile:{},t,esc,local});
  assert.match(cruiseOverview.cards,/onboardNights/);
  assert.match(cruiseOverview.cards,/seaDays/);

  const roadOverview=modules.extensions.composeTripOverview({trip:road,profile:{},t,esc,local});
  assert.match(roadOverview.notices,/vehicleNeeded/);

  const roadWithVehicle=modules.extensions.composeTripOverview({trip:road,profile:{vehicle:{type:'car'}},t,esc,local});
  assert.equal(roadWithVehicle.notices,'');
});

test('selection controller coordinates real regional trips through callbacks',async()=>{
  const catalog=await readJson('data/platform/trips.json');
  const {window,nodes}=await loadRuntime();
  const modules=window.ONE_WORLD_PLATFORM_MODULES;
  const model=modules.model;
  const regional=catalog.trips.filter(item=>item.renderer==='regional-globe');

  for(const item of regional){
    const trip=await readJson(item.dataset.replace(/^\.\//,''));
    nodes.splice(0,nodes.length,...trip.stops.map(()=>({
      classList:{
        remove(){},
        toggle(){}
      }
    })));

    const calls={
      globe:0,timeline:0,segment:0,stop:0,terrain:0,story:0,
      terrainFocus:[],globeSegment:[],globePlace:[]
    };
    modules.regionalSelection.configure({
      getTrip:()=>trip,
      stopPlace:model.stopPlace,
      renderGlobe:()=>calls.globe++,
      updateTimeline:()=>calls.timeline++,
      renderSegmentDetail:()=>calls.segment++,
      renderStopDetail:()=>calls.stop++,
      updateTerrain:()=>calls.terrain++,
      isStoryActive:()=>true,
      updateStory:()=>calls.story++,
      isTerrainActive:()=>false,
      focusTerrainSegment:index=>calls.terrainFocus.push(index),
      focusGlobeSegment:segment=>calls.globeSegment.push(segment.id),
      focusGlobePlace:place=>calls.globePlace.push(place.id)
    });

    assert.equal(modules.regionalSelection.reset(0),0,item.id+' reset');
    assert.equal(modules.regionalSelection.selectSegment(1,true),1,item.id+' select segment');
    assert.equal(modules.regionalSelection.getIndex(),1,item.id+' selected index');
    assert.equal(calls.globe,1,item.id+' globe render');
    assert.equal(calls.timeline,1,item.id+' timeline update');
    assert.equal(calls.segment,1,item.id+' segment detail');
    assert.equal(calls.terrain,1,item.id+' terrain update');
    assert.equal(calls.story,1,item.id+' story update');
    assert.equal(calls.globeSegment.length,1,item.id+' segment focus');

    const stopIndex=Math.min(2,trip.stops.length-1);
    modules.regionalSelection.selectStop(stopIndex,true);
    assert.equal(calls.stop,1,item.id+' stop detail');
    assert.equal(calls.globePlace.length,1,item.id+' place focus');
  }
});

test('selection controller clamps segment indices for every regional route',async()=>{
  const catalog=await readJson('data/platform/trips.json');
  const {window}=await loadRuntime();
  const selection=window.ONE_WORLD_PLATFORM_MODULES.regionalSelection;

  for(const item of catalog.trips.filter(item=>item.renderer==='regional-globe')){
    const trip=await readJson(item.dataset.replace(/^\.\//,''));
    selection.configure({
      getTrip:()=>trip,
      stopPlace:window.ONE_WORLD_PLATFORM_MODULES.model.stopPlace,
      renderGlobe(){},updateTimeline(){},renderSegmentDetail(){},renderStopDetail(){},updateTerrain(){},
      isStoryActive:()=>false,updateStory(){},isTerrainActive:()=>false,
      focusTerrainSegment(){},focusGlobeSegment(){},focusGlobePlace(){}
    });
    assert.equal(selection.reset(-99),0,item.id+' lower clamp');
    assert.equal(selection.reset(999),trip.segments.length-1,item.id+' upper clamp');
  }
});
