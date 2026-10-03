import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildTripIndex} from './trip-index-model.mjs';

const root=new URL('../',import.meta.url);
const readJson=async url=>JSON.parse(await readFile(url,'utf8'));

test('trip index stays deterministic and source-derived',async()=>{
  const catalog=await readJson(new URL('data/platform/trips.json',root));
  const datasets=new Map();
  for(const meta of catalog.trips||[]){
    datasets.set(meta.id,await readJson(new URL(String(meta.dataset).replace(/^\.\//,''),root)));
  }
  const generated=buildTripIndex(catalog,datasets);
  const committed=await readJson(new URL('data/platform/trip-index.json',root));
  assert.deepEqual(committed,generated);
  assert.equal(generated.trips.length,catalog.trips.length);
  const italy=generated.trips.find(trip=>trip.id==='italy-grand-tour');
  assert.ok(italy);
  assert.equal(italy.itinerary.length,11);
  assert.equal(italy.evidence.segments,10);
  assert.equal(italy.planning.knownPublishedMinimumEur,120.4);
  assert.ok(italy.sources.every(source=>/^https?:\/\//.test(source.url)));
  assert.equal(italy.itinerary.length,11);
  assert.equal(italy.preview.points.length,10);
  assert.equal(italy.preview.arcs.length,10);
  assert.ok(italy.preview.arcs.every(arc=>Number.isFinite(arc.start.lat)&&Number.isFinite(arc.end.lng)));
});


test('all published regional journeys expose practical planning',async()=>{
  const catalog=await readJson(new URL('data/platform/trips.json',root));
  const regional=catalog.trips.filter(trip=>trip.renderer==='regional-globe');
  assert.ok(regional.length>=4);
  for(const trip of regional){
    assert.ok(trip.capabilities.includes('trip-planning'),trip.id+' must expose practical planning');
  }
});

import {buildDiscoveryIndex,GLOBE_SAMPLE_LIMIT} from './discovery-index-model.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Discovery=require('../platform/discovery.js');

test('1000-journey discovery payload bounds globe work and excludes itinerary/evidence duplication',async()=>{
  const base=await readJson(new URL('data/platform/trip-index.json',root));
  const example=base.trips.find(t=>t.preview);
  const trips=Array.from({length:1000},(_,i)=>({...example,id:'journey-'+i}));
  const compact=buildDiscoveryIndex({...base,trips});
  assert.equal(compact.trips.length,1000);
  assert.equal(compact.trips.filter(t=>t.preview).length,GLOBE_SAMPLE_LIMIT);
  assert.ok(!compact.trips.some(t=>'itinerary' in t||'sources' in t||'evidence' in t));
  assert.ok(JSON.stringify(compact).length<JSON.stringify({...base,trips}).length*.25);
  assert.ok(compact.trips.every(t=>t.countries.length>0&&t.searchPlaces.length>0));
});

test('search supports accented multilingual places and word order; collection membership is shared',()=>{
  const trip={kind:'rail',discovery:{regions:['europe'],modes:['rail'],themes:['culture'],fit:{pace:'relaxed'}}};
  assert.equal(Discovery.matches(trip,{q:'zurich rail'},'Rail Zürich Europe'),true);
  assert.equal(Discovery.matches(trip,{q:'rail tokyo'},'Rail Zürich Europe'),false);
  assert.equal(Discovery.collectionMatches(trip,{filters:{modeAny:['rail','ferry'],theme:'culture',pace:'relaxed'}}),true);
  assert.equal(Discovery.collectionMatches(trip,{filters:{themeAny:['nature']}}),false);
});
