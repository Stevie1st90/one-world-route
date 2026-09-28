import {readFile} from 'node:fs/promises';
import {buildMaintenanceReport} from './platform-maintenance-model.mjs';

const root=new URL('../',import.meta.url);
const readJson=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const catalog=await readJson('data/platform/trips.json');
const shared=await readJson('data/platform/shared-knowledge.json').catch(()=>({items:[],reviewPolicies:{}}));
const experienceIndex=await readJson('data/platform/place-experiences/index.json').catch(()=>({shards:[]}));
const datasets=new Map(),experienceProfiles=[];

for(const meta of catalog.trips||[]){
  if(meta.renderer==='legacy-world')continue;
  const relative=String(meta.dataset||'').replace(/^\.\//,'');
  if(relative.startsWith('data/')){
    try{datasets.set(meta.id,await readJson(relative))}
    catch{datasets.set(meta.id,null)}
  }
}
for(const shardMeta of experienceIndex.shards||[]){
  const relative=String(shardMeta.dataset||'').replace(/^\.\//,'');
  try{
    const shard=await readJson(relative);
    experienceProfiles.push(...(shard.profiles||[]));
  }catch{}
}

const report=buildMaintenanceReport({catalog,datasets,shared,experienceProfiles,now:new Date()});
const strict=process.argv.includes('--strict-stale');

console.log('JOURNEY MAINTENANCE AUDIT');
console.log('Trips:',report.summary.trips);
console.log('Reversible personalized trips:',report.summary.reversibleTrips);
console.log('Live-dependent trips:',report.summary.liveDependentTrips);
console.log('Trip sources:',report.summary.tripSources);
console.log('Shared knowledge items:',report.summary.sharedKnowledgeItems);
console.log('Place experience profiles:',report.summary.experienceProfiles);
console.log('Place experience references:',report.summary.experienceReferences);
console.log('Shared place profiles reused by multiple trip places:',report.summary.reusedExperienceProfiles);
console.log('Place experience coverage:',report.experienceCoverage.coveredPlaces+'/'+report.experienceCoverage.totalPlaces,'('+report.summary.experienceCoveragePct+'%)');
console.log('Experience-complete journeys:',report.summary.completeExperienceJourneys+'/'+report.summary.experienceJourneys);
console.log('Editorial experience candidates:',report.experienceCoverage.queueItems);
console.log('Maintenance queue:',report.summary.queueItems,'· expired',report.summary.expired,'· overdue',report.summary.overdue,'· due soon',report.summary.dueSoon);
for(const item of report.queue.slice(0,30)){
  const due=item.state==='expired'?'expired '+(item.validUntil||''):item.state==='overdue'?Math.abs(item.dueInDays)+'d overdue':'due in '+item.dueInDays+'d';
  console.log('-',item.kind,item.tripId,item.sourceId,'·',due);
}
if(report.queue.length>30)console.log('... and',report.queue.length-30,'more');

if(report.issues.length){
  console.error('Maintenance contract errors:');
  for(const issue of report.issues)console.error('-',issue);
  process.exitCode=1;
}else if(strict&&(report.summary.expired||report.summary.overdue)){
  console.error('Strict stale mode: expired or overdue review items found.');
  process.exitCode=1;
}else{
  console.log('Maintenance contract: PASS');
  if(report.summary.queueItems)console.log('Maintenance queue is advisory unless --strict-stale is used.');
}
