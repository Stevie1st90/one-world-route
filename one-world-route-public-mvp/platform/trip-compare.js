(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const fitService=root.travellerFit;
  if(!fitService)throw new Error('Traveller Fit service unavailable');

  function derivedParty(profile){return fitService.partyKey(profile)}

  function toggle(selection,id,max=3){
    if(selection.has(id)){selection.delete(id);return {selected:false,limit:false}}
    if(selection.size>=max)return {selected:false,limit:true};
    selection.add(id);return {selected:true,limit:false};
  }

  function row(label,values,esc){
    return '<div class="platform-compare-row"><b>'+esc(label)+'</b>'+values.map(value=>'<span>'+esc(value||'—')+'</span>').join('')+'</div>';
  }

  function open({catalog,selectedIds,profile,ensureDialog,t,esc,local,facetLabel,statusLabel,onOpenTrip}){
    const selected=(catalog.trips||[]).filter(trip=>selectedIds.includes(trip.id)).slice(0,3);
    if(selected.length<2)return null;
    const modal=ensureDialog('platformCompareModal');
    const party=derivedParty(profile);
    const columns=selected.map(trip=>'<article class="platform-compare-trip"><h3>'+esc(local(trip.title))+'</h3><p>'+esc(local(trip.subtitle))+'</p><button type="button" data-compare-open="'+esc(trip.id)+'">'+esc(t('open'))+' →</button></article>').join('');
    const values=fn=>selected.map(fn);
    const partyValues=values(trip=>{
      const fit=fitService.evaluate(trip,profile);
      return facetLabel(party)+' · '+(fit.partyListed?t('listedForContext'):t('contextCheckNeeded'));
    });
    const accessValues=values(trip=>{
      const fit=fitService.evaluate(trip,profile);
      const label=facetLabel(fit.accessibility||'');
      return fit.reducedMobility?t('mobilityCheck')+': '+label:label;
    });
    modal.innerHTML='<div class="platform-modal-card platform-compare-card glass"><button class="platform-x" type="button" aria-label="'+esc(t('close'))+'">×</button>'+
      '<div class="platform-eyebrow">'+esc(t('compareTrips'))+'</div><h2>'+esc(t('compareTrips'))+'</h2><p class="platform-lead">'+esc(t('compareLead'))+'</p>'+
      '<div class="platform-compare-grid" style="--compare-columns:'+selected.length+'"><div class="platform-compare-head-spacer"></div>'+columns+
      row(t('duration'),values(trip=>trip.metrics?.days?trip.metrics.days+' '+t('days'):'—'),esc)+
      row(t('countriesUnit'),values(trip=>String(trip.metrics?.countries??'—')),esc)+
      row(t('stops'),values(trip=>String(trip.metrics?.stops??trip.metrics?.internationalLegs??'—')),esc)+
      row(t('transportModes'),values(trip=>(trip.discovery?.modes||[]).map(facetLabel).join(' · ')),esc)+
      row(t('fitPace'),values(trip=>facetLabel(trip.discovery?.fit?.pace||'')),esc)+
      row(t('fitSeason'),values(trip=>(trip.discovery?.fit?.seasons||[]).map(facetLabel).join(' · ')),esc)+
      row(t('travellerParty'),partyValues,esc)+
      row(t('filterAccessibility'),accessValues,esc)+
      row(t('editorialStatus'),values(trip=>statusLabel(trip)),esc)+
      row(t('homeBaseModel'),values(trip=>{
        const budget=trip.metrics?.budget;
        if(!budget||!Number.isFinite(Number(budget.amount)))return '—';
        try{return new Intl.NumberFormat(profile?.language||'en',{style:'currency',currency:budget.currency||'EUR',maximumFractionDigits:0}).format(Number(budget.amount))}
        catch{return String(budget.amount)+' '+String(budget.currency||'EUR')}
      }),esc)+
      '</div></div>';
    modal.classList.remove('hidden');
    modal.querySelector('.platform-x').onclick=()=>modal.classList.add('hidden');
    modal.querySelectorAll('[data-compare-open]').forEach(button=>button.onclick=()=>onOpenTrip(button.dataset.compareOpen));
    return modal;
  }

  root.tripCompare={derivedParty,toggle,open};
})();
