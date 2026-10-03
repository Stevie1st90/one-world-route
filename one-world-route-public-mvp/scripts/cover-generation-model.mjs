import {createHash} from 'node:crypto';
import {
  COVER_BATCH_POLICY,
  COVER_SYSTEM_VERSION,
  GLOBAL_COVER_QA,
  LIGHTING_PROFILES,
  SPECIAL_JOURNEY_IDS,
  familyProfile
} from './visual-system.mjs';

const hashNumber=s=>[...String(s)].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381);
const sha256=value=>createHash('sha256').update(String(value)).digest('hex');

const compactPrompt=(brief,composition,lighting)=>[
  `Generate exactly ONE 16:9 premium cinematic editorial travel cover for “${brief.title}”.`,
  `Journey identity: tripId “${brief.tripId}”.`,
  brief.routeCharacter?`Journey character: ${brief.routeCharacter}`:'',
  brief.motif?`Scene: ${brief.motif}.`:'',
  `Composition: ${composition}. Lighting: ${lighting}.`,
  'Treat this Journey as a fresh independent scene. Carry over only the shared premium ONE WORLD ROUTE house style; do not carry over subject, geography, transport, composition or landmarks from any previous batch item.',
  'Use one coherent geographically plausible real-world-inspired scene.',
  'No text, numbers, labels, logos, brand livery, maps, route lines, collage, copied photography or documentary-photo claim.'
].filter(Boolean).join(' ');

function roundRobinByFamily(candidates){
  const byFamily=new Map();
  for(const brief of candidates){
    const list=byFamily.get(brief.visualFamily)||[];
    list.push(brief);
    byFamily.set(brief.visualFamily,list);
  }
  for(const list of byFamily.values())list.sort((a,b)=>(a.rank||9999)-(b.rank||9999)||String(a.tripId).localeCompare(String(b.tripId)));
  const ordered=[];
  while(ordered.length<candidates.length){
    let added=false;
    for(const family of [...byFamily.keys()].sort()){
      const list=byFamily.get(family);
      if(list?.length){ordered.push(list.shift());added=true;}
    }
    if(!added)break;
  }
  return ordered;
}

function assertUnique(values,label){
  const seen=new Set();
  for(const value of values){
    if(seen.has(value))throw Error(`Duplicate ${label} in cover queue: ${value}`);
    seen.add(value);
  }
}

