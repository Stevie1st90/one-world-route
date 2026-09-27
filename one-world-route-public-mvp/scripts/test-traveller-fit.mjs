import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/traveller-fit.js',import.meta.url),'utf8');

function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,console};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.travellerFit;
}

test('Traveller Fit derives transparent party context without ranking routes',()=>{
  const fit=load();
  assert.equal(fit.partyKey({party:{adults:1,children:0}}),'solo');
  assert.equal(fit.partyKey({party:{adults:2,children:0}}),'couples');
  assert.equal(fit.partyKey({party:{adults:4,children:0}}),'friends');
  assert.equal(fit.partyKey({party:{adults:2,children:1}}),'families');
});

test('Traveller Fit reports explicit checks from published metadata and local context',()=>{
  const fit=load();
  const meta={
    capabilities:['vehicle-context'],
    discovery:{fit:{party:['couples','friends'],accessibility:'vehicle-dependent',startRegion:'europe',pace:'active',seasons:['spring','autumn']}}
  };
  const result=fit.evaluate(meta,{
    origin:'Frankfurt',
    party:{adults:2,children:1},
    accessibility:{reducedMobility:true},
    vehicle:null
  });
  assert.equal(result.party,'families');
  assert.equal(result.partyListed,false);
  assert.equal(result.needsMobilityCheck,true);
  assert.equal(result.vehicleContextMissing,true);
  assert.equal(result.origin,'Frankfurt');
  assert.deepEqual(JSON.parse(JSON.stringify(result.seasons)),['spring','autumn']);
});

test('traveller fit exposes explicit origin region without inferring it from free text',()=>{
  const fit=load();
  const result=fit.evaluate({discovery:{fit:{party:['solo'],seasons:['spring'],startRegion:'europe',accessibility:'standard-check'}},capabilities:[]},{origin:'Frankfurt / FRA',originRegion:'europe',party:{adults:1,children:0}});
  assert.equal(result.origin,'Frankfurt / FRA');
  assert.equal(result.originRegion,'europe');
  assert.equal(result.startRegion,'europe');
});

test('recommendation reasons expose why a route fits without exposing a magic score',()=>{
  const fit=load();
  const meta={discovery:{modes:['rail'],fit:{party:['couples'],startRegion:'europe',pace:'balanced',seasons:['spring'],accessibility:'standard-check'}},capabilities:[]};
  const profile={origin:'Frankfurt',originRegion:'europe',party:{adults:2,children:0}};
  assert.deepEqual(JSON.parse(JSON.stringify(fit.recommendationReasons(meta,profile))),[
    {kind:'origin',value:'europe'},
    {kind:'party',value:'couples'},
    {kind:'mode',value:'rail'}
  ]);
});
