import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const fitSource=await readFile(new URL('../platform/traveller-fit.js',import.meta.url),'utf8');
const source=await readFile(new URL('../platform/trip-compare.js',import.meta.url),'utf8');

function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,document:{},Intl,console};
  vm.createContext(context);
  vm.runInContext(fitSource,context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.tripCompare;
}

test('journey compare derives only transparent party context',()=>{
  const compare=load();
  assert.equal(compare.derivedParty({party:{adults:1,children:0}}),'solo');
  assert.equal(compare.derivedParty({party:{adults:2,children:0}}),'couples');
  assert.equal(compare.derivedParty({party:{adults:3,children:0}}),'friends');
  assert.equal(compare.derivedParty({party:{adults:2,children:1}}),'families');
});

test('journey compare caps selections at three without ranking them',()=>{
  const compare=load(),selection=new Set();
  assert.equal(compare.toggle(selection,'a',3).selected,true);
  assert.equal(compare.toggle(selection,'b',3).selected,true);
  assert.equal(compare.toggle(selection,'c',3).selected,true);
  assert.equal(compare.toggle(selection,'d',3).limit,true);
  assert.deepEqual([...selection],['a','b','c']);
  assert.equal(compare.toggle(selection,'b',3).selected,false);
  assert.deepEqual([...selection],['a','c']);
});
