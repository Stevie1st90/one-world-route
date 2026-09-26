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
for(const file of ['operational-movements.json','flight-geometries.json','airports.json','actual-progress.json','media.json'])walk(JSON.parse(await readFile(new URL('../data/'+file,import.meta.url),'utf8')),file);
for(const s of data.segments||[]){
  if(!s.from||!s.to||!s.mode)fail('Segment '+s.id+' missing route identity');
  if(s.lastVerified!==null&&s.lastVerified!==undefined&&!verificationDate(s.lastVerified))fail('Segment '+s.id+' has invalid lastVerified');
}
if(data.postTripReturn?.lastVerified!==null&&data.postTripReturn?.lastVerified!==undefined&&!verificationDate(data.postTripReturn.lastVerified))fail('Post-trip return has invalid lastVerified');
if(failed)process.exit(1);
console.log('Public data validation complete:',data.countries.length,'countries /',data.segments.length,'official segments / canonical path',topology.start,'→',topology.end);