export function buildCoverBatch({
  briefs=[],
  registryAssets=[],
  limit=10,
  includeSpecial=false,
  family=null,
  batchId=null,
  now=new Date()
}={}){
  const max=Math.min(10,Math.max(1,Number(limit||10)));
  const special=new Set(SPECIAL_JOURNEY_IDS);
  const published=new Set((registryAssets||[])
    .filter(asset=>asset.mediaKind==='journey-cover'&&asset.status==='published'&&asset.rightsStatus==='approved')
    .map(asset=>asset.tripId));

  let candidates=(briefs||[]).filter(brief=>
    !published.has(brief.tripId)&&
    !special.has(brief.tripId)&&
    brief.productionStrategy!=='deterministic-full-bleed-world-route'
  );
  if(family)candidates=candidates.filter(brief=>brief.visualFamily===family);
  const ordered=roundRobinByFamily(candidates);

  const items=ordered.slice(0,max).map((brief,index)=>{
    const profile=familyProfile(brief.visualFamily);
    const compositions=profile.compositions||['wide environmental journey'];
    const composition=compositions[hashNumber(brief.tripId)%compositions.length];
    const lighting=LIGHTING_PROFILES[hashNumber('light:'+brief.tripId)%LIGHTING_PROFILES.length];
    const version='v001';
    const sourceFilename=`source--journey--${brief.tripId}--cover--16x9--${version}.png`;
    const prompt=compactPrompt(brief,composition,lighting);
    return {
      sequence:index+1,
      callId:`cover-call-${String(index+1).padStart(2,'0')}--${brief.tripId}`,
      tripId:brief.tripId,
      title:brief.title,
      rank:brief.rank,
      priority:brief.priority,
      visualFamily:brief.visualFamily,
      visualArchetype:profile.archetype,
      sourceFilename,
      version,
      generationMode:'one-tool-call-one-image',
      imagesPerToolCall:1,
      freshSceneRequired:true,
      compositionProfile:composition,
      lightingProfile:lighting,
      suggestedAnchor:brief.suggestedAnchor||null,
      anchorStatus:brief.anchorStatus,
      prompt,
      promptSha256:sha256(prompt),
      qa:[...GLOBAL_COVER_QA],
      reviewStatus:'pending-generation'
    };
  });

  assertUnique(items.map(x=>x.tripId),'tripId');
  assertUnique(items.map(x=>x.sourceFilename),'sourceFilename');
  assertUnique(items.map(x=>x.callId),'callId');
  assertUnique(items.map(x=>x.promptSha256),'prompt fingerprint');

  const resolvedBatchId=String(batchId||`cover-batch-${now.toISOString().slice(0,10).replaceAll('-','')}-${String(items[0]?.rank||1).padStart(3,'0')}`);
  const report={
    schemaVersion:4,
    createdAt:now.toISOString(),
    batchId:resolvedBatchId,
    coverSystemVersion:COVER_SYSTEM_VERSION,
    policy:COVER_BATCH_POLICY,
    generationMode:'orchestrated-independent-calls',
    dispatchContract:{
      operatorPromptsPerBatch:1,
      imageToolCallsRequired:items.length,
      imagesPerToolCall:1,
      forbidSingleCallMultiImage:true,
      explicitPromptPerCall:true,
      freshScenePerCall:true,
      carryoverAllowed:['house-style'],
      carryoverForbidden:['subject','geography','transport','composition','landmarks'],
      sequenceLocked:true,
      advanceOnlyAfterSuccessfulCall:true,
      stopAfterCalls:items.length,
      rationale:'One operator instruction covers the batch, but every Journey is an independent image-generation call with an explicit unique prompt. This prevents the first Journey from leaking into later calls.'
    },
    requested:max,
    generated:items.length,
    distinctPromptFingerprints:new Set(items.map(x=>x.promptSha256)).size,
    includeSpecialRequested:Boolean(includeSpecial),
    specialJourneysAlwaysExcluded:true,
    excludedSpecial:[...special].filter(id=>!published.has(id)),
    items
  };

  const operatorPrompt=items.length===0
    ?[
      '# ONE WORLD ROUTE — COVER BATCH EXECUTION',
      '',
      `Batch: ${resolvedBatchId}`,
      'Journeys: 0',
      `System: ${COVER_SYSTEM_VERSION}`,
      '',
      '## NO GENERATION REQUIRED',
      '',
      'There are no eligible unpublished normal Journey covers in this queue.',
      'Published approved covers and deterministic special Journeys are excluded automatically.',
      'Do not call the image generator.'
    ].join('\n')
    :[
      '# ONE WORLD ROUTE — COVER BATCH EXECUTION',
      '',
      `Batch: ${resolvedBatchId}`,
      `Journeys: ${items.length}`,
      `System: ${COVER_SYSTEM_VERSION}`,
      '',
      '## NON-NEGOTIABLE DISPATCH CONTRACT',
      '',
      `Execute exactly ${items.length} SEPARATE image-generation tool calls from this single operator instruction.`,
      'Each tool call must generate exactly ONE image.',
      `Do NOT make one image-generation call with n=${items.length}.`,
      'Every call must receive its own explicit prompt below; never infer later calls from the first prompt.',
      'Before every new call, reset subject, geography, transport, composition and landmarks. Only the shared premium ONE WORLD ROUTE house style may carry across calls.',
      'Do NOT reuse the first Journey prompt, source image or scene for later calls.',
      'After each successful call, advance automatically. Do not ask for approval between items.',
      `Stop immediately after call ${items.length}.`,
      '',
      `The batch is valid only if the call sequence is 1→2→…→${items.length}, every call uses its matching prompt, and all ${items.length} prompt fingerprints are distinct.`,
      '',
      ...items.flatMap(item=>[
        `## CALL ${String(item.sequence).padStart(2,'0')} / ${String(items.length).padStart(2,'0')} — ${item.title}`,
        `tripId: \`${item.tripId}\``,
        `promptSha256: \`${item.promptSha256}\``,
        `expected source filename: \`${item.sourceFilename}\``,
        '',
        item.prompt,
        '',
        `After this ONE image is generated, mark CALL ${String(item.sequence).padStart(2,'0')} complete${item.sequence===items.length?' and STOP — no further generation.':` and continue to CALL ${String(item.sequence+1).padStart(2,'0')}.`}`,
        ''
      ]),
      '## COMPLETION CHECK',
      '',
      `A successful run contains exactly ${items.length} images from exactly ${items.length} independent calls, one per distinct tripId.`,
      'If any later output repeats the subject/geography of an earlier Journey, treat that item as invalid and regenerate only that item with its own explicit prompt.'
    ].join('\n');

  return {report,operatorPrompt};
}
