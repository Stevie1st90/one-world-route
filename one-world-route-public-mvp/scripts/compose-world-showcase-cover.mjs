import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {extractRoute} from './route-visual-model.mjs';
import {renderPremiumWorldOverlay} from './world-showcase-renderer.mjs';

const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=arg.match(/^--([^=]+)(?:=(.*))?$/);
  return m?[m[1],m[2]??true]:[arg,true];
}));
const ROOT=resolve(String(argv.root||process.cwd()));
if(!argv.base)throw Error('Usage: node scripts/compose-world-showcase-cover.mjs --base=/path/base.png [--out-dir=/path/preview] [--publish=true --approved=true]');
const BASE=resolve(String(argv.base));
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
if(!(await exists(BASE)))throw Error('Base image missing: '+BASE);

const baseBytes=await readFile(BASE);
const baseMeta=await sharp(baseBytes).metadata();
if(!baseMeta.width||!baseMeta.height)throw Error('Unreadable world showcase base image');
const ratio=baseMeta.width/baseMeta.height;
if(Math.abs(ratio-16/9)>.03)throw Error('World showcase base must be approximately 16:9');
if(baseMeta.width<1600)throw Error('World showcase base must be at least 1600px wide');

const sourcePath=resolve(ROOT,String(source.asset).replace(/^\.\//,''));
if(!(await exists(sourcePath)))throw Error('Natural Earth source missing: '+sourcePath);
const sourceBytes=await readFile(sourcePath);
if(hash(sourceBytes)!==source.sha256||source.rightsStatus!=='approved')throw Error('Natural Earth source provenance invalid');

const route=extractRoute(meta,publicRoute,{countries,waypoints,flights,movements});
if(route.scope!=='GLOBAL'||route.countries.length!==195)throw Error('Premium world route extraction invariant failed');
const factualHash=hash(JSON.stringify({publicRoute,routeLines:route.lines,renderer:'premium-flat-world-v5',sourceSha256:source.sha256}));

const widths=[480,800,1200,1600];
const outDir=publish
  ?resolve(ROOT,'assets/media/journeys/world-195/cover/v001')
  :resolve(String(argv['out-dir']||resolve(ROOT,'data/platform/staged-world-showcase')));
await mkdir(outDir,{recursive:true});

const variants=[];
for(const width of widths){
  const height=Math.round(width*9/16);
  const background=await sharp(baseBytes)
    .rotate()
    .resize(width,height,{fit:'cover',position:'centre'})
    .modulate({brightness:.78,saturation:.82})
    .toBuffer();

  const routeLayer=await renderPremiumWorldOverlay({
    sourcePath,
    route,
    width,
    height
  });

  const shade=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+
    '<defs>'+
      '<linearGradient id="v" x1="0" y1="0" x2="0" y2="1">'+
        '<stop offset="0" stop-color="#020812" stop-opacity=".22"/>'+
        '<stop offset=".48" stop-color="#020812" stop-opacity="0"/>'+
        '<stop offset="1" stop-color="#020812" stop-opacity=".38"/>'+
      '</linearGradient>'+
      '<radialGradient id="g" cx=".5" cy=".48" r=".68">'+
        '<stop offset="0" stop-color="#7bd7ff" stop-opacity=".08"/>'+
        '<stop offset=".7" stop-color="#1c6f9a" stop-opacity=".02"/>'+
        '<stop offset="1" stop-color="#000" stop-opacity=".22"/>'+
      '</radialGradient>'+
    '</defs>'+
    '<rect width="100%" height="100%" fill="url(#g)"/>'+
    '<rect width="100%" height="100%" fill="url(#v)"/>'+
    '</svg>'
  );

  const file='journey--world-195--cover--16x9--v001--w'+width+'.webp';
  const target=resolve(outDir,file);
  await sharp(background)
    .composite([
      {input:routeLayer,blend:'over'},
      {input:shade,blend:'over'}
    ])
    .webp({quality:84,effort:5,smartSubsample:true})
    .toFile(target);
  variants.push({width,height,asset:publish?relAsset(target):target});
}

const report={
  schemaVersion:1,
  tripId:'world-195',
  mode:publish?'published':'preview',
  baseSha256:hash(baseBytes),
  factualLayerSha256:factualHash,
  factualLayerAsset:spec.factualLayer.asset,
  renderStyle:'premium-flat-world-v5',
  projection:'robinson-like-compromise-v5',
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
const alt=Object.fromEntries(Object.entries(title).map(([locale,value])=>[locale,String(value)+' · cinematic world journey illustration with verified route geometry']));
const entry={
  assetId,
  tripId:'world-195',
  type:'image',
  sourceType:'generated',
  mediaKind:'journey-cover',
  theme:meta.visual?.theme||'ocean',
  generator:'OpenAI Image Generation + ONE WORLD ROUTE factual flat-world compositor',
  promptVersion:spec.baseImage.promptVersion,
  createdAt:new Date().toISOString().slice(0,10),
  rightsStatus:'approved',
  status:'published',
  aspectRatio:'16:9',
  alt,
  attribution:'Generated for ONE WORLD ROUTE · factual flat world and route layer made with Natural Earth',
  attributionRequired:false,
  license:'project-generated base; Natural Earth public-domain route layer',
  focalPoint:{x:.5,y:.5},
  asset:primary.asset,
  srcset:variants.map(v=>v.asset+' '+v.width+'w').join(', '),
  sourceMaster:{
    originalFilename:spec.baseImage.sourceFilename,
    sha256:hash(baseBytes),
    width:baseMeta.width,
    height:baseMeta.height,
    bytes:baseBytes.byteLength,
    retainedOutsideDeliveryRepo:true
  },
  factualRouteLayer:{
    assetId:spec.factualLayer.assetId,
    asset:spec.factualLayer.asset,
    sha256:factualHash,
    renderStyle:'premium-flat-world-v5',
    projection:'robinson-like-compromise-v5',
    provider:spec.factualLayer.provider,
    countries:195,
    internationalLegs:194,
    routeLines:spec.factualLayer.routeLines
  },
  delivery:{format:'webp',quality:84,variants}
};
const idx=registry.assets.findIndex(a=>a.assetId===assetId);
if(idx>=0)registry.assets[idx]=entry;else registry.assets.push(entry);
registry.assets.sort((a,b)=>String(a.assetId).localeCompare(String(b.assetId)));
await writeFile(resolve(ROOT,'data/platform/generated-media.json'),JSON.stringify(registry,null,2)+'\n');

publicRoute.media={...(publicRoute.media||{}),heroAssetId:assetId};
await writeFile(resolve(ROOT,'data/public-route.json'),JSON.stringify(publicRoute,null,2)+'\n');

spec.status='published';
spec.publishedAssetId=assetId;
spec.baseImage.sha256=hash(baseBytes);
spec.factualLayer.sha256=factualHash;
await writeFile(resolve(ROOT,'data/platform/world-showcase-visual.json'),JSON.stringify(spec,null,2)+'\n');

console.log(JSON.stringify({...report,assetId},null,2));
