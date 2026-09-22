import assert from 'node:assert/strict';

const base=(process.env.OWR_PRODUCTION_URL||'https://one-world-route.vercel.app').replace(/\/$/,'');
async function get(path){
  const r=await fetch(base+path,{headers:{'User-Agent':'ONE-WORLD-ROUTE-production-smoke/1.0'}});
  assert.equal(r.ok,true,`${path} returned ${r.status}`);
  return r;
}
async function text(path){return (await get(path)).text()}
async function json(path){return (await get(path)).json()}

const index=await text('/?smoke=1');
assert.match(index,/features\.bundle\.js/);
assert.match(index,/core\.bundle\.css/);

const catalog=await json('/data/platform/trips.json?smoke=1');
assert.equal(catalog.defaultTripId,'world-195');
assert.ok(catalog.trips.some(t=>t.id==='central-europe-rail-journey'),'rail journey missing from production catalog');
assert.ok(catalog.trips.some(t=>t.id==='western-mediterranean-cruise-loop'),'cruise missing from production catalog');

const rail=await json('/data/platform/trips/central-europe-rail-journey.json?smoke=1');
assert.equal(rail.kind,'rail');
assert.equal(rail.segments.length,9);

const features=await text('/features.bundle.js?smoke=1');
assert.match(features,/function pointLabel\(place\)/,'regional point-label isolation missing from production bundle');
assert.match(features,/\.pointLabel\(pointLabel\)/,'regional globe does not own its point tooltip');

const css=await text('/core.bundle.css?smoke=1');
assert.match(css,/overflow:hidden;overflow:clip/,'mobile shell clipping fix missing from production CSS');

const share=await text('/de/trip/central-europe-rail-journey?smoke=1');
assert.match(share,/Mitteleuropa|Central Europe Rail Journey/);

console.log('Production smoke complete:',base,'catalog trips:',catalog.trips.length);
