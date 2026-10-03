import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCoverBatch} from './cover-generation-model.mjs';

const makeBrief=(tripId,visualFamily,rank)=>({
  tripId,
  title:tripId.replaceAll('-',' '),
  rank,
  priority:rank<=4?'P1':'P2',
  visualFamily,
  productionStrategy:'single-generated-cover',
  routeCharacter:'representative journey character',
  motif:'one plausible representative travel scene',
  suggestedAnchor:{type:'country',id:'XX'},
  anchorStatus:'manual-review'
});

const briefs=[
  makeBrief('rail-one','rail-cinematic',1),
  makeBrief('road-one','road-cinematic',2),
  makeBrief('cruise-one','coastal-editorial',3),
  makeBrief('nature-one','nature-atmospheric',4),
  makeBrief('culture-one','culture-editorial',5),
  makeBrief('rail-two','rail-cinematic',6),
  makeBrief('road-two','road-cinematic',7),
  makeBrief('cruise-two','coastal-editorial',8),
  makeBrief('nature-two','nature-atmospheric',9),
  makeBrief('culture-two','culture-editorial',10),
  makeBrief('rail-three','rail-cinematic',11),
  makeBrief('road-three','road-cinematic',12),
  {...makeBrief('world-195','planetary',0),productionStrategy:'deterministic-full-bleed-world-route'}
];

test('one operator instruction yields ten independent distinct journey calls',()=>{
  const now=new Date('2026-10-03T10:00:00.000Z');
  const {report,operatorPrompt}=buildCoverBatch({briefs,registryAssets:[],limit:10,now,batchId:'test-batch'});
  assert.equal(report.items.length,10);
  assert.equal(report.dispatchContract.operatorPromptsPerBatch,1);
  assert.equal(report.dispatchContract.imageToolCallsRequired,10);
  assert.equal(report.dispatchContract.imagesPerToolCall,1);
  assert.equal(report.dispatchContract.freshScenePerCall,true);
  assert.equal(report.distinctPromptFingerprints,10);
  assert.equal(new Set(report.items.map(x=>x.tripId)).size,10);
  assert.equal(new Set(report.items.map(x=>x.promptSha256)).size,10);
  assert.ok(report.items.every(x=>x.imagesPerToolCall===1&&x.freshSceneRequired===true));
  assert.ok(report.items.every(x=>x.prompt.includes(`tripId “${x.tripId}”`)));
  assert.ok(report.items.every(x=>x.prompt.includes('fresh independent scene')));
  assert.ok(!report.items.some(x=>x.tripId==='world-195'));
  assert.match(operatorPrompt,/CALL 01 \/ 10/);
  assert.match(operatorPrompt,/CALL 10 \/ 10/);
  assert.match(operatorPrompt,/reset subject, geography, transport, composition and landmarks/i);
  assert.match(operatorPrompt,/Do NOT reuse the first Journey prompt/i);
});

test('published covers are excluded and deterministic queue choices repeat exactly',()=>{
  const registryAssets=[{tripId:'rail-one',mediaKind:'journey-cover',status:'published',rightsStatus:'approved'}];
  const args={briefs,registryAssets,limit:10,now:new Date('2026-10-03T10:00:00.000Z'),batchId:'repeatable'};
  const a=buildCoverBatch(args).report;
  const b=buildCoverBatch(args).report;
  assert.ok(!a.items.some(x=>x.tripId==='rail-one'));
  assert.deepEqual(a.items,b.items);
});

test('family filtering remains bounded to ten items',()=>{
  const {report}=buildCoverBatch({briefs,registryAssets:[],limit:99,family:'rail-cinematic',batchId:'rail-only'});
  assert.ok(report.items.length<=10);
  assert.ok(report.items.every(x=>x.visualFamily==='rail-cinematic'));
});
