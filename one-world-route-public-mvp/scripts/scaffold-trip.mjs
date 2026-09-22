import {readFile,mkdir,writeFile,access} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('data/platform/trips.json',root),'utf8'));
const args=process.argv.slice(2);
const slug=String(args.find(a=>!a.startsWith('--'))||'').trim();
const positional=args.filter(a=>!a.startsWith('--'));
const kind=String(positional[1]||'custom').trim();
const daysArg=args.find(a=>a.startsWith('--days='));
const days=daysArg?Number(daysArg.split('=')[1]):null;
const write=args.includes('--write');
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const die=m=>{console.error('Trip scaffold:',m);process.exit(1)};
if(!slugPattern.test(slug))die('first argument must be a normalized slug');
if(!slugPattern.test(kind))die('kind must be a normalized slug');
if(days!==null&&(!Number.isInteger(days)||days<1))die('--days must be a positive integer');
if((catalog.trips||[]).some(t=>t.id===slug||t.slug===slug))die('trip already exists in public catalog: '+slug);

const locales=catalog.supportedLocales||['en'];
const human=slug.split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ');
const localized=value=>Object.fromEntries(locales.map(l=>[l,value]));
const durationBand=days==null?'TODO':days<=14?'7-14':days<=30?'15-30':days<=89?'31-89':'90-plus';

const trip={
  schemaVersion:1,
  id:slug,
  slug,
  kind,
  status:'draft',
  defaultLocale:catalog.defaultLocale||'en',
  supportedLocales:[...locales],
  title:localized(human),
  summary:localized('TODO — editorial summary'),
  geography:{regions:[],countries:[]},
  planning:{days,currency:'EUR'},
  rendering:{},
  places:[],
  stops:[],
  segments:[],
  chapters:[],
  travellerContext:{scope:[]},
  sources:[],
  extensions:{}
};

const catalogEntry={
  id:slug,
  slug,
  kind,
  status:'draft',
  renderer:'regional-globe',
  dataset:`./data/platform/trips/${slug}.json`,
  title:localized(human),
  subtitle:localized('TODO — public discovery subtitle'),
  metrics:{days,stops:0,countries:0},
  capabilities:['globe','story','terrain'],
  discovery:{
    regions:[],
    themes:[],
    modes:[],
    durationBand,
    fit:{pace:'TODO',seasons:[],party:[],startRegion:'',accessibility:'TODO'}
  }
};

const output={trip,catalogEntry,note:'Draft only. Complete metadata, sources and validation before moving the trip into the public catalog.'};

if(!write){
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}else{
  const dir=new URL('../../internal-trip-builder/drafts/',import.meta.url);
  await mkdir(dir,{recursive:true});
  const tripUrl=new URL(slug+'.trip.json',dir);
  const catalogUrl=new URL(slug+'.catalog.json',dir);
  try{await access(tripUrl);die('draft already exists: '+tripUrl.pathname)}catch{}
  await writeFile(tripUrl,JSON.stringify(trip,null,2)+'\n');
  await writeFile(catalogUrl,JSON.stringify(catalogEntry,null,2)+'\n');
  console.log('Created draft trip:',tripUrl.pathname);
  console.log('Created catalog fragment:',catalogUrl.pathname);
  console.log('Draft is outside the public Vercel root. Nothing was added to the public catalog.');
}
