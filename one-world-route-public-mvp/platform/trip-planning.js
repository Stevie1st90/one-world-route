(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  const unique=values=>[...new Set((values||[]).filter(Boolean))];

  function snapshot(trip,meta){
    const segments=trip?.segments||[];
    const stops=trip?.stops||[];
    const modes=unique(segments.map(segment=>segment.transport?.mode));
    const knownCosts=segments.filter(segment=>segment.planning?.cost?.amount!==null&&segment.planning?.cost?.amount!==undefined&&Number.isFinite(Number(segment.planning.cost.amount)));
    const sourced=segments.filter(segment=>(segment.verification?.sourceIds||[]).length>0);
    const verified=segments.filter(segment=>segment.verification?.status==='verified');
    const checked=(trip?.sources||[]).map(source=>source.checkedAt).filter(Boolean).sort();
    return {
      days:Number(trip?.planning?.days||0),
      stops:stops.length,
      nights:stops.reduce((sum,stop)=>sum+Number(stop.nights||0),0),
      modes,
      knownCosts:knownCosts.length,
      sourced:sourced.length,
      verified:verified.length,
      totalSegments:segments.length,
      latestEvidenceCheck:checked.at(-1)||null,
      knownPublishedMinimum:trip?.planning?.knownPublishedMinimumEur!==null&&trip?.planning?.knownPublishedMinimumEur!==undefined&&Number.isFinite(Number(trip.planning.knownPublishedMinimumEur))
        ?Number(trip.planning.knownPublishedMinimumEur)
        :null,
      currency:trip?.planning?.currency||'EUR',
      fit:meta?.discovery?.fit||{}
    };
  }

  function itinerary(trip){
    const places=new Map((trip?.places||[]).map(place=>[place.id,place]));
    const segments=trip?.segments||[];
    return (trip?.stops||[]).map((stop,index)=>({
      stop,
      place:places.get(stop.placeId),
      incoming:index>0?segments[index-1]||null:null
    }));
  }

  function money(value,currency,locale){
    if(!Number.isFinite(Number(value)))return '—';
    try{return new Intl.NumberFormat(locale||'en',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value))}
    catch{return Number(value).toFixed(2)+' '+currency}
  }

  function render({trip,meta,profile,travellerFit,locale,t,esc,local,facetLabel}){
    if(!(meta?.capabilities||[]).includes('trip-planning'))return '';
    const s=snapshot(trip,meta);
    const fit=s.fit||{};
    const fitItems=[
      fit.pace?facetLabel(fit.pace):null,
      ...(fit.seasons||[]).slice(0,3).map(facetLabel),
      ...(fit.party||[]).slice(0,3).map(facetLabel)
    ].filter(Boolean);
    const rows=itinerary(trip).map(({stop,place,incoming})=>{
      const day=stop.dayStart===stop.dayEnd?String(stop.dayStart):stop.dayStart+'–'+stop.dayEnd;
      const mode=incoming?facetLabel(incoming.transport?.mode||'') : t('planningStartHere');
      return '<article class="platform-plan-stop"><span>'+esc(t('day'))+' '+esc(day)+'</span><div><b>'+esc(local(place?.name))+'</b><small>'+esc(stop.nights||0)+' '+esc(t('nights'))+' · '+esc(mode)+'</small></div></article>';
    }).join('');
    const origin=profile?.origin?'<span class="platform-plan-context">'+esc(t('planningOrigin'))+': <b>'+esc(profile.origin)+'</b></span>':'';
    const rawBudgetScope=trip?.planning?.knownPublishedMinimumScope;
    const budgetScope=rawBudgetScope&&typeof rawBudgetScope==='object'?local(rawBudgetScope):t('planningBudgetScope');
    const context=travellerFit?.evaluate?.(meta,profile);
    const contextItems=context?[
      '<span class="'+(context.partyListed?'ok':'check')+'">'+esc(facetLabel(context.party))+' · '+esc(context.partyListed?t('contextListed'):t('contextCheckNeeded'))+'</span>',
      context.reducedMobility?'<span class="check">'+esc(t('mobilityCheck'))+' · '+esc(facetLabel(context.accessibility||'standard-check'))+'</span>':'',
      context.vehicleContextMissing?'<span class="check">'+esc(t('vehicleContextMissing'))+'</span>':''
    ].filter(Boolean).join(''):'';
    return '<section class="platform-planning-guide">'+
      '<div class="platform-planning-head"><div><span>'+esc(t('planningGuide'))+'</span><h3>'+esc(t('planThisTrip'))+'</h3></div>'+origin+'</div>'+
      '<p class="detail-copy">'+esc(t('planningLead'))+'</p>'+
      '<div class="platform-plan-metrics">'+
        '<div><span>'+esc(t('knownTransportMinimum'))+'</span><b>'+esc(s.knownPublishedMinimum===null?'—':money(s.knownPublishedMinimum,s.currency,locale))+'</b></div>'+
        '<div><span>'+esc(t('fareCoverage'))+'</span><b>'+esc(s.knownCosts)+'/'+esc(s.totalSegments)+'</b></div>'+
        '<div><span>'+esc(t('transportModes'))+'</span><b>'+esc(s.modes.map(facetLabel).join(' · ')||'—')+'</b></div>'+
        '<div><span>'+esc(t('lastEvidenceCheck'))+'</span><b>'+esc(s.latestEvidenceCheck||'—')+'</b></div>'+
      '</div>'+
      '<div class="platform-plan-disclosure">'+esc(budgetScope)+'</div>'+
      (fitItems.length?'<div class="platform-plan-fit"><span>'+esc(t('routeFit'))+'</span><b>'+esc(fitItems.join(' · '))+'</b></div>':'')+
      (contextItems?'<div class="platform-plan-context-fit"><span>'+esc(t('travellerFit'))+'</span><div>'+contextItems+'</div></div>':'')+
      '<details class="platform-plan-itinerary"><summary>'+esc(t('dayByDay'))+' <span>'+esc(s.stops)+' '+esc(t('stops'))+'</span></summary><div class="platform-plan-itinerary-body">'+rows+'</div></details>'+
    '</section>';
  }

  root.tripPlanning={snapshot,itinerary,render};
})();
