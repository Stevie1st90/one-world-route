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
});
