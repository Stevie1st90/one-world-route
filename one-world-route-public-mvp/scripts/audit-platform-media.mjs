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
  const asset=String(entry.asset||'');
  if(!asset.startsWith('./assets/'))errors.push(owner+': image asset must be a local ./assets/ path');
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

console.log('PLATFORM MEDIA AUDIT');
console.log('Art-directed heroes:',artDirected);
console.log('Licensed image assets:',imageAssets);
if(errors.length){
  for(const error of errors)console.error('-',error);
  process.exit(1);
}
console.log('Media contract: PASS');
