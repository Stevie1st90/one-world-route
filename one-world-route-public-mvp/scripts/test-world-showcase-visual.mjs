import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildVisualBrief} from './visual-brief-model.mjs';

const ROOT=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));

const [catalog,publicRoute,routeVisuals,spec]=await Promise.all([
  read('data/platform/trips.json'),
  read('data/public-route.json'),
  read('data/platform/route-visuals.json'),
  read('data/platform/world-showcase-visual.json')
]);

const meta=catalog.trips.find(t=>t.id==='world-195');
const route=routeVisuals.journeys.find(j=>j.id==='world-195');
const brief=buildVisualBrief(meta,publicRoute,route);

test('world showcase preserves the 195/194 public invariants',()=>{
  assert.equal(publicRoute.countries.length,195);
  assert.equal(publicRoute.segments.length,194);
  assert.equal(spec.invariants.sovereignCountries,195);
  assert.equal(spec.invariants.internationalLegs,194);
});

test('world showcase AI prompt is compact and route-free',()=>{
  assert.equal(brief.productionStrategy,'hybrid-earth-base-plus-factual-route');
  assert.equal(brief.routeOverlayRequired,true);
  assert.equal(brief.routeOverlayAssetId,'auto-route-world-195');
  assert.ok(brief.imagePrompt.length<1200);
  assert.doesNotMatch(brief.imagePrompt,/Geography context:/);
  assert.doesNotMatch(brief.imagePrompt,/\bDE,\s*LU,\s*BE\b/);
  assert.match(brief.imagePrompt,/do not draw a standalone Earth globe/i);
  assert.match(brief.imagePrompt,/factual 195-country journey route/i);
});

test('world showcase uses the verified route-render layer',()=>{
  assert.equal(spec.factualLayer.assetId,'auto-route-world-195');
  assert.equal(spec.factualLayer.geometrySource,'data/public-route.json');
  assert.equal(spec.factualLayer.basemapSource,'data/visual-sources/natural-earth-relief.webp');
  assert.equal(spec.factualLayer.renderStyle,'premium-world-showcase-v2');
  assert.equal(spec.factualLayer.routeVisualReferenceOnly,true);
  assert.equal(spec.factualLayer.asset,route.media.asset);
  assert.equal(spec.factualLayer.provider,'local-natural-earth');
  assert.equal(spec.factualLayer.countries,195);
  assert.equal(spec.factualLayer.routeLines,route.geometry.lines);
  assert.equal(spec.finalCover.approvalRequired,true);
});
