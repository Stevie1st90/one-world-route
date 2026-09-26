import {verificationDate} from './verification-date-model.mjs';

const sourceList=value=>String(value||'').split(';').map(x=>x.trim()).filter(Boolean);
const requiresFullFlightGeometry=mode=>/^Flug(?:\s|\(|–|-|$)/i.test(String(mode||''));
const movementExternalSources=movement=>Array.isArray(movement?.source)?movement.source.filter(source=>/^https?:\/\//i.test(source)):[];


export function buildFlagshipOperationsQueue({route,operations,flights,readiness,criticalReviews={reviews:{}}}){
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
    const isFlight=requiresFullFlightGeometry(segment.mode);
    const criticalReview=criticalReviews.reviews?.[String(id)]||null;
    if(segment.feasibility==='Kritisch')blockers.push('critical-feasibility');
    if(segment.feasibility==='Kritisch'&&(!criticalReview||criticalReview.status!=='reviewed'||!verificationDate(criticalReview.reviewedAt)))missing.push('criticalReview');
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
      status:blockers.includes('critical-feasibility')&&criticalReview?.status==='reviewed'
        ?(criticalReview.decision==='blocked'?'reviewed-blocked':'reviewed-hold')
        :blockers.length?'blocked':'needs-review',
      blockers,
      missing,
      geometry:isFlight?(fullFlights.has(id)?'full':partialFlights.has(id)?'partial':'missing'):'not-flight',
      sourceCount:sourceList(segment.source).length,
      lastVerified:verificationDate(segment.lastVerified),
      reviewStatus:criticalReview?.status||null,
      reviewDecision:criticalReview?.decision||null,
      reviewSafetyState:criticalReview?.safetyState||null,
      reviewRouteEvidence:criticalReview?.routeEvidence||null,
      reviewedAt:verificationDate(criticalReview?.reviewedAt),
      blocksDeparture:blockers.length>0,
    });
  }

  for(const movement of operations.movements||[]){
    const missing=[];
    const movementBlockers=[];
    const externalSources=movementExternalSources(movement);
    if(!movement.coordinates){missing.push('coordinates');movementBlockers.push('endpoint-geometry');}
    if(!movement.mode){missing.push('mode');movementBlockers.push('movement-mode');}
    if(movement.plannedDuration===null){missing.push('plannedDuration');movementBlockers.push('movement-duration');}
    if(movement.estimatedCost===null){missing.push('estimatedCost');movementBlockers.push('movement-cost');}
    if(movement.bookingRequired===null){missing.push('bookingRequired');movementBlockers.push('booking-decision');}
    if(!verificationDate(movement.lastVerified)){missing.push('lastVerified');movementBlockers.push('verification-date');}
    if(!Array.isArray(movement.source)||!movement.source.length)missing.push('source');
    if(!externalSources.length){missing.push('externalSource');movementBlockers.push('external-evidence');}
    const needsReview=movement.reviewStatus!=='reviewed';
    if(needsReview)movementBlockers.push('movement-review');
    if(!movementBlockers.length&&!missing.length)continue;
    tasks.push({
      id:'movement-'+movement.id,
      priority:!movement.coordinates?'P1':'P2',
      category:'operational-movement',
      legId:Number(movement.parentAfterLeg)||null,
      movementId:movement.id,
      title:String(movement.from||'?')+' → '+String(movement.to||'?'),
      status:movementBlockers.length?(needsReview?'needs-review':'reviewed-incomplete'):'ready',
      blockers:[...new Set(movementBlockers)],
      missing:[...new Set(missing)],
      geometry:movement.coordinates?'known':'missing',
      sourceCount:Array.isArray(movement.source)?movement.source.length:0,
      externalSourceCount:externalSources.length,
      lastVerified:verificationDate(movement.lastVerified),
      blocksDeparture:movementBlockers.length>0,
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
    criticalReviewed:tasks.filter(task=>task.priority==='P0'&&task.reviewStatus==='reviewed').length,
    criticalBlocked:tasks.filter(task=>task.priority==='P0'&&task.reviewDecision==='blocked').length,
    criticalHold:tasks.filter(task=>task.priority==='P0'&&task.reviewDecision==='hold').length,
  };

  return {
    schemaVersion:2,
    tripId:'world-195',
    dataAsOf:readiness.dataAsOf,
    routeGeneratedAt:readiness.routeGeneratedAt,
    departureReady:readiness.status.departureReady,
    summary,
    tasks,
  };
}
