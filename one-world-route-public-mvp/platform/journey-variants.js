(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const clone=value=>{
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  function definitions(trip){
    if(!Array.isArray(trip?.variants))return [];
    const seen=new Set(),out=[];
    for(const item of trip.variants){
      const id=typeof item?.id==='string'?item.id.trim():'';
      if(!id||id==='base'||seen.has(id))continue;
      seen.add(id);
      out.push({...item,id});
    }
    return out;
  }

  function list(trip){
    return [
      {id:'base',title:trip?.title||null,summary:trip?.summary||null,base:true},
      ...definitions(trip).map(item=>({...item,base:false}))
    ];
  }

  function normalizeStops(stops){
    let day=1;
    return (stops||[]).map((stop,index)=>{
      const span=Math.max(1,Number(stop.dayEnd||stop.dayStart||day)-Number(stop.dayStart||day)+1);
      const nights=Math.max(0,Number(stop.nights||0));
      const next={...clone(stop),sequence:index+1,dayStart:day,dayEnd:day+span-1,nights};
      day+=span;
      return next;
    });
  }

  function windowStops(trip,definition){
    const stops=trip?.stops||[];
    const start=definition.startStopId?stops.findIndex(stop=>stop.id===definition.startStopId):0;
    const end=definition.endStopId?stops.findIndex(stop=>stop.id===definition.endStopId):stops.length-1;
    if(start<0||end<0||end<start)return null;
    return stops.slice(start,end+1);
  }

  function apply(trip,variantId='base'){
    if(!trip)return trip;
    const id=String(variantId||'base').trim()||'base';
    if(id==='base'){
      const next=clone(trip);
      next._variant={id:'base',base:true,adapted:false};
      return next;
    }
    const definition=definitions(trip).find(item=>item.id===id);
    if(!definition)return apply(trip,'base');
    const selected=windowStops(trip,definition);
    if(!selected?.length)return apply(trip,'base');

    const next=clone(trip);
    next.stops=normalizeStops(selected);
    const selectedIds=new Set(next.stops.map(stop=>stop.id));
    const orderedSegments=[];
    for(let index=0;index<next.stops.length-1;index++){
      const from=next.stops[index].id,to=next.stops[index+1].id;
      const segment=(trip.segments||[]).find(item=>item.fromStopId===from&&item.toStopId===to);
      if(!segment)return apply(trip,'base');
      orderedSegments.push({...clone(segment),sequence:index+1});
    }
    next.segments=orderedSegments;
    const placeIds=new Set(next.stops.map(stop=>stop.placeId));
    next.places=(trip.places||[]).filter(place=>placeIds.has(place.id)).map(clone);
    next.chapters=(trip.chapters||[]).map(chapter=>{
      const stopIds=(chapter.stopIds||[]).filter(stopId=>selectedIds.has(stopId));
      return stopIds.length?{...clone(chapter),stopIds}:null;
    }).filter(Boolean);
    next.planning={...(next.planning||{}),days:next.stops.at(-1)?.dayEnd||next.stops.length};
    if(definition.pace)next.planning.pace=definition.pace;
    if(definition.title)next.title=clone(definition.title);
    if(definition.summary)next.summary=clone(definition.summary);
    if(definition.highlights)next.highlights=clone(definition.highlights);
    if(definition.routePolicy)next.routePolicy={...(next.routePolicy||{}),...clone(definition.routePolicy)};
    next._variant={
      id:definition.id,
      base:false,
      adapted:true,
      title:clone(definition.title||null),
      sourceTripId:trip.id,
      startStopId:next.stops[0]?.id||null,
      endStopId:next.stops.at(-1)?.id||null
    };
    return next;
  }

  root.journeyVariants={definitions,list,apply,normalizeStops};
})();
