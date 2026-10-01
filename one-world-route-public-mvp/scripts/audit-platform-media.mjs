import {readFile,access} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const readJson=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const catalog=await readJson('data/platform/trips.json');
const errors=[];
let artDirected=0,imageAssets=0;

async function validateMedia(owner,entry){
  if(!entry)return;
  if(entry.type==='art-directed'){artDirected++;if(!String(entry.theme||'').trim())errors.push(owner+': art-directed media requires theme');return}
  if(entry.type!=='image'){errors.push(owner+': unsupported media type '+entry.type);return}
  imageAssets++;
  if(entry.sourceType==='generated'&&(entry.status!=='published'||entry.rightsStatus!=='approved'))errors.push(owner+': generated image is not approved/published');
  const asset=String(entry.asset||'');
  if(!/^\.\/assets\/[a-z0-9_./-]+$/i.test(asset)||asset.split('/').includes('..'))errors.push(owner+': image asset must be a local ./assets/ path');
  if(!String(entry.attribution||'').trim())errors.push(owner+': image requires attribution');
  if(!String(entry.license||'').trim())errors.push(owner+': image requires license');
  if(asset.startsWith('./assets/')){
    await access(new URL(asset.replace(/^\.\//,''),root)).catch(()=>errors.push(owner+': missing media asset '+asset));
  }
}

for(const meta of catalog.trips||[]){
  if(meta.renderer==='legacy-world')continue;
  const trip=await readJson(String(meta.dataset).replace(/^\.\//,''));
  await validateMedia(meta.id+' hero',trip.media?.hero);
  for(const [index,item] of (trip.media?.gallery||[]).entries())await validateMedia(meta.id+' gallery '+(index+1),item);
}

const registry=await readJson('data/platform/generated-media.json');
const assetIds=new Set();
for(const item of registry.assets||[]){
  if(!item.assetId||assetIds.has(item.assetId))errors.push('Registry requires unique asset IDs');
  assetIds.add(item.assetId);
  if(item.status!=='published')continue;
  for(const key of ['assetId','sourceType','mediaKind','createdAt','rightsStatus','aspectRatio','alt','attributionRequired','focalPoint'])if(item[key]===undefined||item[key]===null||item[key]==='')errors.push('Generated media missing '+key);
  if(!['generated','owned','licensed'].includes(item.sourceType))errors.push(item.assetId+': unsupported source type');
  if(item.destination&&(!['continent','region','country','place'].includes(item.destination.type)||!String(item.destination.id||'').trim()))errors.push(item.assetId+': invalid destination identity');
  if(item.sourceType==='generated'&&(!item.generator||!item.promptVersion))errors.push(item.assetId+': generated provenance required');
  if(!['16:9','4:5','9:16'].includes(item.aspectRatio))errors.push(item.assetId+': unsupported aspect ratio');
  if(!/^\d{4}-\d{2}-\d{2}/.test(item.createdAt||''))errors.push(item.assetId+': creation date required');
  for(const focal of [item.focalPoint,...Object.values(item.derivatives||{}).map(child=>child.focalPoint)])if(!focal||![focal.x,focal.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1))errors.push(item.assetId+': normalized focal point required');
  await validateMedia(item.assetId,item);
  for(const child of Object.values(item.derivatives||{}))await validateMedia(item.assetId+' derivative',{...item,...child});
}
for(const meta of catalog.trips||[]){
  const trip=await readJson(meta.dataset.replace(/^\.\//,''));
  const ref=trip.media?.heroAssetId||meta.visual?.coverAssetId;
  if(ref&&!assetIds.has(ref))errors.push(meta.id+': missing referenced registry asset '+ref);
  const anchor=meta.visualAnchor||meta.visual?.visualAnchor||trip.visualAnchor;
  if(anchor&&(!['continent','region','country','place'].includes(anchor.type)||!String(anchor.id||'').trim()))errors.push(meta.id+': invalid visual anchor');
}
console.log('PLATFORM MEDIA AUDIT');
console.log('Art-directed heroes:',artDirected);
console.log('Licensed image assets:',imageAssets);
if(errors.length){
  for(const error of errors)console.error('-',error);
  process.exit(1);
}
console.log('Media contract: PASS');
