import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createBuilderServer} from './server.mjs';

const json=value=>JSON.stringify(value,null,2)+'\n';

test('builder API creates drafts and preview overlays the real catalog path',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'owr-builder-'));
  const draftsRoot=resolve(root,'drafts');
  const mvpRoot=resolve(root,'mvp');
  await mkdir(resolve(mvpRoot,'data/platform'),{recursive:true});
  await writeFile(resolve(mvpRoot,'index.html'),'<!doctype html><title>Preview shell</title><script src="./features.bundle.js"></script>','utf8');
  await writeFile(resolve(mvpRoot,'features.bundle.js'),'window.__PREVIEW_SHELL__=true;','utf8');
  await writeFile(resolve(mvpRoot,'data/platform/trips.json'),json({
    schemaVersion:1,updatedAt:'2026-09-22',defaultLocale:'en',supportedLocales:['en','de'],
    defaultTripId:'world-195',
    trips:[{id:'world-195',slug:'world-195',kind:'world',renderer:'legacy-world',title:{en:'World',de:'Welt'}}]
  }));

  const app=createBuilderServer({host:'127.0.0.1',port:0,draftsRoot,mvpRoot});
  await app.start();
  const port=app.server.address().port;
  const base='http://127.0.0.1:'+port;

  try{
    const create=await fetch(base+'/api/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'test-rail',kind:'rail',days:8})});
    assert.equal(create.status,201);
    const draft=await create.json();
    assert.equal(draft.trip.slug,'test-rail');
    assert.equal(draft.catalogEntry.renderer,'regional-globe');

    const bootstrap=await fetch(base+'/api/bootstrap').then(r=>r.json());
    assert.equal(bootstrap.drafts.length,1);
    assert.equal(bootstrap.drafts[0].slug,'test-rail');

    const previewCatalog=await fetch(base+'/preview/test-rail/data/platform/trips.json').then(r=>r.json());
    assert.equal(previewCatalog.trips.length,2);
    assert.equal(previewCatalog.trips.at(-1).id,'test-rail');

    const previewTrip=await fetch(base+'/preview/test-rail/data/platform/trips/test-rail.json').then(r=>r.json());
    assert.equal(previewTrip.id,'test-rail');

    const shell=await fetch(base+'/preview/test-rail/').then(r=>r.text());
    assert.match(shell,/Preview shell/);

    const traversal=await fetch(base+'/preview/test-rail/../../etc/passwd');
    assert.notEqual(traversal.status,200);
  }finally{
    await app.stop();
    await rm(root,{recursive:true,force:true});
  }
});

test('builder rejects changing a draft slug through update endpoint',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'owr-builder-'));
  const draftsRoot=resolve(root,'drafts');
  const mvpRoot=resolve(root,'mvp');
  await mkdir(resolve(mvpRoot,'data/platform'),{recursive:true});
  await writeFile(resolve(mvpRoot,'data/platform/trips.json'),json({
    schemaVersion:1,updatedAt:'2026-09-22',defaultLocale:'en',supportedLocales:['en'],
    defaultTripId:'world-195',trips:[{id:'world-195',slug:'world-195'}]
  }));

  const app=createBuilderServer({host:'127.0.0.1',port:0,draftsRoot,mvpRoot});
  await app.start();
  const base='http://127.0.0.1:'+app.server.address().port;
  try{
    const created=await fetch(base+'/api/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'safe-draft',kind:'custom',days:3})}).then(r=>r.json());
    created.trip.slug='renamed-draft';
    const response=await fetch(base+'/api/drafts/safe-draft',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(created)});
    assert.equal(response.status,409);
  }finally{
    await app.stop();
    await rm(root,{recursive:true,force:true});
  }
});
