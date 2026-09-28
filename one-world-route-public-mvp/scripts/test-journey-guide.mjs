import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/journey-guide.js',import.meta.url),'utf8');

function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,Intl,console};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.journeyGuide;
}

const trip={
  places:[
    {id:'a',countryCode:'JP',name:{en:'Tokyo'}},
    {id:'b',countryCode:'JP',name:{en:'Kyoto'}},
    {id:'c',countryCode:'JP',name:{en:'Hiroshima'}}
  ],
  stops:[
    {id:'s1',sequence:1,placeId:'a',dayStart:1,dayEnd:2,nights:2},
    {id:'s2',sequence:2,placeId:'b',dayStart:3,dayEnd:6,nights:4},
    {id:'s3',sequence:3,placeId:'c',dayStart:7,dayEnd:8,nights:2}
  ],
  segments:[
    {transport:{mode:'rail'},planning:{cost:{amount:40}},verification:{status:'verified'}},
    {transport:{mode:'rail'},planning:{cost:null},verification:{status:'current-check-required'}}
  ],
  routePolicy:{originAccess:'dynamic'},
  entryGuidance:{personalizationRequired:true}
};

test('journey guide derives route rhythm without external travel guesses',()=>{
  const guide=load();
  const s=guide.snapshot(trip,{capabilities:['trip-planning']});
  assert.equal(s.stops,3);
  assert.equal(s.totalSegments,2);
  assert.equal(s.averageStayDays,8/3);
  assert.equal(s.focus[0].place.name.en,'Kyoto');
  assert.equal(s.focus[0].days,4);
  assert.deepEqual([...s.modes],['rail']);
  assert.equal(s.knownFareCount,1);
  assert.equal(s.reviewCount,1);
  assert.equal(s.entryContext,true);
  assert.equal(s.originAccess,true);
});

test('journey guide exposes vehicle and evidence planning signals',()=>{
  const guide=load();
  const s=guide.snapshot({...trip,entryGuidance:null},{
    capabilities:['trip-planning','vehicle-context']
  });
  assert.equal(s.vehicleContext,true);
  assert.equal(s.entryContext,false);
  assert.equal(s.verifiedCount,1);
});

test('journey guide renderer keeps unknown pricing explicit',()=>{
  const guide=load();
  const labels={
    journeyGuide:'Journey guide',guideDataDriven:'From this route',journeyGuideLead:'Lead',
    averageStay:'Average stay',routeMovements:'Route movements',transportModes:'Transport modes',
    timeFocus:'Where you spend more time',beforeBooking:'Before you book',day:'Day',days:'days',
    guideReviewSegments:'{count} of {total} need review.',guideFareCoverage:'Pricing for {known} of {total}.',
    guideEntryContext:'Entry context.',guideVehicleContext:'Vehicle context.',guideOriginAccess:'Origin separate.',
    guideEvidenceReady:'Evidence ready.'
  };
  const html=guide.render({
    trip,
    meta:{capabilities:['trip-planning']},
    locale:'en',
    t:key=>labels[key]||key,
    esc:value=>String(value),
    local:value=>value?.en||String(value||''),
    facetLabel:value=>value==='rail'?'Rail':value
  });
  assert.match(html,/platform-journey-guide/);
  assert.match(html,/Kyoto/);
  assert.match(html,/Pricing for 1 of 2/);
  assert.doesNotMatch(html,/undefined|NaN/);
});
