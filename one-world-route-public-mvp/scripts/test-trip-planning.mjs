import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/trip-planning.js',import.meta.url),'utf8');

function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,Intl,console};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.tripPlanning;
}

test('planning snapshot distinguishes unknown fares from zero',()=>{
  const planning=load();
  const snapshot=planning.snapshot({
    planning:{days:8,currency:'EUR',knownPublishedMinimumEur:null},
    stops:[{nights:2},{nights:3}],
    segments:[
      {planning:{cost:{amount:null}}},
      {planning:{cost:{amount:0}}},
      {planning:{cost:{amount:12.5}}},
      {}
    ],
    sources:[]
  },{discovery:{fit:{}}});
  assert.equal(snapshot.knownPublishedMinimum,null);
  assert.equal(snapshot.knownCosts,2);
  assert.equal(snapshot.totalSegments,4);
  assert.equal(snapshot.nights,5);
});

test('planning snapshot keeps source and verification coverage transparent',()=>{
  const planning=load();
  const snapshot=planning.snapshot({
    planning:{days:3,currency:'EUR',knownPublishedMinimumEur:20},
    stops:[{nights:2}],
    segments:[
      {verification:{status:'verified',sourceIds:['a']}},
      {verification:{status:'current-check-required',sourceIds:['b']}}
    ],
    sources:[{checkedAt:'2026-09-20'},{checkedAt:'2026-09-23'}]
  },{discovery:{fit:{pace:'balanced',seasons:['spring']}}});
  assert.equal(snapshot.knownPublishedMinimum,20);
  assert.equal(snapshot.sourced,2);
  assert.equal(snapshot.verified,1);
  assert.equal(snapshot.latestEvidenceCheck,'2026-09-23');
});
