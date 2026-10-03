import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,relative,basename} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {extractRoute} from './route-visual-model.mjs';
import {renderPremiumWorldOverlay,WORLD_SHOWCASE_STYLE} from './world-showcase-renderer.mjs';

const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=arg.match(/^--([^=]+)(?:=(.*))?$/);
  return m?[m[1],m[2]??true]:[arg,true];
}));
const ROOT=resolve(String(argv.root||process.cwd()));
const publish=String(argv.publish||'false').toLowerCase()==='true'||argv.publish===true;
const approved=String(argv.approved||'false').toLowerCase()==='true'||argv.approved===true;
if(publish&&!approved)throw Error('Publishing world-195 requires --approved=true after visual QA');

const readJson=async p=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
const exists=async p=>access(p).then(()=>true).catch(()=>false);
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const posix=p=>p.split('\\').join('/');
const relAsset=p=>'./'+posix(relative(ROOT,p));

const [spec,catalog,registry,publicRoute,source,countries,waypoints,flights,movements]=await Promise.all([
  readJson('data/platform/world-showcase-visual.json'),
  readJson('data/platform/trips.json'),
  readJson('data/platform/generated-media.json'),
  readJson('data/public-route.json'),
  readJson('data/visual-sources/source.json'),
  readJson('data/country-centroids.json'),
  readJson('data/route-waypoints.json'),
  readJson('data/flight-geometries.json'),
  readJson('data/operational-movements.json')
]);

if(spec.tripId!=='world-195')throw Error('World showcase spec tripId mismatch');
if((publicRoute.countries||[]).length!==195||(publicRoute.segments||[]).length!==194)throw Error('World route invariant mismatch');
const meta=(catalog.trips||[]).find(t=>t.id==='world-195');
if(!meta)throw Error('world-195 catalog entry missing');

const sourcePath=resolve(ROOT,String(source.asset).replace(/^\.\//,''));
if(!(await exists(sourcePath)))throw Error('Natural Earth source missing: '+sourcePath);
const sourceBytes=await readFile(sourcePath);
if(hash(sourceBytes)!==source.sha256||source.rightsStatus!=='approved')throw Error('Natural Earth source provenance invalid');
const sourceMeta=await sharp(sourceBytes).metadata();

const route=extractRoute(meta,publicRoute,{countries,waypoints,flights,movements});
if(route.scope!=='GLOBAL'||route.countries.length!==195)throw Error('Premium world route extraction invariant failed');
const factualHash=hash(JSON.stringify({
  publicRoute,
  routeLines:route.lines,
  renderer:WORLD_SHOWCASE_STYLE.version,
  projection:WORLD_SHOWCASE_STYLE.projection,
  sourceSha256:source.sha256
}));

const widths=[480,800,1200,1600];
const outDir=publish
  ?resolve(ROOT,'assets/media/journeys/world-195/cover/v001')
  :resolve(String(argv['out-dir']||resolve(ROOT,'data/platform/staged-world-showcase')));
await mkdir(outDir,{recursive:true});

const variants=[];
for(const width of widths){
  const height=Math.round(width*9/16);
  const rendered=await renderPremiumWorldOverlay({sourcePath,route,width,height});
  const file='journey--world-195--cover--16x9--v001--w'+width+'.webp';
  const target=resolve(outDir,file);
  await sharp(rendered)
    .webp({quality:86,effort:5,smartSubsample:true})
    .toFile(target);
  variants.push({width,height,asset:publish?relAsset(target):target});
}

const report={
  schemaVersion:1,
  tripId:'world-195',
  mode:publish?'published':'preview',
  mapSourceSha256:source.sha256,
  factualLayerSha256:factualHash,
  renderStyle:WORLD_SHOWCASE_STYLE.version,
  projection:WORLD_SHOWCASE_STYLE.projection,
  fullBleed:WORLD_SHOWCASE_STYLE.fullBleed,
  spaceBackground:WORLD_SHOWCASE_STYLE.spaceBackground,
  invariants:{countries:195,internationalLegs:194},
  variants
};

if(!publish){
  await writeFile(resolve(outDir,'world-showcase-preview.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  process.exit(0);
}

registry.assets=Array.isArray(registry.assets)?registry.assets:[];
const assetId=spec.finalCover.assetId;
const primary=variants.at(-1);
const title=meta.title||{};
const alt=Object.fromEntries(Object.entries(title).map(([locale,value])=>[locale,String(value)+' · full-bleed world route map with verified journey geometry']));
const entry={
  assetId,
  tripId:'world-195',
  type:'image',
  sourceType:'generated',
  mediaKind:'journey-cover',
  theme:meta.visual?.theme||'ocean',
  generator:'ONE WORLD ROUTE deterministic full-bleed world renderer',
  promptVersion:'world-showcase-full-bleed-v1',
  createdAt:new Date().toISOString().slice(0,10),
  rightsStatus:'approved',
  status:'published',
  aspectRatio:'16:9',
  alt,
  attribution:'Made with Natural Earth · ONE WORLD ROUTE',
  attributionRequired:false,
  license:'Natural Earth public domain; original route presentation',
  focalPoint:{x:.5,y:.5},
  asset:primary.asset,
  srcset:variants.map(v=>v.asset+' '+v.width+'w').join(', '),
  sourceMaster:{
    originalFilename:basename(sourcePath),
    sha256:source.sha256,
    width:sourceMeta.width,
    height:sourceMeta.height,
    bytes:sourceBytes.byteLength,
    retainedOutsideDeliveryRepo:false
  },
  factualRouteLayer:{
    assetId:spec.factualLayer.assetId,
    sha256:factualHash,
    renderStyle:WORLD_SHOWCASE_STYLE.version,
    projection:WORLD_SHOWCASE_STYLE.projection,
    provider:spec.factualLayer.provider,
    countries:195,
    internationalLegs:194,
    routeLines:spec.factualLayer.routeLines
  },
  delivery:{format:'webp',quality:86,variants}
};
const idx=registry.assets.findIndex(a=>a.assetId===assetId);
if(idx>=0)registry.assets[idx]=entry;else registry.assets.push(entry);
registry.assets.sort((a,b)=>String(a.assetId).localeCompare(String(b.assetId)));
await writeFile(resolve(ROOT,'data/platform/generated-media.json'),JSON.stringify(registry,null,2)+'\n');

publicRoute.media={...(publicRoute.media||{}),heroAssetId:assetId};
await writeFile(resolve(ROOT,'data/public-route.json'),JSON.stringify(publicRoute,null,2)+'\n');

spec.status='published';
spec.publishedAssetId=assetId;
spec.factualLayer.sha256=factualHash;
await writeFile(resolve(ROOT,'data/platform/world-showcase-visual.json'),JSON.stringify(spec,null,2)+'\n');

console.log(JSON.stringify({...report,assetId},null,2));
