import {readFile,writeFile} from 'node:fs/promises';
import {buildFlagshipRecheckPlan} from './flagship-recheck-model.mjs';

const dataUrl=name=>new URL('../data/'+name,import.meta.url);
const read=async name=>JSON.parse(await readFile(dataUrl(name),'utf8'));

const plan=buildFlagshipRecheckPlan({
  route:await read('public-route.json'),
  operations:await read('operational-movements.json'),
  queue:await read('flagship-operations-queue.json'),
  criticalReviews:await read('critical-leg-reviews.json'),
});
const output=JSON.stringify(plan,null,2)+'\n';
const target=dataUrl('flagship-recheck-plan.json');

if(process.argv.includes('--check')){
  const current=await readFile(target,'utf8').catch(()=>null);
  if(current!==output){
    console.error('FLAGSHIP RECHECK PLAN: generated file is stale. Run node scripts/build-flagship-recheck-plan.mjs');
    process.exitCode=1;
  }
}else{
  await writeFile(target,output,'utf8');
}

console.log(JSON.stringify(plan.summary,null,2));
