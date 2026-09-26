import {verificationDate} from './verification-date-model.mjs';

const sourceList=value=>String(value||'').split(';').map(x=>x.trim()).filter(Boolean);

export function buildFlagshipOperationsQueue({route,operations,flights,readiness}){
  const fullFlights=new Set(Object.keys(flights.geometries||{}).map(Number));
  const partialFlights=new Set(
    Object.entries(flights.endpoints||{})
      .filter(([,value])=>value?.departure||value?.arrival)
      .map(([id])=>Number(id))
  );

  const tasks=[];
  for(const segment of route.segments||[]){
    const blockers=[];
    const missing=[];
    const id=Number(segment.id);
    const isFlight=/flug/i.test(String(segment.mode||''));
    if(segment.feasibility==='Kritisch')blockers.push('critical-feasibility');
    if(isFlight&&!fullFlights.has(id))blockers.push('missing-flight-geometry');
    if(!verificationDate(segment.lastVerified))missing.push('lastVerified');
    if(!segment.source)missing.push('source');
    if(segment.transportBudgetEur===null||segment.transportBudgetEur===undefined)missing.push('transportBudgetEur');
    if(!blockers.length&&!missing.length)continue;
    const priority=blockers.includes('critical-feasibility')?'P0':blockers.includes('missing-flight-geometry')?'P1':'P2';
    tasks.push({
      id:'leg-'+id,
      priority,
      category:'international-leg',
      legId:id,
      movementId:null,
      title:String(segment.from||'?')+' → '+String(segment.to||'?'),
      status:blockers.length?'blocked':'needs-review',
      blockers,
      missing,
      geometry:isFlight?(fullFlights.has(id)?'full':partialFlights.has(id)?'partial':'missing'):'not-flight',
      sourceCount:sourceList(segment.source).length,
      lastVerified:verificationDate(segment.lastVerified),
      blocksDeparture:blockers.length>0,
    });
  }

  for(const movement of operations.movements||[]){
    const missing=[];
    if(!movement.coordinates)missing.push('coordinates');
    if(!movement.mode)missing.push('mode');
    if(movement.plannedDuration===null)missing.push('plannedDuration');
    if(movement.estimatedCost===null)missing.push('estimatedCost');
    if(movement.bookingRequired===null)missing.push('bookingRequired');
    if(!verificationDate(movement.lastVerified))missing.push('lastVerified');
    if(!Array.isArray(movement.source)||!movement.source.length)missing.push('source');
    const needsReview=movement.reviewStatus!=='reviewed';
    if(!needsReview&&!missing.length)continue;
    tasks.push({
      id:'movement-'+movement.id,
      priority:!movement.coordinates?'P1':'P2',
      category:'operational-movement',
      legId:Number(movement.parentAfterLeg)||null,
      movementId:movement.id,
      title:String(movement.from||'?')+' → '+String(movement.to||'?'),
      status:movement.reviewStatus||'needs-review',
      blockers:needsReview?['movement-review']:[],
      missing,
      geometry:movement.coordinates?'known':'missing',
      sourceCount:Array.isArray(movement.source)?movement.source.length:0,
      lastVerified:verificationDate(movement.lastVerified),
      blocksDeparture:needsReview,
    });
  }

  const rank={P0:0,P1:1,P2:2};
  tasks.sort((a,b)=>rank[a.priority]-rank[b.priority]||(a.legId??999)- (b.legId??999)||a.id.localeCompare(b.id));
  const summary={
    total:tasks.length,
    p0:tasks.filter(task=>task.priority==='P0').length,
    p1:tasks.filter(task=>task.priority==='P1').length,
    p2:tasks.filter(task=>task.priority==='P2').length,
    blocking:tasks.filter(task=>task.blocksDeparture).length,
    byCategory:Object.fromEntries([...new Set(tasks.map(task=>task.category))].map(category=>[category,tasks.filter(task=>task.category===category).length])),
  };

  return {
    schemaVersion:1,
    tripId:'world-195',
    dataAsOf:readiness.dataAsOf,
    routeGeneratedAt:readiness.routeGeneratedAt,
    departureReady:readiness.status.departureReady,
    summary,
    tasks,
  };
}
