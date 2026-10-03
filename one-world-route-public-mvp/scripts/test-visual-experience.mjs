import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../platform/country-flags.js';
import '../platform/journey-shell.js';
import '../platform/visual-policy.js';
import {buildVisualBrief,visualFamily} from './visual-brief-model.mjs';
import {visualSystemContract} from './visual-system.mjs';
import {buildCoverBatch} from './cover-generation-model.mjs';
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
test('canonical visual system freezes one scalable workflow instead of per-journey design',()=>{
 const system=visualSystemContract();
 assert.equal(system.policyVersion,'journey-cover-system-v1');
 assert.equal(system.batch.maxJourneys,10);
 assert.equal(system.batch.operatorPromptsPerBatch,1);
 assert.equal(system.batch.imageCallsPerJourney,1);
 assert.equal(system.batch.imagesPerToolCall,1);
 assert.equal(system.batch.singleCallMultiJourneyForbidden,true);
 assert.match(system.batch.carryoverPolicy,/subject, geography, transport and composition must reset/);
 assert.equal(system.families.planetary.productionStrategy,'deterministic-full-bleed-world-route');
});
test('synthetic 10-journey batch has ten explicit independent prompts and no first-scene carryover',()=>{
 const families=['rail-cinematic','road-cinematic','coastal-editorial','nature-atmospheric','culture-editorial'];
 const briefs=Array.from({length:12},(_,i)=>({
  tripId:'future-'+String(i+1).padStart(2,'0'),title:'Future Journey '+(i+1),rank:i+1,priority:'P2',visualFamily:families[i%families.length],productionStrategy:'single-generated-cover',routeCharacter:'future journey',motif:'one plausible representative scene',suggestedAnchor:null,anchorStatus:'unresolved'
 }));
 briefs.push({tripId:'world-195',title:'World',rank:0,priority:'P1',visualFamily:'planetary',productionStrategy:'deterministic-full-bleed-world-route'});
 const {report,operatorPrompt}=buildCoverBatch({briefs,registryAssets:[],limit:10,batchId:'ci-ten',now:new Date('2026-10-03T10:00:00Z')});
 assert.equal(report.items.length,10);
 assert.equal(report.dispatchContract.imageToolCallsRequired,10);
 assert.equal(report.distinctPromptFingerprints,10);
 assert.equal(new Set(report.items.map(x=>x.tripId)).size,10);
 assert.equal(new Set(report.items.map(x=>x.promptSha256)).size,10);
 assert.ok(report.items.every(x=>x.imagesPerToolCall===1&&x.freshSceneRequired));
 assert.ok(report.items.every(x=>x.prompt.includes('fresh independent scene')));
 assert.ok(!report.items.some(x=>x.tripId==='world-195'));
 assert.match(operatorPrompt,/CALL 01 \/ 10/);assert.match(operatorPrompt,/CALL 10 \/ 10/);assert.match(operatorPrompt,/Do NOT reuse the first Journey prompt/i);
});
test('published catalog has one visual brief per journey, six unique region cameras and local flags',async()=>{
 const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const catalog=await read('data/platform/trips.json'),briefs=await read('data/platform/visual-briefs.json'),regions=await read('data/platform/region-visuals.json'),source=await read('assets/flags/SOURCE.json'),system=await read('data/platform/visual-system.json');
 assert.equal(briefs.journeys.length,catalog.trips.length);assert.equal(briefs.summary.journeys,catalog.trips.length);assert.equal(briefs.destinationRecommendations.length,20);assert.equal(briefs.summary.imagesGenerated,0);
 assert.equal(new Set(regions.assets.map(a=>a.outputHash)).size,6);
 assert.equal(source.countries,195);
 assert.equal(system.policyVersion,'journey-cover-system-v1');
 assert.equal(system.batch.maxJourneys,10);
 for(const b of briefs.journeys){
  assert.ok(b.visualFamily&&b.status);
  if(b.productionStrategy==='deterministic-full-bleed-world-route')assert.equal(b.imagePrompt,'');
  else assert.ok(b.imagePrompt);
 }
});
