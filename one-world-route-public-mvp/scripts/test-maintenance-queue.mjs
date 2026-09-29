import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMaintenanceQueue} from './maintenance-queue-model.mjs';

const catalog={trips:[
  {id:'rail-a',renderer:'regional-globe'},
  {id:'rail-b',renderer:'regional-globe'}
]};
const shared={reviewPolicies:{'live-dependent':{reviewAfterDays:30},evergreen:{reviewAfterDays:365}},items:[
  {id:'shared-live',type:'fact',volatility:'live',checkedAt:'2026-09-10',source:{url:'https://example.com/live/',title:'Live source'}}
]};
const datasets=new Map([
  ['rail-a',{maintenance:{tier:'live-dependent',sourceReviewDays:30},sources:[
    {id:'operator-a',title:'Operator',url:'https://example.com/operator/',checkedAt:'2026-08-01'}
  ]}],
  ['rail-b',{maintenance:{tier:'live-dependent',sourceReviewDays:30},sources:[
    {id:'operator-b',title:'Operator mirror',url:'https://example.com/operator',checkedAt:'2026-08-15'}
  ]}]
]);
const profiles=[{id:'DE-berlin',countryCode:'DE',name:{en:'Berlin'},reviewedAt:'2025-01-01',reviewDays:365}];

test('deduplicates external sources and preserves dependent journeys',()=>{
  const queue=buildMaintenanceQueue({catalog,datasets,shared,profiles,now:new Date('2026-09-28T12:00:00Z')});
  const source=queue.items.find(item=>item.url==='https://example.com/operator');
  assert.ok(source);
  assert.equal(source.reuseCount,2);
  assert.deepEqual(source.dependents.map(item=>item.tripId).sort(),['rail-a','rail-b']);
  assert.equal(source.state,'overdue');
  assert.equal(source.nextReviewAt,'2026-08-31');
  assert.equal(source.reviewDays,30);
  assert.match(source.priorityReason,/reused 2×/);
  assert.equal(queue.summary.reusedExternalSources,1);
  assert.equal(queue.journeyHealth.length,2);
  assert.equal(queue.journeyHealth.find(item=>item.tripId==='rail-a').state,'source-stale');
  assert.equal(queue.summary.journeySourceStale,2);
});

test('separates expired, overdue, due-soon and scheduled review states',()=>{
  const localDatasets=new Map([['rail-a',{maintenance:{tier:'live-dependent',sourceReviewDays:30},sources:[
    {id:'expired',url:'https://example.com/expired',checkedAt:'2026-09-20',validUntil:'2026-09-27'},
    {id:'soon',url:'https://example.com/soon',checkedAt:'2026-09-10'},
    {id:'later',url:'https://example.com/later',checkedAt:'2026-09-28',reviewDays:90}
  ]}]]);  
  const queue=buildMaintenanceQueue({catalog:{trips:[catalog.trips[0]]},datasets:localDatasets,shared:{items:[],reviewPolicies:{}},profiles:[],now:new Date('2026-09-28T12:00:00Z')});
  assert.equal(queue.items.find(item=>item.url==='https://example.com/expired').state,'expired');
  assert.equal(queue.items.find(item=>item.url==='https://example.com/soon').state,'due-soon');
  assert.equal(queue.items.find(item=>item.url==='https://example.com/later').state,'scheduled');
});

test('includes reusable place-experience review dates in the same operations queue',()=>{
  const queue=buildMaintenanceQueue({catalog:{trips:[]},datasets:new Map(),shared:{items:[],reviewPolicies:{}},profiles,now:new Date('2026-09-28T12:00:00Z')});
  const item=queue.items.find(entry=>entry.profileId==='DE-berlin');
  assert.ok(item);
  assert.equal(item.type,'place-experience');
  assert.equal(item.state,'overdue');
  assert.equal(queue.summary.placeExperienceProfiles,1);
});
