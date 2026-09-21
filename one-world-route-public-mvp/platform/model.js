(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  function placeMap(trip){return new Map((trip?.places||[]).map(p=>[p.id,p]))}
  function stopMap(trip){return new Map((trip?.stops||[]).map(s=>[s.id,s]))}
  function stopPlace(trip,stop){return placeMap(trip).get(stop?.placeId)||null}
  function sourceMap(trip){return new Map((trip?.sources||[]).map(s=>[s.id,s]))}
  function extension(node,id){
    if(!node)return null;
    if(node.extensions&&Object.prototype.hasOwnProperty.call(node.extensions,id))return node.extensions[id];
    const legacy={
      cruise:'cruise',
      roadTrip:'roadTrip',
      road:'roadContext',
      border:'borderContext',
      cruiseCall:'call',
      port:'port'
    };
    const key=legacy[id];
    return key&&Object.prototype.hasOwnProperty.call(node,key)?node[key]:null;
  }
  function routeGeometry(trip){
    const sm=stopMap(trip),pm=placeMap(trip);
    return (trip?.segments||[]).map((segment,index)=>{
      const from=pm.get(sm.get(segment.fromStopId)?.placeId);
      const to=pm.get(sm.get(segment.toStopId)?.placeId);
      if(!from?.coordinates||!to?.coordinates)return null;
      return {...segment,_index:index,start:from.coordinates,end:to.coordinates};
    }).filter(Boolean);
  }
  function routeBounds(trip){
    const points=(trip?.places||[]).map(p=>p.coordinates).filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng)));
    if(!points.length)return null;
    const lngs=points.map(p=>Number(p.lng)),lats=points.map(p=>Number(p.lat));
    return [[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]];
  }
  function chapterForSegment(trip,index){
    const segment=trip?.segments?.[index];
    if(!segment)return null;
    return (trip.chapters||[]).find(ch=>(ch.stopIds||[]).includes(segment.fromStopId)||(ch.stopIds||[]).includes(segment.toStopId))||null;
  }
  function hasCapability(meta,id){return Array.isArray(meta?.capabilities)&&meta.capabilities.includes(id)}
  function metrics(trip){
    return {
      days:trip?.planning?.days??null,
      stops:trip?.stops?.length||0,
      segments:trip?.segments?.length||0,
      countries:new Set((trip?.places||[]).map(p=>p.countryCode).filter(Boolean)).size
    };
  }
  root.model={placeMap,stopMap,stopPlace,sourceMap,extension,routeGeometry,routeBounds,chapterForSegment,hasCapability,metrics};
})();
