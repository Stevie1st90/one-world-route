import {inventory} from './continuity-model.mjs';

const isFiniteNumber=value=>typeof value==='number'&&Number.isFinite(value);
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null;
const pct=(part,total)=>total?Math.round((part/total)*1000)/10:0;

function latestDate(values){
  return values.map(isoDate).filter(Boolean).sort().at(-1)||null;
}

export function buildFlagshipReadiness({route,waypoints,flights,operations}){
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
    return !(
      movement?.reviewStatus==='reviewed'&&
      connection.classification!=='unresolved-endpoint'&&
      connection.classification!=='country-mismatch'
    );
  });

  const movements=operations.movements||[];
  const flightLegs=(route.segments||[]).filter(segment=>/flug/i.test(String(segment.mode||'')));
  const fullFlightIds=new Set(Object.keys(flights.geometries||{}).map(Number));
  const missingFlightGeometryIds=flightLegs
    .filter(segment=>!fullFlightIds.has(Number(segment.id)))
    .map(segment=>Number(segment.id));

  const knownFlightEndpoints=Object.values(flights.endpoints||{})
    .reduce((count,endpoints)=>count+Number(Boolean(endpoints.departure))+Number(Boolean(endpoints.arrival)),0);

  const routeSources=(route.segments||[]).filter(segment=>Boolean(segment.source)).length;
  const routeVerified=(route.segments||[]).filter(segment=>segment.lastVerified!==null&&segment.lastVerified!==undefined).length;
  const criticalFeasibility=(route.segments||[]).filter(segment=>segment.feasibility==='Kritisch').length;
  const conditionalFeasibility=(route.segments||[]).filter(segment=>segment.feasibility==='Bedingt').length;
  const plannableFeasibility=(route.segments||[]).filter(segment=>segment.feasibility==='Planbar').length;

  const reviewedMovements=movements.filter(movement=>movement.reviewStatus==='reviewed').length;
  const needsReviewMovements=movements.filter(movement=>movement.reviewStatus==='needs-review').length;

  const structural={
    expectedCountries:195,
    expectedInternationalLegs:194,
    actualCountries:(route.countries||[]).length,
    actualInternationalLegs:(route.segments||[]).length,
    countriesInLegEndpoints:countriesInLegs.size,
    countriesOutsideLegs,
    invariantOk:(route.countries||[]).length===195&&(route.segments||[]).length===194,
  };

  const continuity={
    connections:connections.length,
    sharedEndpoints:connections.filter(connection=>connection.classification==='shared-endpoint').length,
    transferRequired:connections.filter(connection=>connection.classification==='transfer-required').length,
    unresolvedEndpointGeometry:connections.filter(connection=>connection.classification==='unresolved-endpoint').length,
    countryMismatch:connections.filter(connection=>connection.classification==='country-mismatch').length,
    unresolvedConnections:unresolvedConnections.length,
  };

  const movementHealth={
    total:movements.length,
    reviewed:reviewedMovements,
    needsReview:needsReviewMovements,
    reviewedPercent:pct(reviewedMovements,movements.length),
    unresolvedGeometry:movements.filter(movement=>!movement.coordinates).length,
    missingMode:movements.filter(movement=>!movement.mode).length,
    missingDuration:movements.filter(movement=>movement.plannedDuration===null).length,
    missingCost:movements.filter(movement=>movement.estimatedCost===null).length,
    missingBookingDecision:movements.filter(movement=>movement.bookingRequired===null).length,
    missingLastVerified:movements.filter(movement=>!movement.lastVerified).length,
    externallySourced:movements.filter(movement=>
      Array.isArray(movement.source)&&movement.source.some(source=>/^https?:\/\//i.test(source))
    ).length,
  };

  const flightsHealth={
    flightLegs:flightLegs.length,
    fullGeometries:fullFlightIds.size,
    fullGeometryPercent:pct(fullFlightIds.size,flightLegs.length),
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
    segmentsWithVerificationDate:routeVerified,
    segmentsWithVerificationDatePercent:pct(routeVerified,(route.segments||[]).length),
    feasibility:{
      plannable:plannableFeasibility,
      conditional:conditionalFeasibility,
      critical:criticalFeasibility,
    },
    segmentsMissingTransportBudget:(route.segments||[]).filter(segment=>!isFiniteNumber(segment.transportBudgetEur)).length,
  };

  const criticalLegIds=(route.segments||[]).filter(segment=>segment.feasibility==='Kritisch').map(segment=>Number(segment.id));
  const unresolvedMovementIds=movements.filter(movement=>movement.reviewStatus!=='reviewed').map(movement=>movement.id);
  const unresolvedGeometryMovementIds=movements.filter(movement=>!movement.coordinates).map(movement=>movement.id);

  const workQueue=[
    {priority:'P0',id:'macro-country-coverage',count:countriesOutsideLegs.length,items:countriesOutsideLegs,goal:'Resolve country coverage without changing the 195-country / 194-leg invariant.'},
    {priority:'P0',id:'critical-feasibility',count:criticalLegIds.length,items:criticalLegIds,goal:'Reverify or redesign critical international legs.'},
    {priority:'P1',id:'unresolved-endpoint-geometry',count:unresolvedGeometryMovementIds.length,items:unresolvedGeometryMovementIds,goal:'Resolve exact arrival/departure endpoints before asserting continuity.'},
    {priority:'P1',id:'missing-flight-geometry',count:missingFlightGeometryIds.length,items:missingFlightGeometryIds,goal:'Complete airport endpoint geometry without implying service availability.'},
    {priority:'P2',id:'movement-review',count:unresolvedMovementIds.length,items:unresolvedMovementIds,goal:'Add mode, duration, cost, booking decision and evidence where supported.'},
    {priority:'P2',id:'route-verification-dates',count:(route.segments||[]).length-routeVerified,goal:'Refresh source-backed verification dates for operational route claims.'}
  ].filter(item=>item.count>0);

  const blockers=[
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
      message:'Operational continuity still contains unresolved or unreviewed connections.',
    },
    needsReviewMovements&&{
      id:'movement-review',
      category:'operations',
      count:needsReviewMovements,
      message:'Inventoried domestic/operational movements still require review.',
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
    route.generatedAt,
    ...movements.map(movement=>movement.lastVerified),
    ...Object.values(flights.geometries||{}).flatMap(geometry=>[geometry.coordinateVerified,geometry.serviceVerified]),
  ]);

  return {
    schemaVersion:1,
    dataAsOf,
    scope:{
      tripId:'world-195',
      purpose:'Operational departure-readiness audit for the 195-country flagship route.',
      invariant:'195 sovereign states / 194 international legs. Domestic movements never increase the official leg count.',
    },
    structural,
    continuity,
    movements:movementHealth,
    flights:flightsHealth,
    evidence,
    workQueue,
    blockers,
    status:{
      publicModelValid:structural.invariantOk&&continuity.countryMismatch===0&&movements.length===continuity.transferRequired+continuity.unresolvedEndpointGeometry,
      departureReady:blockers.length===0,
    },
  };
}
