import {readFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../data/public-route.json',import.meta.url),'utf8'));
let failed=false;const fail=m=>{failed=true;console.error('DATA VALIDATION:',m)};
if(data.segments?.length!==194)fail('Expected 194 executable segments');
if(data.countries?.length!==195)fail('Expected 195 countries');
const ids=new Set(data.segments?.map(x=>Number(x.id)));if(ids.size!==194)fail('Segment IDs must be unique');
const privatePattern=/(passport|pnr|booking.?reference|payment.?date|insurance.?id|emergency.?contact|card.?number|private.?document|liquidity)/i;
const walk=(v,path='root')=>{if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(privatePattern.test(k))fail('Private field detected at '+path+'.'+k);if(typeof x==='object')walk(x,path+'.'+k)}};
walk(data);
for(const file of ['operational-movements.json','flight-geometries.json','airports.json','actual-progress.json','media.json'])walk(JSON.parse(await readFile(new URL('../data/'+file,import.meta.url),'utf8')),file);
for(const s of data.segments||[]){if(!s.from||!s.to||!s.mode)fail('Segment '+s.id+' missing route identity')}
if(failed)process.exit(1);
console.log('Public data validation complete:',data.countries.length,'countries /',data.segments.length,'segments');