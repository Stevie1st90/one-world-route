import {readFile} from 'node:fs/promises';
import {inspectFlagshipTopology} from './flagship-topology-model.mjs';
import {verificationDate} from './verification-date-model.mjs';

const data=JSON.parse(await readFile(new URL('../data/public-route.json',import.meta.url),'utf8'));
let failed=false;const fail=m=>{failed=true;console.error('DATA VALIDATION:',m)};
if(data.segments?.length!==194)fail('Expected 194 executable segments');
if(data.countries?.length!==195)fail('Expected 195 countries');
const ids=new Set(data.segments?.map(x=>Number(x.id)));if(ids.size!==194)fail('Segment IDs must be unique');
for(let i=0;i<(data.segments||[]).length;i++)if(Number(data.segments[i].id)!==i+1)fail('Segment IDs must follow canonical route order');
const topology=inspectFlagshipTopology(data);
if(!topology.canonical)fail('Flagship topology is not the canonical 195-country open path');
if(data.postTripReturn?.countedInInternationalLegs!==false)fail('Post-trip return must be excluded from official international-leg count');
const privatePattern=/(passport|pnr|booking.?reference|payment.?date|insurance.?id|emergency.?contact|card.?number|private.?document|liquidity)/i;
const walk=(v,path='root')=>{if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(privatePattern.test(k))fail('Private field detected at '+path+'.'+k);if(typeof x==='object')walk(x,path+'.'+k)}};
walk(data);
for(const file of ['operational-movements.json','flight-geometries.json','flight-geometry-overrides.json','critical-leg-reviews.json','flagship-readiness.json','flagship-operations-queue.json','flagship-recheck-plan.json','airports.json','actual-progress.json','media.json'])walk(JSON.parse(await readFile(new URL('../data/'+file,import.meta.url),'utf8')),file);

const criticalReviews=JSON.parse(await readFile(new URL('../data/critical-leg-reviews.json',import.meta.url),'utf8'));
const criticalIds=(data.segments||[]).filter(segment=>segment.feasibility==='Kritisch').map(segment=>Number(segment.id));
const reviewIds=Object.keys(criticalReviews.reviews||{}).map(Number).sort((a,b)=>a-b);
if(criticalReviews.invariants?.expectedCriticalLegs!==criticalIds.length)fail('Critical review expected count does not match route');
if(JSON.stringify([...criticalIds].sort((a,b)=>a-b))!==JSON.stringify(reviewIds))fail('Critical review coverage must exactly match critical route legs');
for(const id of criticalIds){
  const review=criticalReviews.reviews?.[String(id)];
  if(review?.status!=='reviewed')fail('Critical leg '+id+' is missing a completed review');
  if(!verificationDate(review?.reviewedAt))fail('Critical leg '+id+' has invalid reviewedAt');
  if(!['hold','blocked'].includes(review?.decision))fail('Critical leg '+id+' must remain explicitly hold or blocked while feasibility is critical');
  if(!Array.isArray(review?.sources)||!review.sources.length)fail('Critical leg '+id+' review must include sources');
  if(review?.transportServiceVerified!==false)fail('Critical leg '+id+' must not imply service verification through the safety review');
}
const operationalMovements=JSON.parse(await readFile(new URL('../data/operational-movements.json',import.meta.url),'utf8'));
const recheckPlan=JSON.parse(await readFile(new URL('../data/flagship-recheck-plan.json',import.meta.url),'utf8'));
const expectedRecheckIds=[
  ...criticalIds.map(id=>'leg-'+id),
  ...(operationalMovements.movements||[])
    .filter(movement=>['hold','blocked'].includes(movement.operationalDecision))
    .map(movement=>'movement-'+movement.id),
].sort();
const actualRecheckIds=(recheckPlan.items||[]).map(item=>item.id).sort();
if(recheckPlan.schemaVersion!==1)fail('Flagship recheck plan schemaVersion must be 1');
if(recheckPlan.tripId!=='world-195')fail('Flagship recheck plan tripId must be world-195');
if(JSON.stringify(expectedRecheckIds)!==JSON.stringify(actualRecheckIds))fail('Flagship recheck plan coverage must exactly match critical legs and HOLD/BLOCKED movements');
for(const item of recheckPlan.items||[]){
  if(!['hold','blocked'].includes(item.currentDecision))fail('Recheck item '+item.id+' must carry an explicit HOLD/BLOCKED decision');
  if(item.blocksDeparture!==true)fail('Recheck item '+item.id+' must remain departure-blocking');
  if(!verificationDate(item.reviewedAt))fail('Recheck item '+item.id+' has invalid reviewedAt');
  if(!Array.isArray(item.triggerOn)||!item.triggerOn.length)fail('Recheck item '+item.id+' must declare material-change triggers');
  if(item.travelDate!==null){
    if(!verificationDate(item.travelDate))fail('Recheck item '+item.id+' has invalid travelDate');
    const t7=item.schedule?.tMinus7?.date;
    const t48=item.schedule?.tMinus48h?.date;
    if(!verificationDate(t7)||!verificationDate(t48))fail('Recheck item '+item.id+' must have T-7 and T-48h dates');
    if(!(t7<t48&&t48<item.travelDate))fail('Recheck item '+item.id+' checkpoint chronology is invalid');
  }
}

const geometryOverrides=JSON.parse(await readFile(new URL('../data/flight-geometry-overrides.json',import.meta.url),'utf8'));
for(const [id,value] of Object.entries(geometryOverrides.selections||{})){
  const segment=data.segments?.find(item=>Number(item.id)===Number(id));
  if(!segment)fail('Flight geometry override references unknown leg '+id);
  if(!Array.isArray(value.airportCodes)||value.airportCodes.length<2)fail('Flight geometry override '+id+' must choose at least two airports');
  if(!Array.isArray(value.coordinates)||value.coordinates.length!==value.airportCodes.length)fail('Flight geometry override '+id+' airport/coordinate count mismatch');
  if(!Array.isArray(value.sources)||!value.sources.length)fail('Flight geometry override '+id+' must include coordinate sources');
}

for(const s of data.segments||[]){
  if(!s.from||!s.to||!s.mode)fail('Segment '+s.id+' missing route identity');
  if(s.lastVerified!==null&&s.lastVerified!==undefined&&!verificationDate(s.lastVerified))fail('Segment '+s.id+' has invalid lastVerified');
}
if(data.postTripReturn?.lastVerified!==null&&data.postTripReturn?.lastVerified!==undefined&&!verificationDate(data.postTripReturn.lastVerified))fail('Post-trip return has invalid lastVerified');
if(failed)process.exit(1);
console.log('Public data validation complete:',data.countries.length,'countries /',data.segments.length,'official segments / canonical path',topology.start,'→',topology.end);
