import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectFlagshipTopology} from './flagship-topology-model.mjs';

const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));

test('flagship official route is a 195-country open path with 194 international legs',async()=>{
  const route=await read('public-route.json');
  const topology=inspectFlagshipTopology(route);
  assert.equal(topology.expectedCountries,195);
  assert.equal(topology.expectedInternationalLegs,194);
  assert.equal(topology.pathNodes,195);
  assert.equal(topology.uniquePathCountries,195);
  assert.deepEqual(topology.missing,[]);
  assert.deepEqual(topology.unexpected,[]);
  assert.deepEqual(topology.duplicates,[]);
  assert.deepEqual(topology.adjacencyErrors,[]);
  assert.deepEqual(topology.idSequenceErrors,[]);
  assert.deepEqual(topology.catalogOrderErrors,[]);
  assert.equal(topology.start,'Deutschland');
  assert.equal(topology.end,'Malta');
  assert.equal(topology.postTripReturn?.from,'Malta');
  assert.equal(topology.postTripReturn?.to,'Deutschland');
  assert.equal(topology.postTripReturn?.countedInInternationalLegs,false);
  assert.equal(topology.canonical,true);
});
