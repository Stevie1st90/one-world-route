import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {WORLD_SHOWCASE_STYLE} from './world-showcase-renderer.mjs';

test('world showcase full-bleed tuning contract remains fixed',()=>{
  assert.deepEqual(WORLD_SHOWCASE_STYLE,{
    version:'premium-full-bleed-world-v2',
    projection:'equirectangular-full-bleed',
    fullBleed:true,
    spaceBackground:false,
    visibleContainer:false,
    staticRouteColorMode:'single-color',
    staticRouteColor:'#FF5A52',
    staticRouteHaloColor:'#431519',
    basemapBrightness:.84,
    basemapSaturation:.68,
    routeDetailedOpacity:.92,
    routeSchematicOpacity:.74,
    routeDenseRegionMultiplier:.78,
    routeHaloOpacity:.16,
    seamPixelJumpFraction:.42,
    seamLongitudeJumpDegrees:170,
    antarcticShadeOpacity:.22
  });
});

test('world showcase compositor produces four deterministic preview variants without an AI base image',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'owr-world-showcase-'));
  try{
    const out=join(temp,'out');
    const r=spawnSync(process.execPath,[
      resolve('scripts/compose-world-showcase-cover.mjs'),
      '--out-dir='+out
    ],{cwd:process.cwd(),encoding:'utf8'});
    assert.equal(r.status,0,r.stderr||r.stdout);
    const report=JSON.parse(await readFile(join(out,'world-showcase-preview.json'),'utf8'));
    assert.equal(report.mode,'preview');
    assert.equal(report.tripId,'world-195');
    assert.equal(report.invariants.countries,195);
    assert.equal(report.invariants.internationalLegs,194);
    assert.equal(report.renderStyle,'premium-full-bleed-world-v2');
    assert.equal(report.projection,'equirectangular-full-bleed');
    assert.equal(report.fullBleed,true);
    assert.equal(report.spaceBackground,false);
    assert.equal(report.staticRouteColorMode,'single-color');
    assert.equal(report.staticRouteColor,'#FF5A52');
    assert.equal(report.interactiveRouteStyle,'continent-colors');
    assert.ok(report.mapSourceSha256);
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
