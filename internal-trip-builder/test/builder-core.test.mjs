import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftPayload,deriveMetrics,normalizeCandidate,validateDraftCandidate} from '../builder-core.mjs';

const catalog={supportedLocales:['en','de','it','es','fr','pt']};

function validDraft(){
  const candidate=createDraftPayload({slug:'test-rail-loop',kind:'rail',days:8,title:'Test Rail Loop'});
  candidate.trip.status='sourced-beta';
  candidate.catalogEntry.status='sourced-beta';
  candidate.trip.summary=Object.fromEntries(catalog.supportedLocales.map(l=>[l,'Summary']));
  candidate.catalogEntry.subtitle=Object.fromEntries(catalog.supportedLocales.map(l=>[l,'8 days · test route']));
  candidate.catalogEntry.discovery={
    regions:['europe'],themes:['rail'],modes:['rail'],durationBand:'7-14',
    fit:{pace:'balanced',seasons:['multi-season'],party:['solo'],startRegion:'europe',accessibility:'standard-check'}
  };
  candidate.trip.places=[
    {id:'alpha',type:'city',countryCode:'FR',name:{en:'Alpha'},coordinates:{lat:48,lng:2}},
    {id:'beta',type:'city',countryCode:'BE',name:{en:'Beta'},coordinates:{lat:50,lng:4}}
  ];
  candidate.trip.stops=[
    {id:'stop-1',sequence:1,placeId:'alpha',dayStart:1,dayEnd:4},
    {id:'stop-2',sequence:2,placeId:'beta',dayStart:5,dayEnd:8}
  ];
  candidate.trip.sources=[
    {id:'operator',title:'Operator',issuer:'Operator',issuerType:'official-operator',url:'https://example.com/route',checkedAt:'2026-09-22'}
  ];
  candidate.trip.segments=[
    {id:'segment-1',sequence:1,fromStopId:'stop-1',toStopId:'stop-2',transport:{mode:'rail'},verification:{status:'verified',sourceIds:['operator'],lastVerified:'2026-09-22'}}
  ];
  return normalizeCandidate(candidate);
}

test('builder derives catalog metrics from trip truth',()=>{
  const candidate=validDraft();
  assert.deepEqual(deriveMetrics(candidate.trip),{
    days:8,countries:2,stops:2,segments:1,sourcedSegments:1,verifiedSegments:1
  });
  assert.equal(candidate.catalogEntry.metrics.countries,2);
  assert.equal(candidate.catalogEntry.metrics.segments,1);
});

test('valid draft passes local builder contract',()=>{
  const result=validateDraftCandidate(validDraft(),catalog);
  assert.equal(result.ok,true,result.errors.join('\n'));
  assert.deepEqual(result.errors,[]);
});

test('builder rejects broken stop continuity and source references',()=>{
  const candidate=validDraft();
  candidate.trip.segments[0].fromStopId='missing-stop';
  candidate.trip.segments[0].verification.sourceIds=['missing-source'];
  const result=validateDraftCandidate(candidate,catalog);
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/adjacent ordered stops/);
  assert.match(result.errors.join('\n'),/missing source/);
});

test('builder normalizes publication onto the shared regional renderer',()=>{
  const candidate=validDraft();
  candidate.catalogEntry.renderer='special-rail-renderer';
  const normalized=normalizeCandidate(candidate);
  assert.equal(normalized.catalogEntry.renderer,'regional-globe');
  const result=validateDraftCandidate(normalized,catalog);
  assert.equal(result.ok,true,result.errors.join('\n'));
});
