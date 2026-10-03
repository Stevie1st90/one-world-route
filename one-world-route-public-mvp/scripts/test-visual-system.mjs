import test from 'node:test';
import assert from 'node:assert/strict';
import {familyProfile,productionStrategyFor,visualFamily,visualSystemContract} from './visual-system.mjs';

test('visual families classify future journey types deterministically',()=>{
  assert.equal(visualFamily({kind:'world'}),'planetary');
  assert.equal(visualFamily({kind:'rail'}),'rail-cinematic');
  assert.equal(visualFamily({kind:'road-trip'}),'road-cinematic');
  assert.equal(visualFamily({kind:'cruise'}),'coastal-editorial');
  assert.equal(visualFamily({kind:'island-hopping'}),'coastal-editorial');
  assert.equal(visualFamily({kind:'round-trip',discovery:{themes:['wildlife']}}),'nature-atmospheric');
  assert.equal(visualFamily({kind:'round-trip',discovery:{themes:['culture']}}),'culture-editorial');
  assert.equal(visualFamily({kind:'round-trip',visual:{visualFamily:'rail-cinematic'}}),'rail-cinematic');
});

test('family profiles carry reusable composition and strategy policy',()=>{
  for(const id of ['road-cinematic','rail-cinematic','nature-atmospheric','coastal-editorial','culture-editorial','planetary']){
    const profile=familyProfile(id);
    assert.ok(profile.scene);
    assert.ok(profile.archetype);
    assert.ok(profile.compositions.length>=1);
  }
  assert.equal(productionStrategyFor('planetary'),'deterministic-full-bleed-world-route');
  assert.equal(productionStrategyFor('rail-cinematic'),'single-generated-cover');
});

test('visual system contract freezes scalable 10-journey operating rules',()=>{
  const contract=visualSystemContract();
  assert.equal(contract.policyVersion,'journey-cover-system-v1');
  assert.equal(contract.batch.maxJourneys,10);
  assert.equal(contract.batch.operatorPromptsPerBatch,1);
  assert.equal(contract.batch.imageCallsPerJourney,1);
  assert.equal(contract.batch.imagesPerToolCall,1);
  assert.equal(contract.batch.singleCallMultiJourneyForbidden,true);
  assert.match(contract.batch.carryoverPolicy,/subject, geography, transport and composition must reset/);
  assert.deepEqual(contract.specialJourneys,[{tripId:'world-195',strategy:'deterministic-full-bleed-world-route'}]);
});
