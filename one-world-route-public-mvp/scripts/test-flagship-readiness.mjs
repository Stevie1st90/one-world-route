import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildFlagshipReadiness} from './flagship-readiness-model.mjs';

const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));

test('flagship readiness report is deterministic and current',async()=>{
  const inputs={
    route:await read('public-route.json'),
    waypoints:await read('route-waypoints.json'),
    flights:await read('flight-geometries.json'),
    operations:await read('operational-movements.json'),
  };
  const generated=buildFlagshipReadiness(inputs);
  const committed=await read('flagship-readiness.json');

  assert.deepEqual(committed,generated);
  assert.equal(generated.structural.expectedCountries,195);
  assert.equal(generated.structural.expectedInternationalLegs,194);
  assert.equal(generated.structural.actualCountries,195);
  assert.equal(generated.structural.actualInternationalLegs,194);
  assert.equal(generated.continuity.connections,193);
  assert.equal(
    generated.continuity.sharedEndpoints+
      generated.continuity.transferRequired+
      generated.continuity.unresolvedEndpointGeometry+
      generated.continuity.countryMismatch,
    generated.continuity.connections
  );
  assert.equal(
    generated.flights.fullGeometries+generated.flights.missingFullGeometries,
    generated.flights.flightLegs
  );
  assert.equal(
    generated.movements.reviewed+generated.movements.needsReview,
    generated.movements.total
  );
  assert.equal(generated.status.departureReady,generated.blockers.length===0);
});
