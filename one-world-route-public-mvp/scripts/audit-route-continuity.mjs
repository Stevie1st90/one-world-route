import {inspectFlagshipTopology} from './flagship-topology-model.mjs';
import {readFile} from 'node:fs/promises';
import {inventory,distanceKm} from './continuity-model.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const route=await read('public-route.json'),waypoints=await read('route-waypoints.json'),flights=await read('flight-geometries.json'),data=await read('operational-movements.json');
const connections=inventory(route,waypoints,flights),topology=inspectFlagshipTopology(route),errors=[],ids=new Set(),covered=new Set();
const fail=m=>errors.push(m);
if(route.segments.length!==194||route.countries.length!==195)fail('Macro counts changed');
if(!topology.canonical)fail('Canonical flagship topology changed');
const statuses=['planned','booked','in progress','completed','changed','cancelled'];
for(const m of data.movements){
  if(ids.has(m.id))fail('Duplicate movement '+m.id);ids.add(m.id);
  const c=connections.find(c=>c.after===m.parentAfterLeg&&c.before===m.parentBeforeLeg);
  if(!c){fail('Nonadjacent parent legs: '+m.id);continue;}
  if(covered.has(c.id))fail('Duplicate connection: '+c.id);covered.add(c.id);
  if(m.country!==c.country)fail('Country mismatch: '+m.id);
  if(!statuses.includes(m.status))fail('Invalid status: '+m.id);
  if(!['needs-review','reviewed','country-mismatch'].includes(m.reviewStatus))fail('Invalid review status: '+m.id);
  for(const key of ['mode','plannedDate','plannedDuration','distanceKm','estimatedCost','bookingRequired','bookingStatus','feasibility','source','lastVerified','plannedDeparture','actualDeparture','plannedArrival','actualArrival','actualCost'])if(!(key in m))fail('Missing '+key+': '+m.id);
  for(const key of ['plannedDuration','distanceKm','estimatedCost','actualCost'])if(m[key]!==null&&(!Number.isFinite(m[key])||m[key]<0))fail('Invalid '+key+': '+m.id);
  if(m.coordinates!==null){
    const valid=Array.isArray(m.coordinates)&&m.coordinates.length>=2&&m.coordinates.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90);
    if(!valid)fail('Invalid coordinates: '+m.id);
    else if(c.coordinates&&(distanceKm(m.coordinates[0],c.coordinates[0])>0.1||distanceKm(m.coordinates.at(-1),c.coordinates.at(-1))>0.1))fail('Stale endpoints: '+m.id);
  }
  if(m.reviewStatus==='reviewed'&&(!m.mode||!m.lastVerified||!m.source?.length||!m.coordinates||!m.notes))fail('Reviewed movement lacks evidence: '+m.id);
}
for(const c of connections)if(c.classification!=='shared-endpoint'&&!covered.has(c.id))fail('Uninventoried connection '+c.id);
const unresolved=connections.filter(c=>c.classification!=='shared-endpoint'&&!(data.movements.find(m=>m.parentAfterLeg===c.after&&m.parentBeforeLeg===c.before)?.reviewStatus==='reviewed'&&c.classification!=='unresolved-endpoint'&&c.classification!=='country-mismatch'));
const countriesInLegs=new Set(route.segments.flatMap(s=>[s.from,s.to]));
const countriesOutsideLegs=route.countries.filter(c=>!countriesInLegs.has(c.name)).map(c=>c.name);
console.log(JSON.stringify({topology,countriesInLegs:countriesInLegs.size,countriesOutsideLegs,knownFlightEndpoints:Object.values(flights.endpoints||{}).reduce((n,e)=>n+Number(!!e.departure)+Number(!!e.arrival),0),officialLegs:route.segments.length,countries:route.countries.length,connections:connections.length,sharedEndpoints:connections.filter(c=>c.classification==='shared-endpoint').length,operationalTransfers:data.movements.length,unresolvedConnections:unresolved.length,missingEndpointGeometry:connections.filter(c=>c.classification==='unresolved-endpoint').length,releaseReady:!errors.length&&!unresolved.length&&!countriesOutsideLegs.length,errors,unresolved},null,2));
if(errors.length||(process.argv.includes('--strict')&&(unresolved.length||countriesOutsideLegs.length)))process.exitCode=1;
