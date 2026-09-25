(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;
  const compareSelection=new Set();
  const $=(s,r=document)=>r.querySelector(s);

  function configure(next){deps=next;return api}
  function context(){if(!deps)throw new Error('Platform home is not configured');return deps}

  function option(value,label){return '<option value="'+context().esc(value)+'">'+context().esc(label)+'</option>'}

  function formatDate(value){
    const d=context();
    if(!value)return '—';
    try{return new Intl.DateTimeFormat(d.locale(),{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value+'T12:00:00Z'))}
    catch{return String(value)}
  }

  function formatBudget(budget){
    const d=context();
    if(!budget||!Number.isFinite(Number(budget.amount)))return '—';
    try{return new Intl.NumberFormat(d.locale(),{style:'currency',currency:budget.currency||'EUR',maximumFractionDigits:0}).format(Number(budget.amount))}
    catch{return String(budget.amount)+' '+String(budget.currency||'EUR')}
  }

  function metricChips(trip){
    const d=context(),out=[];
    if(trip.metrics?.days)out.push(trip.metrics.days+' '+d.t('days'));
    if(trip.metrics?.stops)out.push(trip.metrics.stops+' '+d.t('stops'));
    if(trip.metrics?.countries)out.push(trip.metrics.countries+' '+d.pluralLabel(trip.metrics.countries,'countryUnit','countriesUnit'));
    if(trip.metrics?.internationalLegs)out.push(trip.metrics.internationalLegs+' '+d.t('homeLegs'));
    const modes=trip.discovery?.modes||[];
    if(modes.length)out.push(modes.slice(0,2).map(d.facetLabel).join(' · '));
    const fit=trip.discovery?.fit||{};
    if(fit.pace)out.push(d.facetLabel(fit.pace));
    if(fit.accessibility)out.push(d.facetLabel(fit.accessibility));
    return out;
  }

  function card(trip){
    const d=context(),saved=d.tripTools?.isSaved(d.storage,trip.id)===true,compared=compareSelection.has(trip.id);
    return '<article class="platform-home-card" data-home-trip="'+d.esc(trip.id)+'">'+
      '<div class="platform-home-card-top"><span>'+d.esc(d.facetLabel(trip.kind))+'</span><b>'+(saved?'★ '+d.esc(d.t('saved'))+' · ':'')+d.esc(d.statusLabel(trip))+'</b></div>'+
      '<h3>'+d.esc(d.local(trip.title))+'</h3>'+
      '<p>'+d.esc(d.local(trip.subtitle))+'</p>'+
      '<div class="platform-home-card-metrics">'+metricChips(trip).map(v=>'<span>'+d.esc(v)+'</span>').join('')+'</div>'+
      '<div class="platform-home-card-actions">'+
        '<button type="button" class="'+(saved?'active':'')+'" data-home-save-trip="'+d.esc(trip.id)+'">'+d.esc(saved?d.t('removeSaved'):d.t('saveTrip'))+'</button>'+
        '<button type="button" class="'+(compared?'active':'')+'" data-home-compare-trip="'+d.esc(trip.id)+'">'+d.esc(d.t('compare'))+'</button>'+
        '<button type="button" class="primary" data-open-home-trip="'+d.esc(trip.id)+'">'+d.esc(d.t('open'))+' →</button>'+
      '</div>'+
    '</article>';
  }

  function filtersMarkup(){
    const d=context();
    const facets=d.Discovery.facets(d.catalog);
    const select=(id,label,values)=>'<label><span>'+d.esc(label)+'</span><select id="'+id+'"><option value="">'+d.esc(d.t('all'))+'</option>'+values.map(v=>option(v,d.facetLabel(v))).join('')+'</select></label>';
    return '<div class="platform-home-filter-grid">'+
      '<label class="platform-home-search"><span>'+d.esc(d.t('searchRoutes'))+'</span><input id="homeRouteSearch" type="search" autocomplete="off" placeholder="'+d.esc(d.t('searchRoutes'))+'"></label>'+
      '<label class="platform-home-saved-filter"><span>'+d.esc(d.t('savedOnly'))+'</span><input id="homeRouteSavedOnly" type="checkbox"></label>'+
      select('homeRouteRegion',d.t('filterRegion'),facets.regions)+
      select('homeRouteMode',d.t('filterMode'),facets.modes)+
      select('homeRouteTheme',d.t('filterTheme'),facets.themes)+
      '<label><span>'+d.esc(d.t('filterDuration'))+'</span><select id="homeRouteDuration"><option value="">'+d.esc(d.t('all'))+'</option><option value="7-14">7–14 '+d.esc(d.t('days'))+'</option><option value="15-30">15–30 '+d.esc(d.t('days'))+'</option><option value="31-89">31–89 '+d.esc(d.t('days'))+'</option><option value="90-plus">90+ '+d.esc(d.t('days'))+'</option></select></label>'+
      select('homeRoutePace',d.t('fitPace'),facets.paces)+
      select('homeRouteSeason',d.t('fitSeason'),facets.seasons)+
      select('homeRouteParty',d.t('fitParty'),facets.parties)+
      select('homeRouteStart',d.t('fitStart'),facets.starts)+
      select('homeRouteAccessibility',d.t('filterAccessibility'),facets.accessibilities)+
    '</div>';
  }

  function renderCards(){
    const d=context(),host=$('#platformHomeResults');
    if(!host)return;
    const filters={
      q:String($('#homeRouteSearch')?.value||'').trim().toLowerCase(),
      region:$('#homeRouteRegion')?.value||'',
      duration:$('#homeRouteDuration')?.value||'',
      mode:$('#homeRouteMode')?.value||'',
      theme:$('#homeRouteTheme')?.value||'',
      pace:$('#homeRoutePace')?.value||'',
      season:$('#homeRouteSeason')?.value||'',
      party:$('#homeRouteParty')?.value||'',
      start:$('#homeRouteStart')?.value||'',
      accessibility:$('#homeRouteAccessibility')?.value||''
    };
    let found=d.Discovery.filter(d.catalog,filters,trip=>[
      d.local(trip.title),d.local(trip.subtitle),trip.kind,
      ...(trip.discovery?.regions||[]),...(trip.discovery?.themes||[]),...(trip.discovery?.modes||[])
    ].join(' '));
    if($('#homeRouteSavedOnly')?.checked)found=found.filter(trip=>d.tripTools.isSaved(d.storage,trip.id));
    host.innerHTML=found.length?found.map(card).join(''):'<div class="platform-home-empty">'+d.esc(d.t('noRoutes'))+'</div>';
    const count=$('#platformHomeCount');
    if(count)count.textContent=found.length+' '+d.pluralLabel(found.length,'resultOne','results');
    const compare=$('#platformHomeCompare');
    if(compare){
      compare.textContent=d.t('compareSelected').replace('{count}',String(compareSelection.size));
      compare.disabled=compareSelection.size<2;
    }
  }

  async function renderGlobe(){
    const d=context(),globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    if(!globe)return;
    const metas=d.catalog.trips||[];
    let centroids=[];
    if(metas.some(meta=>meta.renderer==='legacy-world')){
      try{
        const response=await fetch('./data/country-centroids.json',{cache:'force-cache'});
        if(response.ok)centroids=await response.json();
      }catch(error){console.warn('Homepage flagship centroids unavailable',error)}
    }
    const centroidMap=new Map(centroids.map(country=>[country.name,country]));
    const regionNames=(()=>{
      try{return new Intl.DisplayNames([d.locale()],{type:'region'})}
      catch{return null}
    })();
    const countryName=country=>{
      if(!country)return '';
      try{return country.cca2&&regionNames?regionNames.of(country.cca2):country.name}
      catch{return country.name||''}
    };
    const loaded=await Promise.all(metas.map(async meta=>{
      try{
        const response=await fetch(meta.dataset,{cache:'no-cache'});
        if(!response.ok)throw new Error(String(response.status));
        const data=await response.json();
        if(meta.renderer==='regional-globe')return {meta,type:'regional',trip:data};
        if(meta.renderer==='legacy-world')return {meta,type:'legacy',trip:data};
        return null;
      }catch(error){
        console.warn('Homepage route preview unavailable',meta.id,error);
        return null;
      }
    }));
    const arcs=[],points=[];
    for(const entry of loaded.filter(Boolean)){
      if(entry.type==='regional'){
        const pm=d.Model.placeMap(entry.trip),sm=d.Model.stopMap(entry.trip);
        for(const segment of d.Model.routeGeometry(entry.trip)){
          arcs.push({
            ...segment,
            tripId:entry.meta.id,
            tripTitle:d.local(entry.meta.title),
            featured:entry.meta.discovery?.featured===true,
            fromName:d.local(pm.get(sm.get(segment.fromStopId)?.placeId)?.name),
            toName:d.local(pm.get(sm.get(segment.toStopId)?.placeId)?.name)
          });
        }
        for(const place of entry.trip.places||[]){
          if(!Number.isFinite(Number(place.coordinates?.lat))||!Number.isFinite(Number(place.coordinates?.lng)))continue;
          points.push({...place,tripId:entry.meta.id,tripTitle:d.local(entry.meta.title),displayName:d.local(place.name),previewRole:'regional'});
        }
        continue;
      }
      const tripTitle=d.local(entry.meta.title);
      for(const segment of entry.trip.segments||[]){
        const from=centroidMap.get(segment.from),to=centroidMap.get(segment.to);
        if(!from||!to)continue;
        arcs.push({
          ...segment,
          tripId:entry.meta.id,
          tripTitle,
          featured:entry.meta.discovery?.featured===true,
          start:{lat:Number(from.lat),lng:Number(from.lng)},
          end:{lat:Number(to.lat),lng:Number(to.lng)},
          fromName:countryName(from),
          toName:countryName(to),
          previewRole:'flagship'
        });
      }
      for(const country of centroids){
        if(!Number.isFinite(Number(country.lat))||!Number.isFinite(Number(country.lng)))continue;
        points.push({
          id:'flagship-'+country.cca3,
          tripId:entry.meta.id,
          tripTitle,
          displayName:countryName(country),
          coordinates:{lat:Number(country.lat),lng:Number(country.lng)},
          previewRole:'flagship'
        });
      }
    }
    try{
      if(typeof globe.htmlElementsData==='function')globe.htmlElementsData([]);
      if(typeof globe.labelsData==='function')globe.labelsData([]);
      if(typeof globe.ringsData==='function')globe.ringsData([]);
      globe.arcsData(arcs)
        .arcStartLat(item=>item.start.lat).arcStartLng(item=>item.start.lng)
        .arcEndLat(item=>item.end.lat).arcEndLng(item=>item.end.lng)
        .arcAltitude(item=>{
          const span=Math.max(Math.abs(item.start.lat-item.end.lat),Math.abs(item.start.lng-item.end.lng));
          return item.previewRole==='flagship'?Math.min(.17,.025+span*.0022):Math.min(.075,.012+span*.0015);
        })
        .arcStroke(item=>item.previewRole==='flagship'?.16:(item.featured?.34:.22))
        .arcColor(item=>item.previewRole==='flagship'?'rgba(89,221,255,.42)':(item.featured?['#59ddff','#9276ff']:'rgba(124,166,205,.44)'))
        .arcDashLength(1).arcDashGap(0).arcDashAnimateTime(0)
        .arcLabel(item=>'<b>'+d.esc(item.tripTitle)+'</b><br><span>'+d.esc(item.fromName)+' → '+d.esc(item.toName)+'</span>')
        .onArcClick(item=>d.onOpenTrip(item.tripId));
      globe.pointsData(points)
        .pointLat(place=>place.coordinates.lat).pointLng(place=>place.coordinates.lng)
        .pointAltitude(.011).pointRadius(place=>place.previewRole==='flagship'?.026:.055)
        .pointColor(place=>place.previewRole==='flagship'?'rgba(172,222,240,.42)':'rgba(207,243,255,.72)')
        .pointLabel(place=>'<b>'+d.esc(place.displayName)+'</b><br><span>'+d.esc(place.tripTitle)+'</span>')
        .onPointClick(place=>d.onOpenTrip(place.tripId));
      if(typeof globe.polygonLabel==='function')globe.polygonLabel(()=> '');
      if(globe.controls()){
        globe.controls().autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;
        globe.controls().autoRotateSpeed=.18;
        globe.controls().enableZoom=true;
      }
      globe.pointOfView({lat:22,lng:12,altitude:2.2},0);
    }catch(error){console.warn('Homepage globe render failed',error)}
  }

  function bind(){
    const d=context(),host=$('#platformHome');
    host?.addEventListener('click',event=>{
      const open=event.target.closest('[data-open-home-trip]');
      if(open){d.onOpenTrip(open.dataset.openHomeTrip);return}
      const save=event.target.closest('[data-home-save-trip]');
      if(save){d.tripTools.toggleSaved(d.storage,save.dataset.homeSaveTrip);renderCards();return}
      const compare=event.target.closest('[data-home-compare-trip]');
      if(compare){
        const result=d.tripCompare.toggle(compareSelection,compare.dataset.homeCompareTrip,3);
        if(result.limit)d.toast(d.t('compareLimit'));
        renderCards();return
      }
      if(event.target.closest('[data-home-compare-open]')){
        d.tripCompare.open({catalog:d.catalog,selectedIds:[...compareSelection],profile:d.loadProfile(),ensureDialog:d.ensureDialog,t:d.t,esc:d.esc,local:d.local,facetLabel:d.facetLabel,statusLabel:d.statusLabel,onOpenTrip:d.onOpenTrip});
        return
      }
      if(event.target.closest('[data-home-explore]')){$('#platformHomeExplore')?.scrollIntoView({behavior:'smooth',block:'start'});return}
      if(event.target.closest('[data-home-mytrips]')){d.onMyTrips();return}
      if(event.target.closest('[data-home-traveller]')){d.onTraveller();return}
      if(event.target.closest('[data-home-method]')){$('#platformHomeMethodology')?.scrollIntoView({behavior:'smooth',block:'start'});return}
      if(event.target.closest('[data-home-top]')){host.scrollTo({top:0,behavior:'smooth'});return}
      if(event.target.closest('[data-home-reset]')){
        for(const id of ['homeRouteSearch','homeRouteRegion','homeRouteMode','homeRouteTheme','homeRouteDuration','homeRoutePace','homeRouteSeason','homeRouteParty','homeRouteStart','homeRouteAccessibility']){
          const node=$('#'+id);if(node)node.value='';
        }
        const savedOnly=$('#homeRouteSavedOnly');if(savedOnly)savedOnly.checked=false;
        renderCards();
      }
    });
    for(const id of ['homeRouteSearch','homeRouteRegion','homeRouteMode','homeRouteTheme','homeRouteDuration','homeRoutePace','homeRouteSeason','homeRouteParty','homeRouteStart','homeRouteAccessibility','homeRouteSavedOnly']){
      $('#'+id)?.addEventListener(id==='homeRouteSearch'?'input':'change',renderCards);
    }
  }

  async function open(){
    const d=context(),flagship=(d.catalog.trips||[]).find(item=>item.id===d.catalog.defaultTripId);
    if(!flagship)throw new Error('Flagship trip missing from catalog');
    document.body.classList.add('platform-home');
    document.body.classList.remove('platform-regional-trip','story-mode','story-launching','terrain-view');
    document.documentElement.lang=d.locale();
    document.title='ONE WORLD ROUTE — '+d.t('homeTitle');
    const host=document.createElement('div');
    host.id='platformHome';
    host.className='platform-home-shell';
    host.innerHTML=
      '<header class="platform-home-nav"><button class="platform-home-brand" data-home-top type="button"><span class="brand-orbit"><i></i></span><span><strong>ONE WORLD ROUTE</strong><small>'+d.esc(d.t('homeNavSub'))+'</small></span></button><nav><button data-home-explore type="button">'+d.esc(d.t('routes'))+'</button><button data-home-mytrips type="button">'+d.esc(d.t('myTrips'))+'</button><button data-home-traveller type="button">'+d.esc(d.t('traveller'))+'</button><button data-home-method type="button">'+d.esc(d.t('methodology'))+'</button></nav></header>'+
      '<main>'+
        '<section class="platform-home-hero"><div class="platform-home-hero-copy"><div class="platform-home-kicker">ONE WORLD ROUTE · '+d.esc(d.t('homeEyebrow'))+'</div><h1>'+d.esc(d.t('homeTitle'))+'</h1><p>'+d.esc(d.t('homeLead'))+'</p><div class="platform-home-hero-actions"><button class="primary" data-home-explore type="button">'+d.esc(d.t('exploreJourneys'))+'</button><button type="button" data-open-home-trip="'+d.esc(flagship.id)+'">'+d.esc(d.t('openFlagship'))+'</button></div></div><div class="platform-home-globe-caption"><span>'+d.esc(d.t('homeGlobeLabel'))+'</span><b>'+d.esc(d.t('homeGlobeHint'))+'</b></div></section>'+
        '<section class="platform-home-flagship"><div><div class="platform-home-section-kicker">'+d.esc(d.t('flagshipJourney'))+'</div><h2>'+d.esc(d.local(flagship.title))+'</h2><p>'+d.esc(d.local(flagship.subtitle))+'</p><button type="button" data-open-home-trip="'+d.esc(flagship.id)+'">'+d.esc(d.t('openFlagship'))+' →</button></div><div class="platform-home-flagship-metrics"><article><b>'+d.esc(flagship.metrics?.countries??'—')+'</b><span>'+d.esc(d.t('homeStates'))+'</span></article><article><b>'+d.esc(flagship.metrics?.internationalLegs??'—')+'</b><span>'+d.esc(d.t('homeLegs'))+'</span></article><article><b>'+d.esc(flagship.metrics?.days??'—')+'</b><span>'+d.esc(d.t('homePlannedDays'))+'</span></article><article><b>'+d.esc(formatDate(flagship.metrics?.startDate))+'</b><span>'+d.esc(d.t('homeStart'))+'</span></article><article><b>'+d.esc(formatBudget(flagship.metrics?.budget))+'</b><span>'+d.esc(d.t('homeBaseModel'))+'</span></article></div></section>'+
        '<section class="platform-home-explore" id="platformHomeExplore"><div class="platform-home-section-head"><div><div class="platform-home-section-kicker">'+d.esc(d.t('journeyDiscovery'))+'</div><h2>'+d.esc(d.t('exploreJourneys'))+'</h2><p>'+d.esc(d.t('journeyDiscoveryLead'))+'</p></div><div class="platform-home-resultbar"><span id="platformHomeCount"></span><button id="platformHomeCompare" data-home-compare-open type="button" disabled>'+d.esc(d.t('compareSelected').replace('{count}','0'))+'</button><button data-home-reset type="button">'+d.esc(d.t('resetFilters'))+'</button></div></div>'+filtersMarkup()+'<div class="platform-home-grid" id="platformHomeResults"></div></section>'+
        '<section class="platform-home-method" id="platformHomeMethodology"><div class="platform-home-section-kicker">'+d.esc(d.t('methodology'))+'</div><h2>'+d.esc(d.t('homeMethodTitle'))+'</h2><p>'+d.esc(d.t('homeMethodText'))+'</p><div><article><b>'+d.esc(d.t('homeSourceRuleTitle'))+'</b><span>'+d.esc(d.t('homeSourceRule'))+'</span></article><article><b>'+d.esc(d.t('homeUnknownRuleTitle'))+'</b><span>'+d.esc(d.t('homeUnknownRule'))+'</span></article><article><b>'+d.esc(d.t('homeDeepLinkRuleTitle'))+'</b><span>'+d.esc(d.t('homeDeepLinkRule'))+'</span></article></div></section>'+
      '</main><footer class="platform-home-footer"><strong>ONE WORLD ROUTE</strong><span>'+d.esc(d.t('homeFooter'))+'</span></footer>';
    document.querySelector('#app')?.appendChild(host);
    bind();
    window.addEventListener('one-world-route:trip-tools-changed',renderCards);
    renderCards();
    await renderGlobe();
  }

  const api={configure,open,renderCards,renderGlobe};
  root.home=api;
})();