import {readFile,writeFile} from 'node:fs/promises';
import {buildMaintenanceQueue} from './maintenance-queue-model.mjs';

const root=new URL('../',import.meta.url);
const readJson=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const catalog=await readJson('data/platform/trips.json');
const shared=await readJson('data/platform/shared-knowledge.json').catch(()=>({items:[],reviewPolicies:{}}));
const experienceIndex=await readJson('data/platform/place-experiences/index.json').catch(()=>({shards:[]}));
const datasets=new Map();
for(const meta of catalog.trips||[]){
  if(meta.renderer==='legacy-world')continue;
  const relative=String(meta.dataset||'').replace(/^\.\//,'');
  datasets.set(meta.id,await readJson(relative));
}
const profiles=[];
for(const shardMeta of experienceIndex.shards||[]){
  const relative=String(shardMeta.dataset||'').replace(/^\.\//,'');
  const shard=await readJson(relative);
  profiles.push(...(shard.profiles||[]));
}
const queue=buildMaintenanceQueue({catalog,datasets,shared,profiles,now:new Date()});
const json=JSON.stringify(queue,null,2)+'\n';
const outArg=process.argv.find(arg=>arg.startsWith('--out='));
if(outArg){
  const target=new URL(outArg.slice(6),root);
  await writeFile(target,json);
}
if(process.argv.includes('--json'))process.stdout.write(json);
else{
  console.log('JOURNEY MAINTENANCE QUEUE');
  console.log('Journeys:',queue.summary.journeys);
  console.log('Unique external sources:',queue.summary.uniqueExternalSources);
  console.log('Reused external sources:',queue.summary.reusedExternalSources);
  console.log('Place experience profiles:',queue.summary.placeExperienceProfiles);
  console.log('Expired:',queue.summary.expired,'· Overdue:',queue.summary.overdue,'· Due soon:',queue.summary.dueSoon,'· Unknown:',queue.summary.unknown);
  for(const item of queue.items.slice(0,40)){
    const when=item.nextReviewAt?'next '+item.nextReviewAt:'no review date';
    const reuse=item.reuseCount>1?' · '+item.reuseCount+' dependents':'';
    console.log('-',item.state.toUpperCase(),item.type,item.title,'·',when+reuse,'·',item.priorityReason);
  }
  if(queue.items.length>40)console.log('... and',queue.items.length-40,'more');
}
