import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const readJson=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const asDate=value=>{
  if(!value)return null;
  const date=new Date(String(value)+'T00:00:00Z');
  return Number.isNaN(date.getTime())?null:date;
};
const daysBetween=(a,b)=>Math.floor((a-b)/86400000);

const catalog=await readJson('data/platform/trips.json');
const shared=await readJson('data/platform/shared-knowledge.json').catch(()=>({items:[]}));
const now=new Date();
const strict=process.argv.includes('--strict-stale');
const issues=[];
const reviewCandidates=[];
let sourceCount=0;
let liveDependentTrips=0;
let reversibleTrips=0;

for(const meta of catalog.trips||[]){
  if(meta.renderer==='legacy-world')continue;
  const relative=String(meta.dataset||'').replace(/^\.\//,'');
  if(!relative.startsWith('data/')){issues.push(meta.id+': dataset must stay under data/');continue}
  const trip=await readJson(relative);
  if(trip.id!==meta.id)issues.push(meta.id+': dataset id mismatch');
  const maintenance=trip.maintenance||{};
  if(maintenance.tier==='live-dependent')liveDependentTrips++;
  if(trip.routePolicy?.reversible===true)reversibleTrips++;
  if(trip.routePolicy?.reversible===true&&trip.routePolicy?.startMode!=='endpoints'&&trip.routePolicy?.startMode!=='any-stop'){
    issues.push(meta.id+': reversible route requires endpoints or any-stop startMode');
  }
  const reviewDays=Number(maintenance.sourceReviewDays||180);
  for(const source of trip.sources||[]){
    sourceCount++;
    const checked=asDate(source.checkedAt);
    if(!checked){issues.push(meta.id+': source '+source.id+' has invalid checkedAt');continue}
    const age=daysBetween(now,checked);
    if(age>reviewDays)reviewCandidates.push({tripId:meta.id,sourceId:source.id,ageDays:age,reviewDays});
    const until=asDate(source.validUntil);
    if(source.validUntil&&!until)issues.push(meta.id+': source '+source.id+' has invalid validUntil');
    if(until&&until<now)reviewCandidates.push({tripId:meta.id,sourceId:source.id,expired:true,validUntil:source.validUntil});
  }
}

for(const item of shared.items||[]){
  if(!item.id)issues.push('shared knowledge item without id');
  if(item.type!=='planning-policy'&&item.sourceRequired!==false){
    if(!item.source?.url||!item.checkedAt)issues.push('shared knowledge '+item.id+': factual item needs source.url and checkedAt');
  }
}

console.log('JOURNEY MAINTENANCE AUDIT');
console.log('Trips:',catalog.trips?.length||0);
console.log('Reversible personalized trips:',reversibleTrips);
console.log('Live-dependent trips:',liveDependentTrips);
console.log('Trip sources:',sourceCount);
console.log('Shared knowledge items:',shared.items?.length||0);
console.log('Review candidates:',reviewCandidates.length);
for(const item of reviewCandidates.slice(0,30)){
  console.log('-',item.tripId,item.sourceId,item.expired?'expired '+item.validUntil:'age '+item.ageDays+'d > '+item.reviewDays+'d');
}
if(reviewCandidates.length>30)console.log('... and',reviewCandidates.length-30,'more');

if(issues.length){
  console.error('Maintenance contract errors:');
  for(const issue of issues)console.error('-',issue);
  process.exitCode=1;
}else if(strict&&reviewCandidates.length){
  console.error('Strict stale mode: review candidates found.');
  process.exitCode=1;
}else{
  console.log('Maintenance contract: PASS');
  if(reviewCandidates.length)console.log('Review candidates are advisory unless --strict-stale is used.');
}
