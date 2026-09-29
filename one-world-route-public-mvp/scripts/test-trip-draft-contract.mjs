import test from 'node:test';
import assert from 'node:assert/strict';
import {computeTripMetrics,normalizeCatalogEntry,normalizeDraftMetadata,validatePublicationReadiness,validateTripDraft,journeyArchetype,journeyArchetypes,scaffoldTripDraft} from './trip-draft-contract.mjs';

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


test('journey archetypes provide generic scalable defaults without Europe bias',()=>{
  const kinds=journeyArchetypes();
  assert.ok(kinds.includes('rail'));
  assert.ok(kinds.includes('road-trip'));
  assert.ok(kinds.includes('cruise'));
  const rail=journeyArchetype('rail');
  assert.equal(rail.mode,'rail');
  assert.equal(rail.routePolicy.startMode,'endpoints');
  assert.equal(rail.routePolicy.reversible,true);
  assert.ok(rail.capabilities.includes('trip-planning'));
  assert.ok(rail.capabilities.includes('source-evidence'));
  const road=journeyArchetype('road-trip');
  assert.ok(road.capabilities.includes('vehicle-context'));
  assert.equal(road.accessibility,'vehicle-dependent');
});

test('scaffold uses archetype defaults and stays globally neutral until authored',()=>{
  const fullCatalog={defaultLocale:'en',supportedLocales:['en','de','it','es','fr','pt']};
  const {trip,catalogEntry}=scaffoldTripDraft({slug:'global-rail-proof',kind:'rail',days:12,catalog:fullCatalog});
  assert.equal(trip.maintenance.tier,'live-dependent');
  assert.equal(trip.maintenance.sourceReviewDays,90);
  assert.equal(trip.routePolicy.reversible,true);
  assert.deepEqual(catalogEntry.discovery.regions,['global']);
  assert.equal(catalogEntry.discovery.fit.startRegion,'global');
  assert.deepEqual(catalogEntry.discovery.modes,['rail']);
  assert.equal(catalogEntry.discovery.durationBand,'7-14');
  assert.ok(catalogEntry.capabilities.includes('regional-stops'));
  assert.equal(catalogEntry.visual.mediaState,'art-directed');
  assert.equal(trip.planning.currency,null);
});

test('derives countries, route modes and duration metadata from authored route data',()=>{
  const ctx=valid();
  ctx.trip.geography={countries:['ZZ']};
  ctx.trip.planning.days=null;
  ctx.trip.stops[0].dayStart=1;ctx.trip.stops[0].dayEnd=1;
  ctx.trip.stops[1].dayStart=2;ctx.trip.stops[1].dayEnd=2;
  ctx.catalogEntry.discovery.durationBand='90-plus';
  ctx.catalogEntry.discovery.modes=[];
  const normalized=normalizeDraftMetadata(ctx);
  assert.deepEqual(normalized.trip.geography.countries,['DE','FR']);
  assert.equal(normalized.trip.planning.days,2);
  assert.equal(normalized.catalogEntry.discovery.durationBand,'7-14');
  assert.deepEqual(normalized.catalogEntry.discovery.modes,['rail']);
  assert.equal(normalized.catalogEntry.metrics.countries,2);
});

test('restores archetype capabilities while preserving explicit extras',()=>{
  const ctx=valid();
  ctx.catalogEntry.capabilities=['globe','entry-guidance'];
  const normalized=normalizeDraftMetadata(ctx);
  for(const capability of journeyArchetype('rail').capabilities){
    assert.ok(normalized.catalogEntry.capabilities.includes(capability),capability);
  }
  assert.ok(normalized.catalogEntry.capabilities.includes('entry-guidance'));
});

test('publication readiness requires a deliberate supported public status',()=>{
  const ctx=valid();
  ctx.trip.status='draft';
  ctx.catalogEntry.status='draft';
  let r=validatePublicationReadiness(ctx);
  assert.equal(r.valid,false);
  assert.match(r.errors.join('\\n'),/explicit public status/);

  ctx.trip.status='planned';
  ctx.catalogEntry.status='sourced-beta';
  r=validatePublicationReadiness(ctx);
  assert.equal(r.valid,false);
  assert.match(r.errors.join('\\n'),/must match/);

  ctx.catalogEntry.status='planned';
  r=validatePublicationReadiness(ctx);
  assert.equal(r.valid,true,r.errors.join('\\n'));

  ctx.trip.status='published';
  ctx.catalogEntry.status='published';
  r=validatePublicationReadiness(ctx);
  assert.equal(r.valid,false);
  assert.match(r.errors.join('\\n'),/unsupported/);
});
