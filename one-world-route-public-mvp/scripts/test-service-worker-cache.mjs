import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const release2=await readFile(new URL('../release2.js',import.meta.url),'utf8');

test('same-origin runtime requests are network-first with cache fallback',()=>{
  assert.match(sw,/async function networkFirst/);
  assert.match(sw,/return await remember\(request,await fetch\(request\)\)/);
  assert.match(sw,/event\.respondWith\(networkFirst\(event\.request\)\)/);
});

test('service worker shell does not hard-code mutable trip catalog or trip datasets',()=>{
  const shellMatch=sw.match(/const SHELL=\[([^\]]*)\]/);
  assert.ok(shellMatch,'SHELL precache list missing');
  const shell=shellMatch[1];
  assert.equal(shell.includes('/data/platform/trips.json'),false);
  assert.equal(/\/data\/platform\/trips\/[^']+\.json/.test(shell),false);
});

test('service worker upgrade actively checks and reloads once after taking control',()=>{
  assert.match(release2,/serviceWorker\.addEventListener\('controllerchange'/);
  assert.match(release2,/registration=>registration\.update\(\)/);
  assert.match(release2,/reloadingForWorker=true;\s*location\.reload\(\)/);
});
