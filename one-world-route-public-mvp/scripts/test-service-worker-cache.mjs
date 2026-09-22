import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const release2=await readFile(new URL('../release2.js',import.meta.url),'utf8');

test('platform trip catalog and datasets are network-first live data',()=>{
  assert.match(sw,/pathname==='\/data\/platform\/trips\.json'/);
  assert.match(sw,/\^\\\/data\\\/platform\\\/trips\\\/\[\^\/\]\+\\\.json\$/);
  assert.match(sw,/event\.respondWith\(networkFirst\(event\.request\)\)/);
});

test('service worker core precache does not hard-code mutable trip catalog or individual trips',()=>{
  const coreMatch=sw.match(/const CORE=\[([\s\S]*?)\];/);
  assert.ok(coreMatch,'CORE precache list missing');
  const core=coreMatch[1];
  assert.equal(core.includes('/data/platform/trips.json'),false,'trip catalog must not be cache-first precached');
  assert.equal(/\/data\/platform\/trips\/[^']+\.json/.test(core),false,'individual trip datasets must not be hard-coded in CORE');
});

test('service worker cache version identifies the live-data strategy generation',()=>{
  assert.match(sw,/one-world-route-platform-live-data-20260922a/);
});


test('runtime reloads once when a newly deployed service worker takes control',()=>{
  assert.match(release2,/serviceWorker\.addEventListener\('controllerchange'/);
  assert.match(release2,/registration=>registration\.update\(\)/);
  assert.match(release2,/reloadingForWorker=true;\s*location\.reload\(\)/);
});
