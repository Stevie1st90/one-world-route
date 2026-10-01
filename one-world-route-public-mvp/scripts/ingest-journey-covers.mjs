import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=arg.match(/^--([^=]+)(?:=(.*))?$/);return m?[m[1],m[2]??true]:[arg,true];
}));
const ROOT=resolve(String(argv.root||process.cwd()));
if(!argv.spec)throw Error('Usage: node scripts/ingest-journey-covers.mjs --spec=/path/batch.json --source-dir=/path/source-masters [--root=/project/root]');
const SPEC=resolve(String(argv.spec)),SOURCE=resolve(String(argv['source-dir']||dirname(SPEC)));
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const exists=async p=>access(p).then(()=>true).catch(()=>false);
const posix=p=>p.split('\\').join('/');
const relAsset=p=>'./'+posix(relative(ROOT,p));
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');

const spec=await readJson(SPEC);
const catalogPath=resolve(ROOT,'data/platform/trips.json');
const registryPath=resolve(ROOT,'data/platform/generated-media.json');
const catalog=await readJson(catalogPath);
const registry=await readJson(registryPath);
registry.schemaVersion=Math.max(1,Number(registry.schemaVersion||1));
registry.assets=Array.isArray(registry.assets)?registry.assets:[];

const defaults={
  widths:spec.output?.widths||[480,800,1200,1600],
  quality:Number(spec.output?.quality||84),
  generator:spec.generator||'OpenAI Image Generation',
  promptVersion:spec.promptVersion||'journey-cover-v1',
  attribution:spec.attribution||'Generated for ONE WORLD ROUTE',
  license:spec.license||'project-generated-asset',
  attributionRequired:spec.attributionRequired===true,
  createdAt:spec.createdAt||new Date().toISOString().slice(0,10),
  rightsStatus:spec.rightsStatus||'review-required',
  status:spec.status||'review-required'
};
const result=[];
for(const item of spec.items||[]){
  const tripId=String(item.tripId||'').trim();
  if(!/^[a-z0-9][a-z0-9-]+$/.test(tripId))throw Error('Invalid tripId: '+tripId);
  const meta=catalog.trips.find(t=>t.id===tripId);
  if(!meta)throw Error('Unknown tripId: '+tripId);
  if(item.reviewStatus!=='approved')throw Error(tripId+': ingestion requires explicit reviewStatus=approved');
  const version=String(item.version||'v001');
  if(!/^v\d{3,}$/.test(version))throw Error(tripId+': version must look like v001');
  const sourcePath=resolve(SOURCE,String(item.sourceFilename||''));
  if(!(await exists(sourcePath)))throw Error(tripId+': source missing '+sourcePath);
  const bytes=await readFile(sourcePath),sourceSha=hash(bytes);
  if(item.sourceSha256&&item.sourceSha256!==sourceSha)throw Error(tripId+': source SHA-256 mismatch');
  const sourceMeta=await sharp(bytes).metadata();
  if(!sourceMeta.width||!sourceMeta.height)throw Error(tripId+': unreadable source dimensions');
  if(sourceMeta.width<800)throw Error(tripId+': source too small for production cover');
  const assetId=`journey--${tripId}--cover--16x9--${version}`;
  const outDir=resolve(ROOT,`assets/media/journeys/${tripId}/cover/${version}`);
  await mkdir(outDir,{recursive:true});
  const available=[...new Set(defaults.widths.map(Number).filter(w=>Number.isFinite(w)&&w>=320&&w<=sourceMeta.width))].sort((a,b)=>a-b);
  if(!available.length)available.push(Math.min(800,sourceMeta.width));
  const variants=[];
  for(const width of available){
    const height=Math.round(width*9/16);
    const file=`journey--${tripId}--cover--16x9--${version}--w${width}.webp`;
    const target=resolve(outDir,file);
    await sharp(bytes).rotate().resize(width,height,{fit:'cover',position:'centre'}).webp({quality:defaults.quality,effort:5,smartSubsample:true}).toFile(target);
    variants.push({width,height,asset:relAsset(target)});
  }
  const primary=variants.at(-1);
  const focal={
    x:Math.max(0,Math.min(1,Number(item.focalPoint?.x??.5))),
    y:Math.max(0,Math.min(1,Number(item.focalPoint?.y??.5)))
  };
  const entry={
    assetId,tripId,type:'image',sourceType:'generated',mediaKind:'journey-cover',
    theme:item.theme||meta.visual?.theme||'ocean',
    generator:item.generator||defaults.generator,
    promptVersion:item.promptVersion||defaults.promptVersion,
    createdAt:item.createdAt||defaults.createdAt,
    rightsStatus:'approved',status:'published',aspectRatio:'16:9',
    alt:item.alt||{en:String(meta.title?.en||tripId)+' travel illustration'},
    attribution:item.attribution||defaults.attribution,
    attributionRequired:item.attributionRequired??defaults.attributionRequired,
    license:item.license||defaults.license,
    focalPoint:focal,
    asset:primary.asset,
    srcset:variants.map(v=>`${v.asset} ${v.width}w`).join(', '),
    sourceMaster:{
      originalFilename:String(item.sourceFilename),
      sha256:sourceSha,
      width:sourceMeta.width,height:sourceMeta.height,bytes:bytes.byteLength,
      retainedOutsideDeliveryRepo:true
    },
    delivery:{format:'webp',quality:defaults.quality,variants}
  };
  const previous=registry.assets.findIndex(a=>a.assetId===assetId);
  if(previous>=0)registry.assets[previous]=entry;else registry.assets.push(entry);
  const dataset=resolve(ROOT,String(meta.dataset).replace(/^\.\//,''));
  const trip=await readJson(dataset);
  trip.media={...(trip.media||{}),heroAssetId:assetId};
  await writeFile(dataset,JSON.stringify(trip,null,2)+'\n');
  result.push({tripId,assetId,primary:primary.asset,sourceSha256:sourceSha,variants:variants.length});
}
registry.assets.sort((a,b)=>String(a.assetId).localeCompare(String(b.assetId)));
await writeFile(registryPath,JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify({batchId:spec.batchId||null,ingested:result.length,items:result},null,2));
