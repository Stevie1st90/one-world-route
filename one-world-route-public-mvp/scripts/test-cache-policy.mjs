import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('delivery policy keeps navigations and mutable app resources network-first',async()=>{
  const sw=await read('sw.js');
  assert.match(sw,/request\.mode==='navigate'/);
  assert.match(sw,/networkFirst\(event\.request,\{fallback:'\/index\.html'\}\)/);
  assert.match(sw,/isFreshApplicationResource/);
  assert.match(sw,/fetch\(request,\{cache:'no-store'\}\)/);
  assert.match(sw,/MIGRATION_CACHE/);
  assert.match(sw,/client\.navigate\(client\.url\)/);
  assert.doesNotMatch(sw,/caches\.match\(e\.request\)\.then\(hit=>hit\|\|fetch/);
});

test('service worker registration bypasses the HTTP cache and activates updates',async()=>{
  const source=await read('platform/service-worker.js');
  assert.match(source,/updateViaCache:'none'/);
  assert.match(source,/registration\.update\(\)/);
  assert.match(source,/SKIP_WAITING/);
  assert.match(source,/controllerchange/);
});

test('Vercel serves shell and worker with explicit revalidation policy',async()=>{
  const config=JSON.parse(await read('vercel.json'));
  const headers=new Map((config.headers||[]).map(rule=>[rule.source,rule.headers||[]]));
  const value=(source,key)=>headers.get(source)?.find(item=>item.key===key)?.value||'';

  assert.match(value('/sw.js','Cache-Control'),/no-store/);
  assert.equal(value('/sw.js','Service-Worker-Allowed'),'/');
  for(const source of ['/','/index.html','/core.bundle.js','/features.bundle.js','/core.bundle.css','/features.bundle.css']){
    assert.match(value(source,'Cache-Control'),/max-age=0|no-cache|no-store/);
  }
});

test('production feature bundle contains the update manager',async()=>{
  const build=await read('scripts/build-bundles.mjs');
  const bundle=await read('features.bundle.js');
  assert.match(build,/platform\/service-worker\.js/);
  assert.match(bundle,/===== platform\/service-worker\.js =====/);
  assert.match(bundle,/updateViaCache:'none'/);
});
