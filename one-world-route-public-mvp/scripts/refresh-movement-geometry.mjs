import {readFile,writeFile} from 'node:fs/promises';
import {inventory} from './continuity-model.mjs';

const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const route=await read('public-route.json');
const waypoints=await read('route-waypoints.json');
const flights=await read('flight-geometries.json');
const operations=await read('operational-movements.json');

const date=v=>v?new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10):null;
const existing=new Map((operations.movements||[]).map(movement=>[movement.id,movement]));
const connections=inventory(route,waypoints,flights);

const movements=connections
  .filter(connection=>connection.classification!=='shared-endpoint')
  .map(connection=>{
    const id=`transfer-${connection.after}-${connection.before}`;
    const current=existing.get(id);
    const after=route.segments.find(segment=>segment.id===connection.after);
    const before=route.segments.find(segment=>segment.id===connection.before);
    const base=current||{
      id,
      kind:'transfer',
      parentAfterLeg:connection.after,
      parentBeforeLeg:connection.before,
      country:connection.country,
      from:connection.from,
      to:connection.to,
      mode:null,
      corridor:`${connection.from} → ${connection.to}`,
      coordinates:null,
      geometryKind:'unresolved',
      plannedDate:null,
      planningWindow:{after:date(after?.planArrival),before:date(before?.planDeparture)},
      plannedDuration:null,
      distanceKm:null,
      distanceBasis:null,
      estimatedCost:null,
      currency:'EUR',
      budgetTreatment:'not-added-to-macro-budget',
      bookingRequired:null,
      bookingStatus:'unknown',
      feasibility:'needs-review',
      source:['data/public-route.json','data/route-waypoints.json','data/flight-geometries.json'],
      lastVerified:null,
      notes:'Connection inventory generated from explicit route endpoints. Geometry never establishes transport service, duration, cost, border permission or safety.',
      status:'planned',
      plannedDeparture:null,
      actualDeparture:null,
      plannedArrival:null,
      actualArrival:null,
      actualCost:null,
      reviewStatus:'needs-review',
    };

    const priorReviewStatus=base.reviewStatus==='country-mismatch'?'needs-review':base.reviewStatus;
    return {
      ...base,
      parentAfterLeg:connection.after,
      parentBeforeLeg:connection.before,
      country:connection.country,
      from:connection.from,
      to:connection.to,
      corridor:`${connection.from} → ${connection.to}`,
      coordinates:connection.coordinates,
      geometryKind:connection.coordinates?'endpoint-connector':'unresolved',
      planningWindow:{after:date(after?.planArrival),before:date(before?.planDeparture)},
      distanceKm:connection.distanceKm,
      distanceBasis:connection.distanceKm===null?null:'geodesic-lower-bound',
      reviewStatus:connection.classification==='country-mismatch'?'country-mismatch':priorReviewStatus,
    };
  });

const output={
  ...operations,
  schemaVersion:2,
  description:'Operational transfers supplement international legs. Geometry is synchronized from explicit route endpoints; null means unknown, never zero or verified.',
  movements,
};

const serialized=JSON.stringify(output,null,2)+'\n';
const target=new URL('../data/operational-movements.json',import.meta.url);

if(process.argv.includes('--check')){
  const current=await readFile(target,'utf8').catch(()=>null);
  if(current!==serialized){
    console.error('MOVEMENT GEOMETRY: generated file is stale. Run node scripts/refresh-movement-geometry.mjs');
    process.exitCode=1;
  }
}else{
  await writeFile(target,serialized);
}

console.log(JSON.stringify({
  connections:connections.length,
  movements:movements.length,
  sharedEndpoints:connections.filter(connection=>connection.classification==='shared-endpoint').length,
  transferRequired:connections.filter(connection=>connection.classification==='transfer-required').length,
  unresolvedEndpoints:connections.filter(connection=>connection.classification==='unresolved-endpoint').length,
  countryMismatch:connections.filter(connection=>connection.classification==='country-mismatch').length,
},null,2));
