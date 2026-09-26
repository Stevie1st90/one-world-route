import {inventory} from './continuity-model.mjs';
import {inspectFlagshipTopology} from './flagship-topology-model.mjs';
import {verificationDate} from './verification-date-model.mjs';
import {
  movementDecision,
  movementOperationallyComplete,
  movementReviewResolved,
} from './movement-decision-model.mjs';

const isFiniteNumber=value=>typeof value==='number'&&Number.isFinite(value);
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null;
const pct=(part,total)=>total?Math.round((part/total)*1000)/10:0;
const requiresFullFlightGeometry=mode=>/^Flug(?:\s|\(|–|-|$)/i.test(String(mode||''));
const hasExternalSource=movement=>Array.isArray(movement?.source)&&movement.source.some(source=>/^https?:\/\//i.test(source));

function latestDate(values){
  return values.map(verificationDate).filter(Boolean).sort().at(-1)||null;
}

export function buildFlagshipReadiness({route,waypoints,flights,operations,criticalReviews={reviews:{}}}){
  const topology=inspectFlagshipTopology(route);
  const connections=inventory(route,waypoints,flights);
  const movementByConnection=new Map(
    (operations.movements||[]).map(movement=>[
      `${movement.parentAfterLeg}-${movement.parentBeforeLeg}`,
      movement
    ])
  );

  const countriesInLegs=new Set((route.segments||[]).flatMap(segment=>[segment.from,segment.to]));
  const countriesOutsideLegs=(route.countries||[])
    .filter(country=>!countriesInLegs.has(country.name))
    .map(country=>country.name);

  const unresolvedConnections=connections.filter(connection=>{
    if(connection.classification==='shared-endpoint')return false;
    const movement=movementByConnection.get(`${connection.after}-${connection.before}`);
    return !movementReviewResolved(movement);
  });
  const holdConnections=connections.filter(connection=>
    movementDecision(movementByConnection.get(`${connection.after}-${connection.before}`))==='hold'
  );
  const blockedConnections=connections.filter(connection=>
    movementDecision(movementByConnection.get(`${connection.after}-${connection.before}`))==='blocked'
  );

  const movements=operations.movements||[];
  const flightLegs=(route.segments||[]).filter(segment=>requiresFullFlightGeometry(segment.mode));
  const fullFlightIds=new Set(Object.keys(flights.geometries||{}).map(Number));
  const fullFlightGeometryCount=flightLegs.filter(segment=>fullFlightIds.has(Number(segment.id))).length;
  const missingFlightGeometryIds=flightLegs
    .filter(segment=>!fullFlightIds.has(Number(segment.id)))
    .map(segment=>Number(segment.id));

  const knownFlightEndpoints=flightLegs.reduce((count,segment)=>{
    const endpoints=flights.endpoints?.[String(segment.id)]||{};
    return count+Number(Boolean(endpoints.departure))+Number(Boolean(endpoints.arrival));
  },0);

  const routeSources=(route.segments||[]).filter(segment=>Boolean(segment.source)).length;
  const validVerificationDates=(route.segments||[]).filter(segment=>Boolean(verificationDate(segment.lastVerified)));
  const invalidVerificationDates=(route.segments||[]).filter(segment=>segment.lastVerified!==null&&segment.lastVerified!==undefined&&!verificationDate(segment.lastVerified));
  const missingVerificationDates=(route.segments||[]).filter(segment=>segment.lastVerified===null||segment.lastVerified===undefined);
  const criticalSegments=(route.segments||[]).filter(segment=>segment.feasibility==='Kritisch');
  const criticalFeasibility=criticalSegments.length;
  const criticalReviewRows=criticalSegments.map(segment=>({
    segment,
    review:criticalReviews.reviews?.[String(segment.id)]||null,
  }));
  const reviewedCritical=criticalReviewRows.filter(({review})=>review?.status==='reviewed'&&verificationDate(review.reviewedAt)).length;
  const missingCriticalReviewIds=criticalReviewRows
    .filter(({review})=>review?.status!=='reviewed'||!verificationDate(review?.reviewedAt))
    .map(({segment})=>Number(segment.id));
  const criticalReviewHealth={
    total:criticalFeasibility,
    reviewed:reviewedCritical,
    missing:missingCriticalReviewIds.length,
    missingLegIds:missingCriticalReviewIds,
    hold:criticalReviewRows.filter(({review})=>review?.decision==='hold').length,
    blocked:criticalReviewRows.filter(({review})=>review?.decision==='blocked').length,
    latestReview:latestDate(criticalReviewRows.map(({review})=>review?.reviewedAt)),
    meaning:'Review completion records a current decision. HOLD/BLOCKED critical legs still block departure and are not asserted safe or executable.',
  };
  const conditionalFeasibility=(route.segments||[]).filter(segment=>segment.feasibility==='Bedingt').length;
  const plannableFeasibility=(route.segments||[]).filter(segment=>segment.feasibility==='Planbar').length;

  const reviewedMovements=movements.filter(movement=>movement.reviewStatus==='reviewed').length;
  const operationallyCompleteMovements=movements.filter(movementOperationallyComplete).length;
  const resolvedMovements=movements.filter(movementReviewResolved).length;
  const holdMovements=movements.filter(movement=>movementDecision(movement)==='hold').length;
  const blockedMovements=movements.filter(movement=>movementDecision(movement)==='blocked').length;
  const needsReviewMovements=movements.length-resolvedMovements;

  const structural={
    expectedCountries:195,
    expectedInternationalLegs:194,
    actualCountries:(route.countries||[]).length,
    actualInternationalLegs:(route.segments||[]).length,
    countriesInLegEndpoints:countriesInLegs.size,
    countriesOutsideLegs,
    invariantOk:(route.countries||[]).length===195&&(route.segments||[]).length===194,
    canonicalPath:topology.canonical,
    routeStart:topology.start,
    routeEnd:topology.end,
    postTripReturn:topology.postTripReturn,
  };

  const continuity={
    connections:connections.length,
    sharedEndpoints:connections.filter(connection=>connection.classification==='shared-endpoint').length,
    transferRequired:connections.filter(connection=>connection.classification==='transfer-required').length,
    unresolvedEndpointGeometry:connections.filter(connection=>connection.classification==='unresolved-endpoint').length,
    countryMismatch:connections.filter(connection=>connection.classification==='country-mismatch').length,
    unresolvedConnections:unresolvedConnections.length,
    holdConnections:holdConnections.length,
    blockedConnections:blockedConnections.length,
    departureBlockingConnections:holdConnections.length+blockedConnections.length,
  };

  const movementHealth={
    total:movements.length,
    reviewed:reviewedMovements,
    needsReview:needsReviewMovements,
    reviewedPercent:pct(reviewedMovements,movements.length),
    operationallyComplete:operationallyCompleteMovements,
    operationallyCompletePercent:pct(operationallyCompleteMovements,movements.length),
    resolved:resolvedMovements,
    resolvedPercent:pct(resolvedMovements,movements.length),
    hold:holdMovements,
    blocked:blockedMovements,
    unresolvedGeometry:movements.filter(movement=>!movement.coordinates&&!['hold','blocked'].includes(movementDecision(movement))).length,
    deferredGeometry:movements.filter(movement=>!movement.coordinates&&['hold','blocked'].includes(movementDecision(movement))).length,
    missingMode:movements.filter(movement=>!movement.mode&&!['hold','blocked'].includes(movementDecision(movement))).length,
    missingDuration:movements.filter(movement=>movement.plannedDuration===null&&!['hold','blocked'].includes(movementDecision(movement))).length,
    missingCost:movements.filter(movement=>movement.estimatedCost===null&&!['hold','blocked'].includes(movementDecision(movement))).length,
    missingBookingDecision:movements.filter(movement=>movement.bookingRequired===null&&!['hold','blocked'].includes(movementDecision(movement))).length,
    missingLastVerified:movements.filter(movement=>!verificationDate(movement.lastVerified)&&!['hold','blocked'].includes(movementDecision(movement))).length,
    externallySourced:movements.filter(hasExternalSource).length,
  };

  const flightsHealth={
    flightLegs:flightLegs.length,
    fullGeometries:fullFlightGeometryCount,
    fullGeometryPercent:pct(fullFlightGeometryCount,flightLegs.length),
    missingFullGeometries:missingFlightGeometryIds.length,
    missingFullGeometryLegIds:missingFlightGeometryIds,
    knownEndpoints:knownFlightEndpoints,
    totalEndpoints:flightLegs.length*2,
    endpointCoveragePercent:pct(knownFlightEndpoints,flightLegs.length*2),
    geometryScope:'Airport coordinates only; geometry does not verify airline service, schedules or booking availability.',
  };

  const evidence={
    sourcedSegments:routeSources,
    sourcedSegmentsPercent:pct(routeSources,(route.segments||[]).length),
    segmentsWithVerificationDate:validVerificationDates.length,
    segmentsWithVerificationDatePercent:pct(validVerificationDates.length,(route.segments||[]).length),
    invalidVerificationDates:invalidVerificationDates.map(segment=>Number(segment.id)),
    missingVerificationDates:missingVerificationDates.map(segment=>Number(segment.id)),
    feasibility:{
      plannable:plannableFeasibility,
      conditional:conditionalFeasibility,
      critical:criticalFeasibility,
    },
    segmentsMissingTransportBudget:(route.segments||[]).filter(segment=>!isFiniteNumber(segment.transportBudgetEur)).length,
  };

  const criticalLegIds=(route.segments||[]).filter(segment=>segment.feasibility==='Kritisch').map(segment=>Number(segment.id));
  const unresolvedMovementIds=movements.filter(movement=>!movementReviewResolved(movement)).map(movement=>movement.id);
  const holdMovementIds=movements.filter(movement=>movementDecision(movement)==='hold').map(movement=>movement.id);
  const blockedMovementIds=movements.filter(movement=>movementDecision(movement)==='blocked').map(movement=>movement.id);
  const unresolvedGeometryMovementIds=movements.filter(movement=>!movement.coordinates&&!['hold','blocked'].includes(movementDecision(movement))).map(movement=>movement.id);
  const deferredGeometryMovementIds=movements.filter(movement=>!movement.coordinates&&['hold','blocked'].includes(movementDecision(movement))).map(movement=>movement.id);
  const verificationQueue=[...invalidVerificationDates,...missingVerificationDates].map(segment=>Number(segment.id));

  const workQueue=[
    {priority:'P0',id:'macro-country-coverage',count:countriesOutsideLegs.length,items:countriesOutsideLegs,goal:'Resolve country coverage without changing the 195-country / 194-leg invariant.'},
    {priority:'P0',id:'critical-review-gaps',count:missingCriticalReviewIds.length,items:missingCriticalReviewIds,goal:'Complete a current source-backed review for every critical international leg without equating review with approval.'},
    {priority:'P0',id:'critical-feasibility',count:criticalLegIds.length,items:criticalLegIds,goal:'Keep HOLD/BLOCKED critical legs visible until safety, entry/border conditions and executable transport are genuinely resolved.'},
    {priority:'P0',id:'movement-blocked',count:blockedMovementIds.length,items:blockedMovementIds,goal:'Keep blocked operational movements blocked until a lawful executable corridor is established; do not invent missing geometry or service.'},
    {priority:'P0',id:'movement-hold',count:holdMovementIds.length,items:holdMovementIds,goal:'Keep reviewed operational movements on HOLD until current safety, permission and border conditions support execution.'},
    {priority:'P1',id:'unresolved-endpoint-geometry',count:unresolvedGeometryMovementIds.length,items:unresolvedGeometryMovementIds,goal:'Resolve exact arrival/departure endpoints before asserting continuity.'},
    {priority:'P1',id:'deferred-endpoint-geometry',count:deferredGeometryMovementIds.length,items:deferredGeometryMovementIds,goal:'Geometry is intentionally deferred while the associated movement is HOLD/BLOCKED; re-evaluate only when the corridor becomes executable.'},
    {priority:'P1',id:'missing-flight-geometry',count:missingFlightGeometryIds.length,items:missingFlightGeometryIds,goal:'Complete airport endpoint geometry without implying service availability.'},
    {priority:'P2',id:'movement-review',count:unresolvedMovementIds.length,items:unresolvedMovementIds,goal:'Add mode, duration, cost, booking decision and evidence where supported.'},
    {priority:'P2',id:'route-verification-dates',count:verificationQueue.length,items:verificationQueue,goal:'Refresh source-backed verification dates for operational route claims.'}
  ].filter(item=>item.count>0);

  const blockers=[
    !topology.canonical&&{
      id:'topology',
      category:'macro',
      count:topology.catalogOrderErrors.length+topology.adjacencyErrors.length+topology.missing.length+topology.duplicates.length,
      message:'The official route must be a canonical 195-country open path with the separate return home excluded from the 194-leg count.',
    },
    countriesOutsideLegs.length&&{
      id:'country-coverage',
      category:'macro',
      count:countriesOutsideLegs.length,
      message:'Every sovereign state must be represented consistently without changing the 195-country / 194-leg invariant.',
      items:countriesOutsideLegs,
    },
    unresolvedConnections.length&&{
      id:'continuity',
      category:'operations',
      count:unresolvedConnections.length,
      message:'Operational continuity still contains unresolved review work.',
    },
    blockedMovements&&{
      id:'movement-blocked',
      category:'operations',
      count:blockedMovements,
      message:'Reviewed operational movements remain BLOCKED under current entry/border conditions.',
      items:blockedMovementIds,
    },
    holdMovements&&{
      id:'movement-hold',
      category:'operations',
      count:holdMovements,
      message:'Reviewed operational movements remain on HOLD under current safety, permission or border conditions.',
      items:holdMovementIds,
    },
    needsReviewMovements&&{
      id:'movement-review',
      category:'operations',
      count:needsReviewMovements,
      message:'Inventoried domestic/operational movements still require a completed operational decision.',
    },
    missingFlightGeometryIds.length&&{
      id:'flight-geometry',
      category:'geometry',
      count:missingFlightGeometryIds.length,
      message:'Flight legs still lack complete endpoint geometry.',
      items:missingFlightGeometryIds,
    },
    criticalFeasibility&&{
      id:'critical-feasibility',
      category:'route',
      count:criticalFeasibility,
      message:'International legs remain marked with critical feasibility.',
    },
  ].filter(Boolean);

  const dataAsOf=latestDate([
    ...(route.segments||[]).map(segment=>segment.lastVerified),
    ...movements.map(movement=>movement.lastVerified),
    ...Object.values(flights.geometries||{}).flatMap(geometry=>[geometry.coordinateVerified,geometry.serviceVerified]),
    ...Object.values(criticalReviews.reviews||{}).map(review=>review.reviewedAt),
  ]);

  return {
    schemaVersion:2,
    dataAsOf,
    routeGeneratedAt:isoDate(route.generatedAt),
    scope:{
      tripId:'world-195',
      purpose:'Operational departure-readiness audit for the 195-country flagship route.',
      invariant:'195 sovereign states / 194 official international legs. Domestic movements and the post-trip return home never increase the official leg count.',
    },
    topology,
    structural,
    continuity,
    movements:movementHealth,
    flights:flightsHealth,
    evidence,
    criticalReviews:criticalReviewHealth,
    workQueue,
    blockers,
    status:{
      publicModelValid:
        structural.invariantOk&&
        topology.canonical&&
        continuity.countryMismatch===0&&
        movements.length===continuity.transferRequired+continuity.unresolvedEndpointGeometry,
      departureReady:blockers.length===0,
    },
  };
}
