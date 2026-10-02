import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=arg.match(/^--([^=]+)(?:=(.*))?$/);
  return m?[m[1],m[2]??true]:[arg,true];
}));
const ROOT=resolve(String(argv.root||process.cwd()));
const limit=Math.min(10,Math.max(1,Number(argv.limit||10)));
const specialJourneyIds=new Set(['world-195']);
const includeSpecial=String(argv['include-special']||'false').toLowerCase()==='true'||argv['include-special']===true;
const read=async p=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
const [briefs,registry]=await Promise.all([
  read('data/platform/visual-briefs.json'),
  read('data/platform/generated-media.json')
]);

const published=new Set((registry.assets||[])
  .filter(a=>a.mediaKind==='journey-cover'&&a.status==='published'&&a.rightsStatus==='approved')
  .map(a=>a.tripId));
const hash=s=>[...s].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381);
const profiles={
  'road-cinematic':['wide environmental journey','elevated route overview','three-quarter travel-mode scene','low-horizon landscape','journey element small in a large landscape'],
  'rail-cinematic':['wide rail-in-landscape','three-quarter train passage','elevated rail corridor','train small in a large landscape','layered environmental rail scene'],
  'nature-atmospheric':['immersive environmental overlook','trail-led landscape','layered atmospheric landscape','wide natural panorama','foreground nature framing'],
  'coastal-editorial':['island-chain passage','ferry-in-open-water','elevated coastal overview','harbor-to-horizon passage','wide sea-and-islands scene'],
  'culture-editorial':['human-scale street scene','architectural arrival','layered neighborhood view','public-space travel scene','city-and-landscape relationship'],
  'planetary':['cinematic Earth portrait without route overlay']
};
const lights=['soft morning light','clear daylight','diffuse overcast light','late directional light','blue-hour transition','misty directional light'];

let candidates=(briefs.journeys||[]).filter(b=>!published.has(b.tripId)&&(includeSpecial||!specialJourneyIds.has(b.tripId)));
if(argv.family)candidates=candidates.filter(b=>b.visualFamily===argv.family);
const byFamily=new Map();
for(const b of candidates){
  const a=byFamily.get(b.visualFamily)||[];
  a.push(b);
  byFamily.set(b.visualFamily,a);
}
for(const arr of byFamily.values())arr.sort((a,b)=>a.rank-b.rank);
const ordered=[];
while(ordered.length<candidates.length){
  let added=false;
  for(const family of [...byFamily.keys()].sort()){
    const arr=byFamily.get(family);
    if(arr?.length){ordered.push(arr.shift());added=true;}
  }
  if(!added)break;
}

const compactPrompt=(b,composition,lighting)=>[
  `Generate exactly ONE 16:9 premium cinematic editorial travel cover for “${b.title}”.`,
  b.routeCharacter ? `Journey character: ${b.routeCharacter}` : '',
  b.motif ? `Scene: ${b.motif}.` : '',
  `Composition: ${composition}. Lighting: ${lighting}.`,
  'Use one coherent geographically plausible real-world-inspired scene.',
  'No text, numbers, labels, logos, brand livery, maps, route lines, collage, copied photography or documentary-photo claim.'
].filter(Boolean).join(' ');

const items=ordered.slice(0,limit).map((b,index)=>{
  const ps=profiles[b.visualFamily]||['wide environmental journey'];
  const composition=ps[hash(b.tripId)%ps.length];
  const lighting=lights[hash('light:'+b.tripId)%lights.length];
  const version='v001';
  const sourceFilename=`source--journey--${b.tripId}--cover--16x9--${version}.png`;
  return {
    sequence:index+1,
    callId:`cover-call-${String(index+1).padStart(2,'0')}--${b.tripId}`,
    tripId:b.tripId,
    title:b.title,
    rank:b.rank,
    priority:b.priority,
    visualFamily:b.visualFamily,
    sourceFilename,
    version,
    generationMode:'one-tool-call-one-image',
    imagesPerToolCall:1,
    compositionProfile:composition,
    lightingProfile:lighting,
    suggestedAnchor:b.suggestedAnchor||null,
    anchorStatus:b.anchorStatus,
    prompt:compactPrompt(b,composition,lighting),
    qa:[
      'one coherent scene',
      'journey mode/character readable at thumbnail size',
      'no visible text or logos',
      'no invented map or route overlay',
      'geography plausible for approved anchor',
      'not visually repetitive with adjacent batch items'
    ],
    reviewStatus:'pending-generation'
  };
});

