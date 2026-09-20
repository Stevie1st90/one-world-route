import {readFile,writeFile} from 'node:fs/promises';
import {inventory} from './continuity-model.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const route=await read('public-route.json'),waypoints=await read('route-waypoints.json'),flights=await read('flight-geometries.json');
const connections=inventory(route,waypoints,flights);
const output=new URL('../data/operational-movements.json',import.meta.url);
// This command is an initializer. Never overwrite human edits or actuals.
try{await readFile(output);throw new Error('Movement inventory already exists. Review route changes using the continuity audit; do not overwrite operational edits.');}catch(e){if(e.code!=='ENOENT')throw e;}
const date=v=>v?new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10):null;
const movements=connections.filter(c=>c.classification!=='shared-endpoint').map(c=>{
  const after=route.segments.find(s=>s.id===c.after),before=route.segments.find(s=>s.id===c.before);
  return {id:`transfer-${c.after}-${c.before}`,kind:'transfer',parentAfterLeg:c.after,parentBeforeLeg:c.before,country:c.country,from:c.from,to:c.to,mode:null,corridor:`${c.from} → ${c.to}`,coordinates:c.coordinates,geometryKind:c.coordinates?'endpoint-connector':'unresolved',plannedDate:null,planningWindow:{after:date(after.planArrival),before:date(before.planDeparture)},plannedDuration:null,distanceKm:c.distanceKm,distanceBasis:c.distanceKm===null?null:'geodesic-lower-bound',estimatedCost:null,currency:'EUR',budgetTreatment:'not-added-to-macro-budget',bookingRequired:null,bookingStatus:'unknown',feasibility:'needs-review',source:['data/public-route.json','data/route-waypoints.json','data/flight-geometries.json'],lastVerified:null,notes:'Imported connection inventory. Endpoint text may contain alternatives. Geometry does not establish an executable domestic route; mode, timing, cost and border dependencies require review.',status:'planned',plannedDeparture:null,actualDeparture:null,plannedArrival:null,actualArrival:null,actualCost:null,reviewStatus:c.classification==='country-mismatch'?'country-mismatch':'needs-review'};
});
await writeFile(output,JSON.stringify({schemaVersion:1,macroCountries:195,macroLegs:194,description:'Operational transfers supplement international legs. Null means unknown, never zero or verified. Public data only.',movements},null,2)+'\n');
console.log('Inventoried',connections.length,'connections;',movements.length,'operational transfer candidates');
