import {readFile,writeFile} from 'node:fs/promises';
import {buildTripIndex} from './trip-index-model.mjs';
import {buildDiscoveryIndex} from './discovery-index-model.mjs';

const root=new URL('../',import.meta.url);
const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const catalog=await readJson(new URL('data/platform/trips.json',root));
const datasets=new Map();

for(const meta of catalog.trips||[]){
  const relative=String(meta.dataset||'').replace(/^\.\//,'');
  if(!relative.startsWith('data/'))throw new Error('Trip dataset must stay under data/: '+meta.id);
  datasets.set(meta.id,await readJson(new URL(relative,root)));
}

const index=buildTripIndex(catalog,datasets);
const output=JSON.stringify(index,null,2)+'\n';
const target=new URL('data/platform/trip-index.json',root);

if(process.argv.includes('--check')){
  const current=await readFile(target,'utf8').catch(()=>null);
  if(current!==output){
    console.error('TRIP INDEX: generated index is stale. Run node scripts/build-trip-index.mjs');
    process.exitCode=1;
  }
}else{
  await writeFile(target,output,'utf8');
}
console.log('Trip index',index.trips.length,'journeys · catalog',index.catalogUpdatedAt||'unknown');
const discoveryTarget=new URL('data/platform/discovery-index.json',root);
const discoveryOutput=JSON.stringify(buildDiscoveryIndex(index))+'\n';
if(process.argv.includes('--check')){
  if(await readFile(discoveryTarget,'utf8').catch(()=>null)!==discoveryOutput){
    console.error('DISCOVERY INDEX: generated index is stale');process.exitCode=1;
  }
}else await writeFile(discoveryTarget,discoveryOutput);
