import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExperienceCoverage} from './experience-coverage-model.mjs';

const catalog={trips:[
  {id:'alpha',renderer:'regional-globe',status:'published',title:{en:'Alpha'},discovery:{featured:true},visual:{featurePriority:90}},
  {id:'beta',renderer:'regional-globe',status:'published',title:{en:'Beta'},discovery:{featured:false},visual:{featurePriority:40}}
]};
const datasets=new Map([
  ['alpha',{places:[
    {id:'rome-a',countryCode:'IT',name:{en:'Rome'},experienceRef:'IT:rome'},
    {id:'paris-a',countryCode:'FR',name:{en:'Paris'}}
  ],stops:[
    {id:'a1',sequence:1,placeId:'rome-a',dayStart:1,dayEnd:2},
    {id:'a2',sequence:2,placeId:'paris-a',dayStart:3,dayEnd:5}
  ]}],
  ['beta',{places:[
    {id:'paris-b',countryCode:'FR',name:{en:'Paris'}},
    {id:'berlin-b',countryCode:'DE',name:{en:'Berlin'}}
  ],stops:[
    {id:'b1',sequence:1,placeId:'paris-b',dayStart:1,dayEnd:4},
    {id:'b2',sequence:2,placeId:'berlin-b',dayStart:5,dayEnd:5}
  ]}]
]);
const profiles=[{id:'IT:rome'},{id:'FR:paris'}];

test('coverage model prioritizes reusable missing places transparently',()=>{
  const result=buildExperienceCoverage({catalog,datasets,profiles});
  assert.equal(result.summary.journeys,2);
  assert.equal(result.summary.totalPlaces,4);
  assert.equal(result.summary.coveredPlaces,1);
  assert.equal(result.summary.coveragePct,25);
  assert.equal(result.queue[0].name,'Paris');
  assert.equal(result.queue[0].journeyCount,2);
  assert.equal(result.queue[0].featuredJourneyCount,1);
  assert.equal(result.queue[0].stopDays,7);
  assert.equal(result.queue[0].action,'link-existing');
  assert.equal(result.queue[0].suggestedProfileId,'FR:paris');
});

test('coverage model reports trip completeness and profile reuse',()=>{
  const result=buildExperienceCoverage({catalog,datasets,profiles});
  const alpha=result.journeys.find(item=>item.tripId==='alpha');
  assert.equal(alpha.coveragePct,50);
  assert.equal(alpha.missingPlaces,1);
  assert.equal(result.summary.completeJourneys,0);
  assert.equal(result.summary.profiles,2);
  assert.equal(result.reuse[0].profileId,'IT:rome');
  assert.equal(result.reuse[0].journeyCount,1);
});
