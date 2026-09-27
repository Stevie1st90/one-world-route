(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  const clone=value=>{
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const rotate=(items,index)=>[...items.slice(index),...items.slice(0,index)];

  function policy(trip){
    const raw=trip?.routePolicy||{};
    const originMode=raw.originMode||'traveller-context';
    return {
      startMode:raw.startMode||'fixed',
      reversible:raw.reversible===true,
      reverseEvidenceReusable:raw.reverseEvidenceReusable===true,
      reversePlanningReusable:raw.reversePlanningReusable===true,
      originMode,
      originAccess:raw.originAccess||((originMode==='traveller-context')?'dynamic':'none'),
      returnMode:raw.returnMode||'to-origin',
      preserveCoreRoute:raw.preserveCoreRoute!==false
    };
  }

  function eligibleStartStops(trip){
    const p=policy(trip),stops=trip?.stops||[];
    if(!stops.length)return [];
    if(p.startMode==='endpoints'&&p.reversible&&stops.length>1)return [stops[0],stops.at(-1)];
    if(p.startMode==='any-stop')return [...stops];
    return [stops[0]];
  }

  function normalizeStops(stops){
    let day=1;
    return stops.map((stop,index)=>{
      const span=Math.max(1,Number(stop.dayEnd||stop.dayStart||day)-Number(stop.dayStart||day)+1);
      const next={...stop,sequence:index+1,dayStart:day,dayEnd:day+span-1};
      day+=span;
      return next;
    });
  }

  function reverseSegment(segment,index,p){
    const next=clone(segment);
    const from=next.fromStopId;
    next.fromStopId=next.toStopId;
    next.toStopId=from;
    next.sequence=index+1;
    if(!p.reversePlanningReusable&&next.planning){
      next.planning={...next.planning,durationMinutes:null,cost:null,durationBasis:'live-timetable-required'};
    }
    if(!p.reverseEvidenceReusable){
      next.verification={
        ...(next.verification||{}),
        status:'draft',
        sourceIds:[],
        lastVerified:null,
        notes:'Personalized reverse-direction variant. Confirm current transport, timing, fares and access conditions before travel.'
      };
    }
    return next;
  }

  function apply(trip,{startStopId}={}){
    if(!trip)return trip;
    const p=policy(trip),eligible=eligibleStartStops(trip);
    const selected=eligible.find(stop=>stop.id===startStopId)||eligible[0]||null;
    if(!selected)return trip;
    const first=trip.stops?.[0],last=trip.stops?.at(-1);

    if(p.startMode==='any-stop'){
      const index=(trip.stops||[]).findIndex(stop=>stop.id===selected.id);
      const next=clone(trip);
      if(index>0){
        next.stops=normalizeStops(rotate(next.stops,index));
        next.segments=rotate(next.segments,index).map((segment,segmentIndex)=>({...segment,sequence:segmentIndex+1}));
      }
      next._personalization={startStopId:selected.id,direction:'forward',adapted:index>0,rotation:index};
      return next;
    }

    const shouldReverse=p.startMode==='endpoints'&&p.reversible&&selected.id===last?.id&&selected.id!==first?.id;
    if(!shouldReverse){
      const next=clone(trip);
      next._personalization={startStopId:selected.id,direction:'forward',adapted:false};
      return next;
    }
    const next=clone(trip);
    next.stops=normalizeStops([...next.stops].reverse());
    next.segments=[...next.segments].reverse().map((segment,index)=>reverseSegment(segment,index,p));
    next._personalization={startStopId:selected.id,direction:'reverse',adapted:true};
    return next;
  }

  function originPlan(trip,profile={}){
    const p=policy(trip),stops=trip?.stops||[],segments=trip?.segments||[];
    const places=new Map((trip?.places||[]).map(place=>[place.id,place]));
    const startStop=stops[0]||null,lastStop=stops.at(-1)||null;
    const loop=p.startMode==='any-stop'&&Boolean(startStop&&lastStop&&segments.length===stops.length&&segments.at(-1)?.toStopId===startStop.id);
    const finishStop=loop?startStop:lastStop;
    const startPlace=places.get(startStop?.placeId)||null,finishPlace=places.get(finishStop?.placeId)||null;
    const origin=String(profile?.origin||'').trim()||null;
    const canAccess=p.originAccess==='dynamic'&&p.originMode==='traveller-context';
    return {
      structure:'origin-access-core-return',
      preserveCoreRoute:p.preserveCoreRoute,
      origin:{label:origin,countryCode:profile?.originCountry||null,region:profile?.originRegion||null},
      access:{
        enabled:canAccess,
        status:canAccess?(origin?'current-check-required':'origin-required'):'not-applicable',
        from:origin,
        toStopId:startStop?.id||null,
        toPlaceId:startPlace?.id||null
      },
      core:{
        startStopId:startStop?.id||null,
        startPlaceId:startPlace?.id||null,
        endStopId:finishStop?.id||null,
        endPlaceId:finishPlace?.id||null,
        routeMode:p.startMode,
        direction:trip?._personalization?.direction||'forward'
      },
      return:{
        enabled:canAccess&&p.returnMode==='to-origin',
        status:canAccess&&p.returnMode==='to-origin'?(origin?'current-check-required':'origin-required'):'not-applicable',
        fromStopId:finishStop?.id||null,
        fromPlaceId:finishPlace?.id||null,
        to:origin
      }
    };
  }

  root.journeyAdapter={policy,eligibleStartStops,apply,normalizeStops,originPlan};
})();
