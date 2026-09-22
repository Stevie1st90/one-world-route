import test from 'node:test';
import assert from 'node:assert/strict';
import {computeTripMetrics,normalizeCatalogEntry,validateTripDraft} from './trip-draft-contract.mjs';

const catalog={supportedLocales:['en','de']};
function valid(){
  const title={en:'Test Rail',de:'Testbahn'};
  const trip={schemaVersion:1,id:'test-rail',slug:'test-rail',kind:'rail',title,summary:{...title},planning:{days:2},places:[
    {id:'a',countryCode:'DE',name:{en:'A',de:'A'},coordinates:{lat:50,lng:8}},
    {id:'b',countryCode:'FR',name:{en:'B',de:'B'},coordinates:{lat:49,lng:7}}
  ],stops:[{id:'s1',sequence:1,placeId:'a'},{id:'s2',sequence:2,placeId:'b'}],segments:[{
    id:'seg1',sequence:1,fromStopId:'s1',toStopId:'s2',transport:{mode:'rail',stages:[{mode:'rail',sourceIds:['src']}]},verification:{status:'verified',sourceIds:['src'],lastVerified:'2026-09-22'}
  }],sources:[{id:'src',title:'Operator',issuer:'Operator',issuerType:'official-operator',url:'https://example.com',checkedAt:'2026-09-22'}],extensions:{rail:{scope:'rail-only',sourcePolicy:'official-operator',crossBorder:true}}};
  const entry={id:'test-rail',slug:'test-rail',kind:'rail',renderer:'regional-globe',title,subtitle:{en:'Two days',de:'Zwei Tage'},capabilities:['globe','story','terrain'],discovery:{regions:['europe'],themes:['rail'],modes:['rail'],durationBand:'7-14',fit:{pace:'balanced',seasons:['multi-season'],party:['solo'],startRegion:'europe',accessibility:'standard-check'}}};
  return {trip,catalogEntry:entry,catalog};
}

test('computes authoritative metrics from the trip graph',()=>{
  assert.deepEqual(computeTripMetrics(valid().trip),{days:2,stops:2,segments:1,countries:2,sourcedSegments:1,verifiedSegments:1});
});

test('normalizes catalog identity, dataset and metrics',()=>{
  const {trip,catalogEntry}=valid(); const n=normalizeCatalogEntry(catalogEntry,trip);
  assert.equal(n.dataset,'./data/platform/trips/test-rail.json');
  assert.equal(n.renderer,'regional-globe');
  assert.equal(n.metrics.segments,1);
});

test('valid draft passes shared graph and extension validation',()=>{
  const r=validateTripDraft(valid()); assert.equal(r.valid,true,r.errors.join('\n'));
});

test('broken adjacency and localization fail publication gate',()=>{
  const ctx=valid(); delete ctx.catalogEntry.title.de; ctx.trip.segments[0].fromStopId='missing';
  const r=validateTripDraft(ctx); assert.equal(r.valid,false); assert.match(r.errors.join('\n'),/catalog title missing for de/); assert.match(r.errors.join('\n'),/must connect adjacent stops/);
});


test('publish gate rejects placeholder copy and missing evidence',()=>{
  const ctx=valid();
  ctx.catalogEntry.subtitle.de='TODO — subtitle';
  ctx.catalogEntry.capabilities.push('source-evidence');
  ctx.trip.segments[0].verification.sourceIds=[];
  const r=validateTripDraft(ctx);
  assert.equal(r.valid,false);
  assert.match(r.errors.join('\n'),/placeholder localization remains for de/);
  assert.match(r.errors.join('\n'),/requires source evidence/);
});


test('publish gate rejects duplicate segment IDs and broken sequence integrity',()=>{
  const ctx=valid();
  const secondStop={id:'s3',sequence:3,placeId:'a'};
  ctx.trip.stops.push(secondStop);
  ctx.trip.segments.push({
    ...structuredClone(ctx.trip.segments[0]),
    sequence:3,
    fromStopId:'s2',
    toStopId:'s3'
  });
  const r=validateTripDraft(ctx);
  assert.equal(r.valid,false);
  assert.match(r.errors.join('\n'),/segment IDs must be unique/);
  assert.match(r.errors.join('\n'),/sequence must be contiguous/);
});

test('publish gate rejects incomplete localized summaries and place names',()=>{
  const ctx=valid();
  delete ctx.trip.summary.de;
  delete ctx.trip.places[0].name.de;
  const r=validateTripDraft(ctx);
  assert.equal(r.valid,false);
  assert.match(r.errors.join('\n'),/trip summary missing for de/);
  assert.match(r.errors.join('\n'),/place a name missing for de/);
});

test('publish gate rejects out-of-range coordinates and malformed country codes',()=>{
  const ctx=valid();
  ctx.trip.places[0].coordinates.lat=120;
  ctx.trip.places[0].countryCode='DEU';
  const r=validateTripDraft(ctx);
  assert.equal(r.valid,false);
  assert.match(r.errors.join('\n'),/coordinates are out of range/);
  assert.match(r.errors.join('\n'),/countryCode must be ISO alpha-2/);
});
