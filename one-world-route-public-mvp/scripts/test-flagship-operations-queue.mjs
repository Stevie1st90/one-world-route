import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildFlagshipReadiness} from './flagship-readiness-model.mjs';
import {buildFlagshipOperationsQueue} from './flagship-operations-queue-model.mjs';

const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));

test('operations queue is deterministic and exposes actionable blocking fields',async()=>{
  const inputs={
    route:await read('public-route.json'),
    waypoints:await read('route-waypoints.json'),
    flights:await read('flight-geometries.json'),
    operations:await read('operational-movements.json'),
  };
  const readiness=buildFlagshipReadiness(inputs);
  const queue=buildFlagshipOperationsQueue({...inputs,readiness});
  const committed=await read('flagship-operations-queue.json');
  assert.deepEqual(committed,queue);
  assert.equal(queue.tripId,'world-195');
  assert.ok(queue.summary.total>0);
  assert.ok(queue.summary.blocking>0);
  assert.ok(queue.tasks.some(task=>task.priority==='P0'&&task.category==='international-leg'));
  assert.ok(queue.tasks.some(task=>task.category==='operational-movement'));
  for(const task of queue.tasks){
    assert.ok(['P0','P1','P2'].includes(task.priority));
    assert.equal(typeof task.blocksDeparture,'boolean');
    assert.ok(Array.isArray(task.missing));
    assert.ok(Array.isArray(task.blockers));
  }
});
