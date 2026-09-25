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
