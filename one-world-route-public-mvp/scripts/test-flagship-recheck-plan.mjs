import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildFlagshipRecheckPlan} from './flagship-recheck-plan-model.mjs';

const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));

test('flagship recheck plan is deterministic and covers every blocking P0 review',async()=>{
  const inputs={
    route:await read('public-route.json'),
    operations:await read('operational-movements.json'),
    criticalReviews:await read('critical-leg-reviews.json'),
    readiness:await read('flagship-readiness.json'),
  };
  const generated=buildFlagshipRecheckPlan(inputs);
  const committed=await read('flagship-recheck-plan.json');

  assert.deepEqual(committed,generated);
  assert.equal(generated.schemaVersion,1);
  assert.equal(generated.tripId,'world-195');
  assert.equal(generated.summary.total,43);
  assert.equal(generated.summary.internationalLegs,35);
  assert.equal(generated.summary.operationalMovements,8);
  assert.equal(generated.summary.hold,38);
  assert.equal(generated.summary.blocked,5);
  assert.equal(generated.summary.unscheduledTravelDate,1);
  assert.equal(generated.summary.dueAtDataAsOf,0);
  assert.equal(generated.summary.nextScheduledRecheck,'2026-11-01');

  const blockedInterKorean=generated.items.find(item=>item.id==='movement-transfer-97-98');
  assert.equal(blockedInterKorean.currentDecision,'blocked');
  assert.equal(blockedInterKorean.travelDate,null);
  assert.equal(blockedInterKorean.travelDateBasis,'external-change-only');
  assert.equal(blockedInterKorean.schedule.tMinus7.state,'unscheduled');
  assert.equal(blockedInterKorean.schedule.tMinus48h.state,'unscheduled');

  const firstCritical=generated.items.find(item=>item.id==='leg-13');
  assert.equal(firstCritical.travelDate,'2026-11-08');
  assert.equal(firstCritical.schedule.tMinus7.date,'2026-11-01');
  assert.equal(firstCritical.schedule.tMinus48h.date,'2026-11-06');

  for(const item of generated.items){
    assert.ok(['hold','blocked'].includes(item.currentDecision));
    assert.equal(item.blocksDeparture,true);
    assert.ok(Array.isArray(item.triggerOn)&&item.triggerOn.length>0);
    assert.ok(Array.isArray(item.dependencyLegs)&&item.dependencyLegs.length>0);
    if(item.travelDate){
      assert.match(item.travelDate,/^\d{4}-\d{2}-\d{2}$/);
      assert.ok(item.schedule.tMinus7.date<item.schedule.tMinus48h.date);
      assert.ok(item.schedule.tMinus48h.date<item.travelDate);
    }
  }
});
