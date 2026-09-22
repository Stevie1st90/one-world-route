import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPublishGate,saveDraft} from '../builder-core.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const repoRoot=resolve(here,'../..');
const publicRoot=join(repoRoot,'one-world-route-public-mvp');

test('publish gate validates a real platform-shaped draft in an isolated sandbox',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'owr-builder-workspace-'));
  try{
    const [trip,catalog]=await Promise.all([
      readFile(join(publicRoot,'data/platform/trips/italy-grand-tour.json'),'utf8').then(JSON.parse),
      readFile(join(publicRoot,'data/platform/trips.json'),'utf8').then(JSON.parse)
    ]);
    const entry=structuredClone(catalog.trips.find(item=>item.id==='italy-grand-tour'));
    const draftTrip=structuredClone(trip);
    const slug='builder-gate-proof';
    draftTrip.id=slug;
    draftTrip.slug=slug;
    draftTrip.status='sourced-beta';
    draftTrip.title=Object.fromEntries(Object.entries(draftTrip.title).map(([locale,value])=>[locale,value+' Builder Proof']));
    entry.id=slug;
    entry.slug=slug;
    entry.status='sourced-beta';
    entry.dataset=`./data/platform/trips/${slug}.json`;
    entry.title=structuredClone(draftTrip.title);
    entry.subtitle=Object.fromEntries(Object.entries(entry.subtitle).map(([locale,value])=>[locale,value+' Builder Proof']));
    await saveDraft(workspace,slug,{trip:draftTrip,catalogEntry:entry});

    const result=await runPublishGate({repoRoot,publicRoot,workspace,slug});
    assert.equal(result.ok,true,JSON.stringify(result,null,2));
    assert.equal(result.stage,'complete');
    assert.ok(result.checks.every(check=>check.ok));
  }finally{
    await rm(workspace,{recursive:true,force:true});
  }
},{timeout:120000});
