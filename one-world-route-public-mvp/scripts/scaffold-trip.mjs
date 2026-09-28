import {readFile,mkdir,writeFile,access} from 'node:fs/promises';
import {scaffoldTripDraft,journeyArchetypes} from './trip-draft-contract.mjs';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('data/platform/trips.json',root),'utf8'));
const args=process.argv.slice(2);
const positional=args.filter(arg=>!arg.startsWith('--'));
const slug=String(positional[0]||'').trim();
const kind=String(positional[1]||'').trim();
const daysArg=args.find(arg=>arg.startsWith('--days='));
const days=daysArg?Number(daysArg.split('=')[1]):null;
const write=args.includes('--write');
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const die=message=>{console.error('Trip scaffold:',message);process.exit(1)};
if(!slugPattern.test(slug))die('first argument must be a normalized slug');
if(!journeyArchetypes().includes(kind))die('kind must be one of: '+journeyArchetypes().join(', '));
if(days!==null&&(!Number.isInteger(days)||days<1))die('--days must be a positive integer');
if((catalog.trips||[]).some(item=>item.id===slug||item.slug===slug))die('trip already exists in public catalog: '+slug);

const result=scaffoldTripDraft({slug,kind,days,catalog});
const output={...result,note:'Draft only. Archetype defaults are generic; complete region, editorial content, graph and source evidence before publication.'};

if(!write){
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}else{
  const dir=new URL('data/platform/drafts/',root);
  await mkdir(dir,{recursive:true});
  const tripUrl=new URL(slug+'.trip.json',dir);
  const catalogUrl=new URL(slug+'.catalog.json',dir);
  try{await access(tripUrl);die('draft already exists: '+tripUrl.pathname)}catch{}
  await writeFile(tripUrl,JSON.stringify(result.trip,null,2)+'\n');
  await writeFile(catalogUrl,JSON.stringify(result.catalogEntry,null,2)+'\n');
  console.log('Created archetype draft:',kind);
  console.log('Created draft trip:',tripUrl.pathname);
  console.log('Created catalog fragment:',catalogUrl.pathname);
  console.log('Nothing was added to the public catalog.');
}
