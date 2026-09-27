import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildFlagshipRecheckPlan,evaluateFlagshipRechecks} from './flagship-recheck-model.mjs';

const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));

test('flagship recheck plan is deterministic, complete and never auto-promotes blockers',async()=>{
  const inputs={
    route:await read('public-route.json'),
    operations:await read('operational-movements.json'),
    queue:await read('flagship-operations-queue.json'),
    criticalReviews:await read('critical-leg-reviews.json'),
  };
  const generated=buildFlagshipRecheckPlan(inputs);
  const committed=await read('flagship-recheck-plan.json');

  assert.deepEqual(committed,generated);
  assert.equal(generated.tripId,'world-195');
  assert.equal(generated.summary.total,43);
  assert.equal(generated.summary.blocking,43);
  assert.equal(generated.summary.byCategory['international-leg'],35);
  assert.equal(generated.summary.byCategory['operational-movement'],8);
  assert.equal(generated.summary.byDecision.hold,38);
  assert.equal(generated.summary.byDecision.blocked,5);
  assert.equal(generated.summary.scheduledTaskCount,42);
  assert.equal(generated.summary.conditionWatchOnlyTaskCount,1);
  assert.equal(generated.summary.milestoneCount,84);
  assert.equal(generated.summary.nextScheduledRecheck,'2026-11-01');
  assert.ok(generated.tasks.every(task=>task.releaseControl.manualReviewRequired===true));
  assert.ok(generated.tasks.every(task=>task.releaseControl.autoPromote===false));
  assert.ok(generated.tasks.every(task=>['hold','blocked'].includes(task.decision)));

  const leg13=generated.tasks.find(task=>task.id==='leg-13');
  assert.equal(leg13.targetDate,'2026-11-08');
  assert.deepEqual(leg13.scheduledRechecks.map(item=>item.dueOn),['2026-11-01','2026-11-06']);

  const noDate=generated.tasks.find(task=>task.id==='movement-transfer-97-98');
  assert.equal(noDate.targetDate,null);
  assert.equal(noDate.monitoringMode,'condition-watch');
  assert.deepEqual(noDate.scheduledRechecks,[]);

  const current=evaluateFlagshipRechecks(generated,{asOf:'2026-09-27'});
  assert.equal(current.summary.requiresAction,0);

  const firstDue=evaluateFlagshipRechecks(generated,{asOf:'2026-11-01'});
  assert.equal(firstDue.summary.due,1);
  assert.equal(firstDue.due[0].taskId,'leg-13');
  assert.equal(firstDue.due[0].milestone,'pre-departure-7d');

  const reviewed=structuredClone(generated);
  reviewed.tasks.find(task=>task.id==='leg-13').reviewedAt='2026-11-01';
  const satisfied=evaluateFlagshipRechecks(reviewed,{asOf:'2026-11-01'});
  assert.equal(satisfied.summary.requiresAction,0);
});
