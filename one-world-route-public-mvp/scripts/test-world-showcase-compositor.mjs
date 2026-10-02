import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';

test('world showcase compositor produces four deterministic preview variants without publishing',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'owr-world-showcase-'));
  try{
    const base=join(temp,'base.png');
    const out=join(temp,'out');
    await sharp({create:{width:1600,height:900,channels:3,background:{r:8,g:20,b:38}}}).png().toFile(base);
    const r=spawnSync(process.execPath,[
      resolve('scripts/compose-world-showcase-cover.mjs'),
      '--base='+base,
      '--out-dir='+out
    ],{cwd:process.cwd(),encoding:'utf8'});
    assert.equal(r.status,0,r.stderr||r.stdout);
    const report=JSON.parse(await readFile(join(out,'world-showcase-preview.json'),'utf8'));
    assert.equal(report.mode,'preview');
    assert.equal(report.tripId,'world-195');
    assert.equal(report.invariants.countries,195);
    assert.equal(report.invariants.internationalLegs,194);
    assert.equal(report.renderStyle,'premium-flat-world-v4');
    assert.equal(report.projection,'robinson-like-compromise-v4');
    assert.deepEqual(report.variants.map(v=>v.width),[480,800,1200,1600]);
    for(const variant of report.variants){
      const meta=await sharp(variant.asset).metadata();
      assert.equal(meta.width,variant.width);
      assert.equal(meta.height,variant.height);
      assert.equal(meta.format,'webp');
    }
  } finally {
    await rm(temp,{recursive:true,force:true});
  }
});
