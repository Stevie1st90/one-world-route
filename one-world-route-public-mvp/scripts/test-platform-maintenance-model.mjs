import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMaintenanceReport} from './platform-maintenance-model.mjs';

const now=new Date('2026-09-28T00:00:00Z');
const catalog={trips:[
  {id:'world-195',renderer:'legacy-world'},
  {id:'trip-a',renderer:'regional-globe',title:{en:'Trip A'},visual:{featurePriority:10}}
]};
const trip={
  id:'trip-a',
  maintenance:{tier:'live-dependent',sourceReviewDays:90},
  routePolicy:{reversible:true,startMode:'endpoints'},
  places:[{id:'p1',name:{en:'Alpha'},countryCode:'DE',experienceRef:'place-alpha'}],
  stops:[{id:'s1',placeId:'p1',dayStart:1,dayEnd:2}],
  sources:[
    {id:'old',title:'Old source',checkedAt:'2026-06-01'},
    {id:'fresh',title:'Fresh source',checkedAt:'2026-09-20',validUntil:'2026-09-25'}
  ]
};

test('maintenance report prioritizes expired, overdue and due-soon review work',()=>{
  const report=buildMaintenanceReport({
    catalog,
    datasets:new Map([['trip-a',trip]]),
    shared:{reviewPolicies:{seasonal:{reviewAfterDays:90}},items:[{
      id:'shared-a',type:'factual',volatility:'seasonal',title:{en:'Shared A'},source:{url:'https://example.com'},checkedAt:'2026-07-20'
    }]},
    experienceProfiles:[{id:'place-alpha',name:{en:'Alpha'},reviewedAt:'2025-10-15',reviewDays:365}],
    now
  });
  assert.equal(report.issues.length,0);
  assert.equal(report.summary.liveDependentTrips,1);
  assert.equal(report.summary.reversibleTrips,1);
  assert.equal(report.summary.experienceCoveragePct,100);
  assert.equal(report.queue[0].sourceId,'fresh');
  assert.equal(report.queue[0].state,'expired');
  assert.equal(report.queue.some(item=>item.sourceId==='old'&&item.state==='overdue'),true);
  assert.equal(report.queue.some(item=>item.sourceId==='shared-a'&&item.state==='due-soon'),true);
  assert.equal(report.queue.some(item=>item.sourceId==='place-alpha'&&item.state==='due-soon'),true);
});

test('maintenance report surfaces structural issues without inventing missing datasets',()=>{
  const report=buildMaintenanceReport({
    catalog:{trips:[{id:'missing',renderer:'regional-globe',title:{en:'Missing'}}]},
    datasets:new Map(),
    shared:{items:[]},
    experienceProfiles:[],
    now
  });
  assert.equal(report.summary.regionalTrips,1);
  assert.match(report.issues.join('\n'),/missing: dataset unavailable/);
});
