import {readFile,writeFile} from 'node:fs/promises';
const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const route=await read('public-route.json'),catalog=await read('airports.json');
const geometries={},endpoints={},review=[];
for(const s of route.segments){
  if(!/Flug/i.test(s.mode))continue;
  // Every arrow node must name exactly one airport. Never turn alternatives
  // (LON, BKK/DMK, A:/B:, etc.) into a fictional multi-stop itinerary.
  const nodes=s.corridor.split('→');
  const codes=nodes.map(n=>[...new Set(n.match(/\b[A-Z]{3}\b/g)||[])]);
  const endpoint=(index)=>{
    const c=codes[index];
    if(/\b[AB]:/.test(s.corridor)||c.length!==1||!catalog.airports[c[0]])return null;
    return {airportCode:c[0],coordinates:catalog.airports[c[0]].coordinates,source:catalog.source,coordinateVerified:catalog.retrievedAt};
  };
  endpoints[s.id]={departure:endpoint(0),arrival:endpoint(nodes.length-1)};
  const clear=nodes.length>=2&&!/\b[AB]:|\boder\b|\balternativ\b/i.test(s.corridor)&&codes.every(c=>c.length===1&&catalog.airports[c[0]]);
  if(!clear){review.push({legId:s.id,corridor:s.corridor,reason:'Select an explicit airport at every endpoint and transit stop; alternatives are not a booked routing.'});continue;}
  geometries[s.id]={airportCodes:codes.map(c=>c[0]),coordinates:codes.map(c=>catalog.airports[c[0]].coordinates),source:catalog.source,coordinateVerified:catalog.retrievedAt,serviceVerified:null};
}
await writeFile(new URL('../data/flight-geometries.json',import.meta.url),JSON.stringify({version:1,method:'Airport coordinates only; no assertion of airline service, schedule or booking availability.',geometries,endpoints,review},null,2)+'\n');
console.log('Flight geometry:',Object.keys(geometries).length,'explicit airport routes;',review.length,'require routing decisions');
