import {readFile,writeFile} from 'node:fs/promises';

const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const route=await read('public-route.json');
const catalog=await read('airports.json');
const overrides=await read('flight-geometry-overrides.json');

const geometries={},endpoints={},review=[];
const requiresFullFlightGeometry=mode=>/^Flug(?:\s|\(|–|-|$)/i.test(String(mode||''));

for(const s of route.segments){
  if(!/Flug/i.test(String(s.mode||'')))continue;

  const override=overrides.selections?.[String(s.id)]||null;
  if(override){
    const coordinates=override.coordinates;
    const airportCodes=override.airportCodes;
    endpoints[s.id]={
      departure:{airportCode:airportCodes[0],coordinates:coordinates[0],source:override.sources.join(' ; '),coordinateVerified:overrides.reviewedAt},
      arrival:{airportCode:airportCodes.at(-1),coordinates:coordinates.at(-1),source:override.sources.join(' ; '),coordinateVerified:overrides.reviewedAt},
    };
    geometries[s.id]={
      airportCodes,
      coordinates,
      source:override.sources.join(' ; '),
      coordinateVerified:overrides.reviewedAt,
      serviceVerified:null,
      geometryDecision:'explicit-override',
    };
    continue;
  }

  // Every arrow node must name exactly one airport. Never turn alternatives
  // (LON, BKK/DMK, A:/B:, etc.) into a fictional multi-stop itinerary.
  const nodes=s.corridor.split('→');
  const codes=nodes.map(n=>[...new Set(n.match(/\b[A-Z]{3}\b/g)||[])]);
  const endpoint=index=>{
    const c=codes[index];
    if(/\b[AB]:/.test(s.corridor)||c.length!==1||!catalog.airports[c[0]])return null;
    return {airportCode:c[0],coordinates:catalog.airports[c[0]].coordinates,source:catalog.source,coordinateVerified:catalog.retrievedAt};
  };
  endpoints[s.id]={departure:endpoint(0),arrival:endpoint(nodes.length-1)};

  const clear=nodes.length>=2&&!/\b[AB]:|\boder\b|\balternativ\b/i.test(s.corridor)&&codes.every(c=>c.length===1&&catalog.airports[c[0]]);
  if(clear){
    geometries[s.id]={
      airportCodes:codes.map(c=>c[0]),
      coordinates:codes.map(c=>catalog.airports[c[0]].coordinates),
      source:catalog.source,
      coordinateVerified:catalog.retrievedAt,
      serviceVerified:null,
      geometryDecision:'corridor-explicit',
    };
    continue;
  }

  if(requiresFullFlightGeometry(s.mode)){
    review.push({
      legId:s.id,
      corridor:s.corridor,
      reason:'Select an explicit airport at every endpoint and transit stop; alternatives are not a booked routing.',
    });
  }
}

const output=JSON.stringify({
  version:3,
  method:'Airport coordinates only. Explicit geometry selections support map continuity and do not assert airline service, schedules, border permission, safety or booking availability.',
  geometries,
  endpoints,
  review,
},null,2)+'\n';
const target=new URL('../data/flight-geometries.json',import.meta.url);

if(process.argv.includes('--check')){
  const current=await readFile(target,'utf8').catch(()=>null);
  if(current!==output){
    console.error('FLIGHT GEOMETRY: generated file is stale. Run node scripts/build-flight-geometries.mjs');
    process.exitCode=1;
  }
}else{
  await writeFile(target,output);
}

console.log(
  'Flight geometry:',
  Object.keys(geometries).length,
  'explicit airport routes;',
  review.length,
  'pure-flight routes require a geometry decision'
);
