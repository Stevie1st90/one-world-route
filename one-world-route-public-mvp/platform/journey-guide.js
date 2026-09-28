(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  const unique=values=>[...new Set((values||[]).filter(Boolean))];

  function stopDays(stop){
    const start=Number(stop?.dayStart),end=Number(stop?.dayEnd);
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>=start)return end-start+1;
    const nights=Number(stop?.nights);
    return Number.isFinite(nights)&&nights>=0?Math.max(1,nights):1;
  }

  function snapshot(trip,meta){
    const stops=[...(trip?.stops||[])].sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0));
    const places=new Map((trip?.places||[]).map(place=>[place.id,place]));
    const segments=trip?.segments||[];
    const focus=stops.map(stop=>({
      stopId:stop.id,
      sequence:Number(stop.sequence||0),
      place:places.get(stop.placeId)||null,
      days:stopDays(stop),
      dayStart:stop.dayStart,
      dayEnd:stop.dayEnd
    })).sort((a,b)=>b.days-a.days||a.sequence-b.sequence).slice(0,3);
    const totalStopDays=stops.reduce((sum,stop)=>sum+stopDays(stop),0);
    const knownFareCount=segments.filter(segment=>{
      const amount=segment?.planning?.cost?.amount;
      return amount!==null&&amount!==undefined&&Number.isFinite(Number(amount));
    }).length;
    const reviewCount=segments.filter(segment=>segment?.verification?.status!=='verified').length;
    const verifiedCount=segments.length-reviewCount;
    const capabilities=meta?.capabilities||[];
    return {
      stops:stops.length,
      totalSegments:segments.length,
      averageStayDays:stops.length?totalStopDays/stops.length:0,
      focus,
      modes:unique(segments.map(segment=>segment?.transport?.mode)),
      countries:unique((trip?.places||[]).map(place=>place?.countryCode)),
      knownFareCount,
      reviewCount,
      verifiedCount,
      entryContext:Boolean(trip?.entryGuidance?.personalizationRequired),
      vehicleContext:capabilities.includes('vehicle-context'),
      originAccess:(trip?.routePolicy?.originAccess||'dynamic')==='dynamic'
    };
  }

  function interpolate(template,values){
    return Object.entries(values||{}).reduce((out,[key,value])=>out.replaceAll('{'+key+'}',String(value)),String(template||''));
  }

  function render({trip,meta,locale,t,esc,local,facetLabel}){
    const s=snapshot(trip,meta);
    if(!s.stops)return '';
    const format=value=>{
      try{return new Intl.NumberFormat(locale||'en',{maximumFractionDigits:1}).format(value)}
      catch{return String(Math.round(value*10)/10)}
    };
    const focus=s.focus.map(item=>{
      const dayRange=item.dayStart===item.dayEnd?String(item.dayStart):item.dayStart+'–'+item.dayEnd;
      return '<article><span>'+esc(t('day'))+' '+esc(dayRange)+'</span><b>'+esc(local(item.place?.name))+'</b><small>'+esc(item.days)+' '+esc(t('days'))+'</small></article>';
    }).join('');
    const checks=[];
    if(s.totalSegments){
      if(s.reviewCount>0)checks.push(interpolate(t('guideReviewSegments'),{count:s.reviewCount,total:s.totalSegments}));
      else checks.push(t('guideEvidenceReady'));
      if(s.knownFareCount<s.totalSegments)checks.push(interpolate(t('guideFareCoverage'),{known:s.knownFareCount,total:s.totalSegments}));
    }
    if(s.entryContext)checks.push(t('guideEntryContext'));
    if(s.vehicleContext)checks.push(t('guideVehicleContext'));
    if(s.originAccess)checks.push(t('guideOriginAccess'));
    const modeText=s.modes.length?s.modes.map(facetLabel).join(' · '):'—';
    return '<section class="platform-journey-guide">'+
      '<div class="platform-overview-section-head"><span>'+esc(t('journeyGuide'))+'</span><b>'+esc(t('guideDataDriven'))+'</b></div>'+
      '<p class="detail-copy">'+esc(t('journeyGuideLead'))+'</p>'+
      '<div class="platform-guide-rhythm">'+
        '<div><span>'+esc(t('averageStay'))+'</span><b>'+esc(format(s.averageStayDays))+' '+esc(t('days'))+'</b></div>'+
        '<div><span>'+esc(t('routeMovements'))+'</span><b>'+esc(s.totalSegments)+'</b></div>'+
        '<div><span>'+esc(t('transportModes'))+'</span><b>'+esc(modeText)+'</b></div>'+
      '</div>'+
      (focus?'<div class="platform-guide-subhead">'+esc(t('timeFocus'))+'</div><div class="platform-guide-focus">'+focus+'</div>':'')+
      (checks.length?'<details class="platform-guide-checks"><summary>'+esc(t('beforeBooking'))+' <span>'+esc(checks.length)+'</span></summary><ul>'+checks.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul></details>':'')+
    '</section>';
  }

  root.journeyGuide={snapshot,render};
})();
