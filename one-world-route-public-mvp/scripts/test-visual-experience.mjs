import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../platform/country-flags.js';
import '../platform/journey-shell.js';
import '../platform/visual-policy.js';
import {buildVisualBrief,visualFamily} from './visual-brief-model.mjs';
const {countryFlags:flags,journeyShell:shell}=globalThis.ONE_WORLD_PLATFORM_MODULES;
test('bounded flag groups and universal globe preserve country semantics',()=>{
 assert.deepEqual(flags.model({},['JP']).codes,['JP']);
 assert.equal(flags.model({},['IT','FR','ES','PT','GR']).remaining,2);
 assert.equal(flags.model({kind:'world',metrics:{countries:195}},['DE','FR']).codes.length,0);
 assert.equal(flags.model({},[]).count,0);
});
test('journey modes depend on capabilities and planning data, never trip identity',()=>{
 assert.deepEqual(shell.capabilities({id:'world-195'}),['explore']);
 assert.deepEqual(shell.capabilities({id:'any-future-expedition',capabilities:['operations','terrain','story','plan-vs-actual']}),['explore','plan','story','terrain','operations']);
 assert.deepEqual(shell.capabilities({}, {planning:{days:2}}),['explore','plan']);
});
test('orientation cannot resolve to artwork and social requires a native vertical cover',()=>{
 const p=globalThis.ONE_WORLD_VISUAL_POLICY,cover={type:'image',asset:'./assets/test.webp',license:'owned',attribution:'Team',status:'published',rightsStatus:'approved'};
 assert.equal(p.resolveJourneyVisual({}, {purpose:'planning',journeyCover:cover}).kind,'abstract');
 assert.equal(p.resolveJourneyVisual({}, {purpose:'social',ratio:'vertical',journeyCover:cover}).kind,'abstract');
 assert.equal(p.resolveJourneyVisual({}, {purpose:'social',ratio:'vertical',journeyCover:{...cover,derivatives:{vertical:{asset:'./assets/test-v.webp'}}}}).kind,'bespoke');
});
test('similar country trips produce different families without inventing landmarks',()=>{
 for(const [kind,family] of [['rail','rail-cinematic'],['road-trip','road-cinematic'],['island-hopping','coastal-editorial'],['round-trip','culture-editorial']])assert.equal(visualFamily({kind}),family);
 const brief=buildVisualBrief({id:'unknown',kind:'rail',title:{en:'Test'},discovery:{regions:['asia']}},{},{countries:['JP']});
 assert.equal(brief.suggestedAnchor,null);assert.equal(brief.anchorStatus,'unresolved');assert.match(brief.imagePrompt,/One coherent/);assert.doesNotMatch(brief.imagePrompt,/Fuji|Tokyo/);
});
test('published catalog has 21 briefs, six unique region cameras and local flags',async()=>{
 const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const briefs=await read('data/platform/visual-briefs.json'),regions=await read('data/platform/region-visuals.json'),source=await read('assets/flags/SOURCE.json');
 assert.equal(briefs.journeys.length,21);assert.equal(briefs.destinationRecommendations.length,20);assert.equal(briefs.summary.imagesGenerated,0);
 assert.equal(new Set(regions.assets.map(a=>a.outputHash)).size,6);
 assert.equal(source.countries,195);
 for(const b of briefs.journeys)assert.ok(b.imagePrompt&&b.visualFamily&&b.status);
});
