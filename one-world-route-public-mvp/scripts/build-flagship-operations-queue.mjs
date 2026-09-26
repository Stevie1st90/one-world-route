import {readFile,writeFile} from 'node:fs/promises';
import {buildFlagshipReadiness} from './flagship-readiness-model.mjs';
import {buildFlagshipOperationsQueue} from './flagship-operations-queue-model.mjs';

const dataUrl=name=>new URL('../data/'+name,import.meta.url);
const read=async name=>JSON.parse(await readFile(dataUrl(name),'utf8'));

const inputs={
  route:await read('public-route.json'),
  waypoints:await read('route-waypoints.json'),
  flights:await read('flight-geometries.json'),
  operations:await read('operational-movements.json'),
  criticalReviews:await read('critical-leg-reviews.json'),
};
const readiness=buildFlagshipReadiness(inputs);
const queue=buildFlagshipOperationsQueue({...inputs,readiness});
const output=JSON.stringify(queue,null,2)+'\n';
const target=dataUrl('flagship-operations-queue.json');

if(process.argv.includes('--check')){
  const current=await readFile(target,'utf8').catch(()=>null);
  if(current!==output){
    console.error('FLAGSHIP OPERATIONS QUEUE: generated file is stale. Run node scripts/build-flagship-operations-queue.mjs');
    process.exitCode=1;
  }
}else{
  await writeFile(target,output,'utf8');
}
console.log(JSON.stringify(queue.summary,null,2));
