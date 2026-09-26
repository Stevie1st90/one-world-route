import {readFile,writeFile} from 'node:fs/promises';
import {buildFlagshipReadiness} from './flagship-readiness-model.mjs';

const dataUrl=name=>new URL('../data/'+name,import.meta.url);
const read=async name=>JSON.parse(await readFile(dataUrl(name),'utf8'));

const report=buildFlagshipReadiness({
  route:await read('public-route.json'),
  waypoints:await read('route-waypoints.json'),
  flights:await read('flight-geometries.json'),
  operations:await read('operational-movements.json'),
});

const output=JSON.stringify(report,null,2)+'\n';
const reportUrl=dataUrl('flagship-readiness.json');

if(process.argv.includes('--check')){
  const current=await readFile(reportUrl,'utf8').catch(()=>null);
  if(current!==output){
    console.error('FLAGSHIP READINESS: generated report is stale. Run node scripts/audit-flagship-readiness.mjs');
    process.exitCode=1;
  }
}else{
  await writeFile(reportUrl,output,'utf8');
}

console.log(JSON.stringify({
  dataAsOf:report.dataAsOf,
  invariant:report.structural.invariantOk,
  canonicalPath:report.structural.canonicalPath,
  routeStart:report.structural.routeStart,
  routeEnd:report.structural.routeEnd,
  countriesOutsideLegs:report.structural.countriesOutsideLegs,
  unresolvedConnections:report.continuity.unresolvedConnections,
  movementsNeedsReview:report.movements.needsReview,
  missingFlightGeometries:report.flights.missingFullGeometries,
  criticalFeasibility:report.evidence.feasibility.critical,
  invalidVerificationDates:report.evidence.invalidVerificationDates.length,
  missingVerificationDates:report.evidence.missingVerificationDates.length,
  publicModelValid:report.status.publicModelValid,
  departureReady:report.status.departureReady,
},null,2));

if(process.argv.includes('--strict')&&!report.status.departureReady)process.exitCode=1;
