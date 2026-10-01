import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{const m=arg.match(/^--([^=]+)(?:=(.*))?$/);return m?[m[1],m[2]??true]:[arg,true]}));
const ROOT=resolve(String(argv.root||process.cwd())),limit=Math.max(1,Number(argv.limit||24));
const read=async p=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
const [briefs,registry]=await Promise.all([read('data/platform/visual-briefs.json'),read('data/platform/generated-media.json')]);
const published=new Set((registry.assets||[]).filter(a=>a.mediaKind==='journey-cover'&&a.status==='published'&&a.rightsStatus==='approved').map(a=>a.tripId));
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
let candidates=(briefs.journeys||[]).filter(b=>!published.has(b.tripId));
if(argv.family)candidates=candidates.filter(b=>b.visualFamily===argv.family);
const byFamily=new Map();
for(const b of candidates){const a=byFamily.get(b.visualFamily)||[];a.push(b);byFamily.set(b.visualFamily,a);}
for(const arr of byFamily.values())arr.sort((a,b)=>a.rank-b.rank);
const ordered=[];
while(ordered.length<candidates.length){
  let added=false;
  for(const family of [...byFamily.keys()].sort()){
    const arr=byFamily.get(family);if(arr?.length){ordered.push(arr.shift());added=true;}
  }
  if(!added)break;
}
const items=ordered.slice(0,limit).map(b=>{
 const ps=profiles[b.visualFamily]||['wide environmental journey'];
 const composition=ps[hash(b.tripId)%ps.length],lighting=lights[hash('light:'+b.tripId)%lights.length];
 const version='v001',sourceFilename=`source--journey--${b.tripId}--cover--16x9--${version}.png`;
 const prompt=b.imagePrompt+` Composition profile: ${composition}. Lighting variation: ${lighting}. Avoid repeating the standard vehicle-or-train-centered golden-hour composition used by unrelated journeys.`;
 return {tripId:b.tripId,title:b.title,rank:b.rank,priority:b.priority,visualFamily:b.visualFamily,sourceFilename,version,compositionProfile:composition,lightingProfile:lighting,suggestedAnchor:b.suggestedAnchor||null,anchorStatus:b.anchorStatus,prompt,qa:['one coherent scene','journey mode/character readable at thumbnail size','no visible text or logos','no invented map or route overlay','geography plausible for approved anchor','not visually repetitive with adjacent batch items'],reviewStatus:'pending'};
});
const report={schemaVersion:1,createdAt:new Date().toISOString(),policy:'batch-cover-generation-v1',requested:limit,generated:items.length,items};
const out=resolve(ROOT,String(argv.out||'data/platform/cover-generation-queue.json'));
await writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log('Cover generation queue:',items.length,'->',out);