const unique=(values,label)=>{
  const seen=new Set();
  for(const value of values){
    if(seen.has(value))throw Error(`Duplicate ${label} in cover queue: ${value}`);
    seen.add(value);
  }
};
unique(items.map(x=>x.tripId),'tripId');
unique(items.map(x=>x.sourceFilename),'sourceFilename');
unique(items.map(x=>x.callId),'callId');

const now=new Date();
const batchId=String(argv['batch-id']||`cover-batch-${now.toISOString().slice(0,10).replaceAll('-','')}-${String(items[0]?.rank||1).padStart(3,'0')}`);
const report={
  schemaVersion:3,
  createdAt:now.toISOString(),
  batchId,
  policy:'batch-cover-generation-v3',
  generationMode:'orchestrated-independent-calls',
  dispatchContract:{
    operatorPromptsPerBatch:1,
    imageToolCallsRequired:items.length,
    imagesPerToolCall:1,
    forbidSingleCallMultiImage:true,
    sequenceLocked:true,
    advanceOnlyAfterSuccessfulCall:true,
    stopAfterCalls:items.length,
    rationale:'One operator instruction may cover the batch, but each Journey must be dispatched as its own image-generation call. A single n>1 image call produces variants of one effective prompt and is invalid for a multi-Journey batch.'
  },
  requested:limit,
  generated:items.length,
  includeSpecial,
  excludedSpecial:[...specialJourneyIds].filter(id=>!includeSpecial&&!published.has(id)),
  items
};

const out=resolve(ROOT,String(argv.out||'data/platform/cover-generation-queue.json'));
await writeFile(out,JSON.stringify(report,null,2)+'\n');

const operatorPrompt=[
  '# ONE WORLD ROUTE — COVER BATCH EXECUTION',
  '',
  `Batch: ${batchId}`,
  `Journeys: ${items.length}`,
  '',
  '## NON-NEGOTIABLE DISPATCH CONTRACT',
  '',
  `Execute exactly ${items.length} SEPARATE image-generation tool calls from this single instruction.`,
  'Each tool call must generate exactly ONE image (n=1).',
  `Do NOT make one image-generation call with n=${items.length}.`,
  'Do NOT reuse the first Journey prompt for later calls.',
  'After each successful call, advance to the next numbered item automatically. Do not ask for approval between items.',
  `Stop immediately after call ${items.length}.`,
  '',
  'The batch is valid only if the tool-call sequence is 1→2→…→'+items.length+' and each call uses the matching prompt below.',
  '',
  ...items.flatMap(item=>[
    `## CALL ${String(item.sequence).padStart(2,'0')} / ${String(items.length).padStart(2,'0')} — ${item.title}`,
    `tripId: \`${item.tripId}\``,
    `expected source filename: \`${item.sourceFilename}\``,
    '',
    item.prompt,
    '',
    `After this ONE image is generated, mark CALL ${String(item.sequence).padStart(2,'0')} complete${item.sequence===items.length?' and STOP — no further generation.':` and continue to CALL ${String(item.sequence+1).padStart(2,'0')}.`}`,
    ''
  ]),
  '## COMPLETION CHECK',
  '',
  `A successful run contains exactly ${items.length} images from exactly ${items.length} separate tool calls, one per distinct tripId.`,
  'If the image tool attempts to return multiple variants from one Journey, that call is invalid: use n=1 and continue with the next distinct Journey.'
].join('\n');

if(argv['prompt-out']){
  const promptOut=resolve(ROOT,String(argv['prompt-out']));
  await writeFile(promptOut,operatorPrompt+'\n');
  console.log('Cover operator prompt:',promptOut);
}
console.log('Cover generation queue:',items.length,'->',out);
console.log('Dispatch contract:',`${items.length} separate image calls × 1 image`);
