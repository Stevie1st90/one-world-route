import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inventory,distanceKm} from './continuity-model.mjs';
const route={segments:[{id:1,from:'A',to:'B',corridor:'A → B1'},{id:2,from:'B',to:'C',corridor:'B2 → C'}]};
const points={1:[[0,0],[1,0]],2:[[2,0],[3,0]]};
const flights={geometries:{}};
const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));

test('missing endpoint is unresolved, never a centroid transfer',()=>assert.equal(inventory(route,{},flights)[0].classification,'unresolved-endpoint'));
test('different endpoints require a transfer',()=>assert.equal(inventory(route,points,flights)[0].classification,'transfer-required'));
test('same endpoint is continuous geometrically',()=>assert.equal(inventory(route,{...points,2:[[1,0],[3,0]]},flights)[0].classification,'shared-endpoint'));
test('country mismatch is reported even if geometry agrees',()=>assert.equal(inventory({segments:[route.segments[0],{...route.segments[1],from:'X'}]},points,flights)[0].classification,'country-mismatch'));
test('airport geometry takes precedence',()=>assert.equal(inventory(route,points,{geometries:{2:{coordinates:[[1,0],[3,0]]}}})[0].classification,'shared-endpoint'));
test('distance crosses antimeridian without going around the world',()=>assert.ok(distanceKm([179,0],[-179,0])<223));
test('route data preserves the macro contract and transit airports',async()=>{
  const r=await read('public-route.json'),f=await read('flight-geometries.json'),m=await read('operational-movements.json');
  assert.equal(r.segments.length,194);assert.equal(r.countries.length,195);
  assert.deepEqual(f.geometries['69'].airportCodes,['APW','NAN','FUN']);
  assert.equal(f.geometries['27'],undefined);assert.equal(f.geometries['78'],undefined);
  assert.equal(m.movements.find(x=>x.id==='transfer-21-22').actualCost,null);
});

test('playback inserts transfer without advancing macro selection and stop clears it',async()=>{
  const {runInNewContext}=await import('node:vm');
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const playback=source.slice(source.indexOf('  function play(){'),source.indexOf('  function toast('));
  let timer,active=null,selected=21;
  const state={playing:false,selectedSegmentId:21,speed:6000,settings:{autoRotate:false}};
  const buttons={textContent:'▶'};
  const movement={parentAfterLeg:21,status:'planned'};
  const context={state,$:()=>buttons,document:{body:{classList:{contains:()=>true}}},window:{ONE_WORLD_MOVEMENTS:{data:{movements:[movement]},show:m=>{active=m},clear:()=>{active=null}}},setTimeout:fn=>{timer=fn;return 1},clearTimeout:()=>{},selectSegment:n=>{selected=n;state.selectedSegmentId=n;active=null}};
  runInNewContext(playback+'\nplay();',context);
  timer();assert.equal(selected,21);assert.equal(active,movement);
  timer();assert.equal(selected,22);assert.equal(active,null);
  runInNewContext('stopPlay();',context);assert.equal(state.playing,false);assert.equal(buttons.textContent,'▶');assert.equal(active,null);
});
