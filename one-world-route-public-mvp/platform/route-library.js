(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  function open(deps){
    const {catalog,currentTripMeta,Discovery,ensureDialog,t,local,esc,facetLabel,statusLabel,pluralLabel,onOpenTrip}=deps;
    const $=(s,r=document)=>r.querySelector(s);
    const modal=ensureDialog('platformRouteModal');
    const PAGE_SIZE=36;
    let visibleLimit=PAGE_SIZE;
    const {kinds,regions,modes,themes,paces,seasons,parties,starts,accessibilities}=Discovery.facets(catalog);
    const card=r=>{
      const metrics=[];
      if(r.metrics?.days)metrics.push(`${r.metrics.days} ${t('days')}`);
      if(r.metrics?.stops)metrics.push(`${r.metrics.stops} ${t('stops')}`);
      if(r.metrics?.countries)metrics.push(`${r.metrics.countries} ${pluralLabel(r.metrics.countries,'countryUnit','countriesUnit')}`);
      if(r.metrics?.nights)metrics.push(`${r.metrics.nights} ${t('onboardNights')}`);
      if(r.metrics?.seaDays)metrics.push(`${r.metrics.seaDays} ${t('seaDays')}`);
      const fallbackTheme={world:'ocean','round-trip':'aegean','road-trip':'desert',rail:'rockies',cruise:'ocean',camper:'fern','island-hopping':'aegean',multimodal:'andes'}[r.kind]||'ocean';
      const theme=String(r.visual?.theme||fallbackTheme).replace(/[^a-z0-9-]/gi,'');
      const region=(r.discovery?.regions||[]).find(value=>!['global','europe','asia','africa','north-america','south-america','oceania'].includes(value))||r.discovery?.regions?.[0]||r.kind;
      return `<article class="platform-route-card ${r.id===currentTripMeta?.id?'active':''}"><div class="platform-route-card-visual visual-${esc(theme)}"><span>${esc(facetLabel(region))}</span><b>${esc(facetLabel(r.kind))}</b><div class="platform-home-card-route-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><div class="platform-route-card-body"><div class="platform-route-top"><span>${esc(facetLabel(r.kind))}</span><b>${esc(statusLabel(r))}</b></div><h3>${esc(local(r.title))}</h3><p>${esc(local(r.subtitle))}</p><div class="platform-route-metrics">${metrics.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button type="button" data-platform-trip="${esc(r.id)}">${esc(t('open'))} →</button></div></article>`;
    };

    modal.innerHTML=`<div class="platform-modal-card route-library-card glass"><button class="platform-x" aria-label="Close">×</button><div class="platform-eyebrow">ONE WORLD ROUTE</div><h2>${esc(t('routeLibrary'))}</h2><p class="platform-lead">${esc(t('routeLibraryLead'))}</p><div class="platform-route-filters"><label class="route-search"><span>${esc(t('searchRoutes'))}</span><input id="platformRouteSearch" type="search" autocomplete="off" placeholder="${esc(t('searchRoutes'))}"></label><button id="platformPrimaryFilterToggle" class="platform-route-mobile-filter-toggle" type="button" aria-expanded="false">${esc(t('filters'))} <span>＋</span></button><label><span>${esc(t('filterType'))}</span><select id="platformRouteKind"><option value="">${esc(t('all'))}</option>${kinds.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterRegion'))}</span><select id="platformRouteRegion"><option value="">${esc(t('all'))}</option>${regions.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterDuration'))}</span><select id="platformRouteDuration"><option value="">${esc(t('all'))}</option><option value="7-14">7–14 ${esc(t('days'))}</option><option value="15-30">15–30 ${esc(t('days'))}</option><option value="31-89">31–89 ${esc(t('days'))}</option><option value="90-plus">90+ ${esc(t('days'))}</option></select></label><label><span>${esc(t('filterMode'))}</span><select id="platformRouteMode"><option value="">${esc(t('all'))}</option>${modes.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterTheme'))}</span><select id="platformRouteTheme"><option value="">${esc(t('all'))}</option>${themes.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label></div><div class="platform-fit-head"><button id="platformFitToggle" type="button" aria-expanded="false">${esc(t('showFit'))}</button></div><div id="platformFitFilters" class="platform-fit-filters hidden"><div class="platform-fit-title">${esc(t('routeFit'))}</div><label><span>${esc(t('fitPace'))}</span><select id="platformRoutePace"><option value="">${esc(t('all'))}</option>${paces.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitSeason'))}</span><select id="platformRouteSeason"><option value="">${esc(t('all'))}</option>${seasons.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitParty'))}</span><select id="platformRouteParty"><option value="">${esc(t('all'))}</option>${parties.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitStart'))}</span><select id="platformRouteStart"><option value="">${esc(t('all'))}</option>${starts.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterAccessibility'))}</span><select id="platformRouteAccessibility"><option value="">${esc(t('all'))}</option>${accessibilities.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label></div><div class="platform-route-resultbar"><span id="platformRouteCount"></span><button id="platformRouteReset" type="button">${esc(t('resetFilters'))}</button></div><div id="platformRouteResults" class="platform-route-grid"></div><button id="platformRouteMore" class="platform-route-more" type="button" hidden>${esc(t('loadMoreJourneys').replace('{count}',String(PAGE_SIZE)))}</button></div>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');

    const render=()=>{
      const filters={
        q:String($('#platformRouteSearch',modal)?.value||'').trim().toLowerCase(),
        kind:$('#platformRouteKind',modal)?.value||'',
        region:$('#platformRouteRegion',modal)?.value||'',
        duration:$('#platformRouteDuration',modal)?.value||'',
        mode:$('#platformRouteMode',modal)?.value||'',
        theme:$('#platformRouteTheme',modal)?.value||'',
        pace:$('#platformRoutePace',modal)?.value||'',
        season:$('#platformRouteSeason',modal)?.value||'',
        party:$('#platformRouteParty',modal)?.value||'',
        start:$('#platformRouteStart',modal)?.value||'',
        accessibility:$('#platformRouteAccessibility',modal)?.value||''
      };
      const filtered=Discovery.filter(catalog,filters,r=>[local(r.title),local(r.subtitle),r.kind,...(r.discovery?.regions||[]),...(r.discovery?.themes||[]),...(r.discovery?.modes||[])].join(' '));
      const ordered=[...filtered].sort((a,b)=>{
        const currentA=a.id===currentTripMeta?.id?1:0,currentB=b.id===currentTripMeta?.id?1:0;
        if(currentA!==currentB)return currentB-currentA;
        const priority=Number(b.visual?.featurePriority||0)-Number(a.visual?.featurePriority||0);
        if(priority)return priority;
        return local(a.title).localeCompare(local(b.title));
      });
      const visible=ordered.slice(0,visibleLimit);
      const host=$('#platformRouteResults',modal);
      host.innerHTML=visible.length?visible.map(card).join(''):`<div class="platform-no-routes">${esc(t('noRoutes'))}</div>`;
      const count=$('#platformRouteCount',modal);if(count)count.textContent=t('showingJourneys').replace('{shown}',String(visible.length)).replace('{total}',String(ordered.length));
      const more=$('#platformRouteMore',modal);
      if(more){
        more.hidden=visible.length>=ordered.length;
        more.textContent=t('loadMoreJourneys').replace('{count}',String(Math.min(PAGE_SIZE,Math.max(0,ordered.length-visible.length))));
      }
    };

    $('#platformPrimaryFilterToggle',modal)?.addEventListener('click',e=>{
      const button=e.currentTarget,opening=!modal.classList.contains('route-filters-open');
      modal.classList.toggle('route-filters-open',opening);
      button.setAttribute('aria-expanded',String(opening));
      button.innerHTML=esc(t(opening?'hideFilters':'filters'))+' <span>'+(opening?'−':'＋')+'</span>';
    });
        $('#platformFitToggle',modal)?.addEventListener('click',e=>{
      const filters=$('#platformFitFilters',modal),button=e.currentTarget,opening=filters?.classList.contains('hidden');
      filters?.classList.toggle('hidden',!opening);
      button.setAttribute('aria-expanded',String(Boolean(opening)));
      button.textContent=t(opening?'hideFit':'showFit');
    });
    const results=$('#platformRouteResults',modal);
    results.addEventListener('click',e=>{
      const button=e.target.closest('[data-platform-trip]');
      if(!button||!results.contains(button))return;
      e.preventDefault();
      onOpenTrip(button.dataset.platformTrip);
    });
    ['platformRouteSearch','platformRouteKind','platformRouteRegion','platformRouteDuration','platformRouteMode','platformRouteTheme','platformRoutePace','platformRouteSeason','platformRouteParty','platformRouteStart','platformRouteAccessibility'].forEach(id=>$('#'+id,modal)?.addEventListener(id==='platformRouteSearch'?'input':'change',()=>{visibleLimit=PAGE_SIZE;render()}));
    $('#platformRouteMore',modal)?.addEventListener('click',()=>{visibleLimit+=PAGE_SIZE;render()});
    $('#platformRouteReset',modal)?.addEventListener('click',()=>{
      visibleLimit=PAGE_SIZE;
      const search=$('#platformRouteSearch',modal);if(search)search.value='';
      ['platformRouteKind','platformRouteRegion','platformRouteDuration','platformRouteMode','platformRouteTheme','platformRoutePace','platformRouteSeason','platformRouteParty','platformRouteStart','platformRouteAccessibility'].forEach(id=>{const el=$('#'+id,modal);if(el)el.value=''});
      render();
    });
    render();
    return modal;
  }

  root.routeLibrary={open};
})();
