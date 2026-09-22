import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft,durationBand,synchronizeDraft,validateDraft} from './lib/draft-core.mjs';

const locales=['en','de','it','es','fr','pt'];
const localized=value=>Object.fromEntries(locales.map(locale=>[locale,value]));

function validRailDraft(){
  const draft=createDraft({slug:'alpine-rail-loop',kind:'rail',days:5,locales,defaultLocale:'en'});
  draft.trip.status='sourced-beta';
  draft.catalogEntry.status='sourced-beta';
  draft.trip.title=localized('Alpine Rail Loop');
  draft.trip.summary=localized('A sourced rail itinerary across two Alpine cities.');
  draft.catalogEntry.title=localized('Alpine Rail Loop');
  draft.catalogEntry.subtitle=localized('5 days · 2 cities · rail');
  draft.catalogEntry.discovery={
    regions:['europe','alps'],themes:['rail','cities'],modes:['rail'],durationBand:'7-14',featured:false,
    fit:{pace:'balanced',seasons:['multi-season'],party:['solo','couples'],startRegion:'europe',accessibility:'standard-check'}
  };
  draft.trip.places=[
    {id:'city-a',type:'city',countryCode:'DE',name:localized('City A'),coordinates:{lat:48.1,lng:11.5}},
    {id:'city-b',type:'city',countryCode:'AT',name:localized('City B'),coordinates:{lat:48.2,lng:16.3}}
  ];
  draft.trip.stops=[
    {id:'alpine-rail-loop-stop-01',sequence:1,placeId:'city-a',dayStart:1,dayEnd:2,nights:2},
    {id:'alpine-rail-loop-stop-02',sequence:2,placeId:'city-b',dayStart:3,dayEnd:5,nights:3}
  ];
  draft.trip.sources=[{
    id:'operator-a-b',title:'Official route information',issuer:'Rail Operator',
    issuerType:'official-operator',url:'https://example.com/rail',checkedAt:'2026-09-22',claims:['direct rail service']
  }];
  draft.trip.segments=[{
    id:'alpine-rail-loop-leg-01',sequence:1,fromStopId:'alpine-rail-loop-stop-01',toStopId:'alpine-rail-loop-stop-02',
    transport:{mode:'rail',stages:[{mode:'rail',operator:'Rail Operator',sourceIds:['operator-a-b']}]},
    planning:{durationMinutes:180,durationBasis:'operator-published-current',distanceKm:null,cost:null},
    verification:{status:'verified',lastVerified:'2026-09-22',sourceIds:['operator-a-b'],notes:'Official route evidence.'}
  }];
  draft.trip.extensions={rail:{scope:'rail-only',timetablePolicy:'live-operator-check',sourcePolicy:'official-operator',crossBorder:true}};
  return synchronizeDraft(draft);
}

const publicCatalog={defaultLocale:'en',supportedLocales:locales,trips:[{id:'world-195',slug:'world-195'}]};

test('duration bands are deterministic',()=>{
  assert.equal(durationBand(7),'7-14');
  assert.equal(durationBand(14),'7-14');
  assert.equal(durationBand(15),'15-30');
  assert.equal(durationBand(31),'31-89');
  assert.equal(durationBand(90),'90-plus');
  assert.equal(durationBand(null),null);
});

test('publish-ready rail draft passes shared contract and extension validation',()=>{
  const result=validateDraft(validRailDraft(),{publicCatalog,publish:true});
  assert.equal(result.ok,true,result.errors.join('\n'));
  assert.deepEqual(result.metrics,{days:5,countries:2,stops:2,segments:1,budget:null,sourcedSegments:1,verifiedSegments:1});
});

test('rail draft rejects non-rail stage through shared extension validator',()=>{
  const draft=validRailDraft();
  draft.trip.segments[0].transport.stages[0].mode='bus';
  const result=validateDraft(draft,{publicCatalog,publish:true});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/contains non-rail stage bus/);
});

test('publish gate rejects unresolved placeholder content',()=>{
  const draft=validRailDraft();
  draft.trip.summary.en='TODO — write this later';
  const result=validateDraft(draft,{publicCatalog,publish:true});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/TODO\/TBD\/placeholder/);
});

test('draft cannot shadow an existing public trip',()=>{
  const draft=validRailDraft();
  const catalog={...publicCatalog,trips:[...publicCatalog.trips,{id:draft.trip.id,slug:draft.trip.slug}]};
  const result=validateDraft(draft,{publicCatalog:catalog,publish:true});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/already exists in public catalog/);
});

test('invalid source references are blocking',()=>{
  const draft=validRailDraft();
  draft.trip.segments[0].verification.sourceIds=['missing'];
  const result=validateDraft(draft,{publicCatalog,publish:true});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/references missing source missing/);
});
