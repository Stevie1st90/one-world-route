(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;
  const compareSelection=new Set();
  let collections=[];
  let tripIndex=[];
  let activeCollection=null;
  const PAGE_SIZE=24;
  const PRIMARY_REGIONS=['europe','asia','africa','north-america','south-america','oceania'];
  let resultLimit=PAGE_SIZE;
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

  const visualTheme=trip=>{
    const fallback={world:'ocean','round-trip':'aegean','road-trip':'desert',rail:'rockies',cruise:'ocean',camper:'fern','island-hopping':'aegean',multimodal:'andes'}[trip?.kind]||'ocean';
    return String(trip?.visual?.theme||fallback).replace(/[^a-z0-9-]/gi,'');
  };
  const primaryRegion=trip=>trip.discovery?.regions?.find(region=>!['global','europe','asia','africa','north-america','south-america','oceania'].includes(region))||trip.discovery?.regions?.[0]||trip.kind;

  const durationLabel=value=>({
    '7-14':'7–14',
    '15-30':'15–30',
    '31-89':'31–89',
    '90-plus':'90+'
  }[value]||value);

  function recommendationReasonMarkup(trip){
    const d=context();
    if(!d.profileConfigured?.())return '';
    const reasons=d.travellerFit?.recommendationReasons?.(trip,d.loadProfile())||[];
    if(!reasons.length)return '';
    const label=reason=>{
      if(reason.kind==='duration')return d.t('filterDuration')+' · '+durationLabel(reason.value)+' '+d.t('days');
      if(reason.kind==='pace')return d.t('fitPace')+' · '+d.facetLabel(reason.value);
      if(reason.kind==='season')return d.t('fitSeason')+' · '+d.facetLabel(reason.value);
      if(reason.kind==='theme')return d.t('filterTheme')+' · '+d.facetLabel(reason.value);
      if(reason.kind==='origin')return d.t('fitStart')+' · '+d.facetLabel(reason.value);
      if(reason.kind==='party')return d.t('fitParty')+' · '+d.facetLabel(reason.value);
      return d.t('transportModes')+' · '+d.facetLabel(reason.value);
    };
    const summary=d.travellerFit?.recommendationSummary?.(trip,d.loadProfile())||null;
    const summaryText=summary&&summary.configured
      ?d.t('fitMatches').replace('{matched}',String(summary.preferenceMatches)).replace('{total}',String(summary.configured)).replace('{checks}',String(summary.checks.length))
      :'';
    return '<div class="platform-home-card-fit">'+reasons.map(reason=>'<span data-recommendation-kind="'+d.esc(reason.kind)+'">'+d.esc(label(reason))+'</span>').join('')+(summaryText?'<small>'+d.esc(summaryText)+'</small>':'')+'</div>';
  }

  function visualMarkup(trip){
    const d=context(),theme=visualTheme(trip);
    return '<div class="platform-home-card-visual visual-'+d.esc(theme)+'"><div class="platform-home-card-visual-top"><span>'+d.esc(d.facetLabel(primaryRegion(trip)))+'</span><b>'+d.esc(d.facetLabel(trip.kind))+'</b></div><div class="platform-home-card-route-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="platform-home-card-visual-bottom"><strong>'+d.esc(String(trip.metrics?.days||'—'))+'</strong><span>'+d.esc(d.t('days'))+'</span></div></div>';
  }

  function card(trip,{featured=false}={}){
    const d=context(),saved=d.tripTools?.isSaved(d.storage,trip.id)===true,compared=compareSelection.has(trip.id);
    return '<article class="platform-home-card'+(featured?' platform-home-card-featured':'')+'" data-home-trip="'+d.esc(trip.id)+'">'+
      visualMarkup(trip)+
      '<div class="platform-home-card-body">'+
        '<div class="platform-home-card-top"><span>'+d.esc(d.facetLabel(trip.kind))+'</span><b>'+(saved?'★ '+d.esc(d.t('saved'))+' · ':'')+d.esc(d.statusLabel(trip))+'</b></div>'+
        '<h3>'+d.esc(d.local(trip.title))+'</h3>'+
        '<p>'+d.esc(d.local(trip.subtitle))+'</p>'+
        '<div class="platform-home-card-metrics">'+metricChips(trip).map(v=>'<span>'+d.esc(v)+'</span>').join('')+'</div>'+recommendationReasonMarkup(trip)+
        '<div class="platform-home-card-actions">'+
          '<button type="button" class="'+(saved?'active':'')+'" data-home-save-trip="'+d.esc(trip.id)+'">'+d.esc(saved?d.t('removeSaved'):d.t('saveTrip'))+'</button>'+
          '<button type="button" class="'+(compared?'active':'')+'" data-home-compare-trip="'+d.esc(trip.id)+'">'+d.esc(d.t('compare'))+'</button>'+
          '<button type="button" class="primary" data-open-home-trip="'+d.esc(trip.id)+'">'+d.esc(d.t('open'))+' →</button>'+
        '</div>'+
      '</div>'+
    '</article>';
  }

  function quickExploreMarkup(){
    const d=context();
    const items=[
      ['mode','rail','Rail journeys'],
      ['theme','road-trip','Road trips'],
      ['theme','islands','Island escapes'],
      ['theme','nature','Nature'],
      ['theme','culture','Culture']
    ];
    return '<div class="platform-home-quick">'+items.map(([type,value,fallback])=>'<button type="button" data-home-quick-type="'+d.esc(type)+'" data-home-quick-value="'+d.esc(value)+'">'+d.esc(d.facetLabel(value)||fallback)+'</button>').join('')+'</div>';
  }

  function platformProofMarkup(){
    const d=context(),trips=(d.catalog.trips||[]).filter(trip=>trip.id!==d.catalog.defaultTripId),facets=d.Discovery.facets({trips});
    const regions=PRIMARY_REGIONS.filter(region=>trips.some(trip=>(trip.discovery?.regions||[]).includes(region))).length;
    const kinds=facets.kinds.length;
    return '<div class="platform-home-proof">'+
      '<span><b>'+d.esc(String(trips.length))+'</b><small>'+d.esc(d.t('curatedJourneys'))+'</small></span>'+
      '<span><b>'+d.esc(String(regions))+'</b><small>'+d.esc(d.t('worldRegions'))+'</small></span>'+
      '<span><b>'+d.esc(String(kinds))+'</b><small>'+d.esc(d.t('journeyTypes'))+'</small></span>'+
      '<span><b>100%</b><small>'+d.esc(d.t('localPlanning'))+'</small></span>'+
    '</div>';
  }

  function finderMarkup(){
    const d=context(),facets=d.Discovery.facets(d.catalog);
    const kinds=facets.kinds.filter(value=>value!=='world');
    const regions=PRIMARY_REGIONS.filter(region=>(d.catalog.trips||[]).some(trip=>trip.id!==d.catalog.defaultTripId&&(trip.discovery?.regions||[]).includes(region)));
    const finderSelect=(id,label,values,emptyLabel=d.t('all'))=>'<label><span>'+d.esc(label)+'</span><select id="'+id+'"><option value="">'+d.esc(emptyLabel)+'</option>'+values.map(v=>option(v,d.facetLabel(v))).join('')+'</select></label>';
    return '<section class="platform-home-finder" id="platformHomeFinder"><div class="platform-home-finder-copy"><div class="platform-home-section-kicker">'+d.esc(d.t('findJourneyEyebrow'))+'</div><h2>'+d.esc(d.t('findJourneyTitle'))+'</h2><p>'+d.esc(d.t('findJourneyLead'))+'</p></div>'+
      '<div class="platform-home-finder-grid">'+
        finderSelect('homeFinderRegion',d.t('whereTravel'),regions,d.t('anywhere'))+
        finderSelect('homeFinderKind',d.t('howTravel'),kinds,d.t('anyStyle'))+
        '<label><span>'+d.esc(d.t('howLong'))+'</span><select id="homeFinderDuration"><option value="">'+d.esc(d.t('anyDuration'))+'</option><option value="7-14">7–14 '+d.esc(d.t('days'))+'</option><option value="15-30">15–30 '+d.esc(d.t('days'))+'</option><option value="31-89">31–89 '+d.esc(d.t('days'))+'</option><option value="90-plus">90+ '+d.esc(d.t('days'))+'</option></select></label>'+
        finderSelect('homeFinderPace',d.t('howFast'),facets.paces)+
        finderSelect('homeFinderTheme',d.t('whatTheme'),facets.themes)+
        finderSelect('homeFinderParty',d.t('whoTravels'),facets.parties)+
        '<button class="primary" type="button" data-home-finder-apply>'+d.esc(d.t('showJourneys'))+' →</button>'+
      '</div>'+
      '<div class="platform-home-finder-personal"><span>'+d.esc(d.profileConfigured?.()?d.t('recommendationsActive'):d.t('personalizeLead'))+'</span><button type="button" data-home-traveller>'+d.esc(d.profileConfigured?.()?d.t('tunePreferences'):d.t('personalizeRecommendations'))+'</button></div>'+
    '</section>';
  }

  function regionCollectionsMarkup(){
    const d=context();
    const regions=[
      ['europe','ocean'],
      ['asia','sakura'],
      ['africa','desert'],
      ['north-america','rockies'],
      ['south-america','glacier'],
      ['oceania','fern']
    ];
    return '<div class="platform-home-region-grid">'+regions.map(([region,theme])=>{
      const count=(d.catalog.trips||[]).filter(trip=>(trip.discovery?.regions||[]).includes(region)).length;
      return '<button type="button" class="platform-home-region-card visual-'+d.esc(theme)+'" data-home-quick-type="region" data-home-quick-value="'+d.esc(region)+'"><span>'+d.esc(String(count))+' '+d.esc(d.pluralLabel(count,'resultOne','results'))+'</span><strong>'+d.esc(d.facetLabel(region))+'</strong><i aria-hidden="true">↗</i></button>';
    }).join('')+'</div>';
  }

  function renderFeatured(){
    const d=context(),host=$('#platformHomeFeatured');
    if(!host)return;
    const candidates=(d.catalog.trips||[]).filter(trip=>trip.id!==d.catalog.defaultTripId);
    const trips=(d.profileConfigured?.()
      ?d.travellerFit.orderRecommendations(candidates,d.loadProfile()).map(result=>result.trip)
      :[...candidates].sort((a,b)=>Number(b.visual?.featurePriority||0)-Number(a.visual?.featurePriority||0))
    ).slice(0,6);
    host.innerHTML=trips.map(trip=>card(trip,{featured:true})).join('');
  }

  function collectionMatches(trip,definition){
    const filters=definition?.filters||{};
    if(filters.mode&&!(trip.discovery?.modes||[]).includes(filters.mode))return false;
    if(filters.theme&&!(trip.discovery?.themes||[]).includes(filters.theme))return false;
    if(filters.region&&!(trip.discovery?.regions||[]).includes(filters.region))return false;
    if(filters.duration&&trip.discovery?.durationBand!==filters.duration)return false;
    if(filters.themeAny?.length&&!filters.themeAny.some(value=>(trip.discovery?.themes||[]).includes(value)))return false;
    return true;
  }

  function collectionsMarkup(){
    const d=context();
    if(!collections.length)return '';
    return '<section class="platform-home-collections"><div class="platform-home-section-head"><div><div class="platform-home-section-kicker">'+d.esc(d.t('journeyDiscovery'))+'</div><h2>'+d.esc(d.t('curatedCollections'))+'</h2><p>'+d.esc(d.t('collectionsLead'))+'</p></div></div><div class="platform-home-collection-grid">'+collections.map(item=>{
      const count=(d.catalog.trips||[]).filter(trip=>trip.id!==d.catalog.defaultTripId&&collectionMatches(trip,item)).length;
      return '<button type="button" class="platform-home-collection visual-'+d.esc(String(item.theme||'ocean'))+'" data-home-collection="'+d.esc(item.id)+'"><span>'+count+' '+d.esc(d.pluralLabel(count,'resultOne','results'))+'</span><strong>'+d.esc(d.local(item.title))+'</strong><small>'+d.esc(d.local(item.description))+'</small></button>';
    }).join('')+'</div></section>';
  }

  function filtersMarkup(){
    const d=context();
    const facets=d.Discovery.facets(d.catalog);
    const select=(id,label,values,extra='')=>'<label class="'+extra+'"><span>'+d.esc(label)+'</span><select id="'+id+'"><option value="">'+d.esc(d.t('all'))+'</option>'+values.map(v=>option(v,d.facetLabel(v))).join('')+'</select></label>';
    return '<div class="platform-home-filter-grid" data-home-filter-grid>'+
      '<label class="platform-home-search"><span>'+d.esc(d.t('searchRoutes'))+'</span><input id="homeRouteSearch" type="search" autocomplete="off" placeholder="'+d.esc(d.t('searchRoutes'))+'"></label>'+
      select('homeRouteKind',d.t('filterType'),facets.kinds.filter(value=>value!=='world'),'platform-home-filter-core')+
      select('homeRouteRegion',d.t('filterRegion'),facets.regions,'platform-home-filter-core')+
      '<label class="platform-home-filter-core"><span>'+d.esc(d.t('filterDuration'))+'</span><select id="homeRouteDuration"><option value="">'+d.esc(d.t('all'))+'</option><option value="7-14">7–14 '+d.esc(d.t('days'))+'</option><option value="15-30">15–30 '+d.esc(d.t('days'))+'</option><option value="31-89">31–89 '+d.esc(d.t('days'))+'</option><option value="90-plus">90+ '+d.esc(d.t('days'))+'</option></select></label>'+
      '<button class="platform-home-filter-more" type="button" data-home-filter-more aria-expanded="false">'+d.esc(d.t('moreFilters'))+' <span>+</span></button>'+
      '<div class="platform-home-filter-advanced" data-home-filter-advanced>'+
        '<label class="platform-home-saved-filter"><span>'+d.esc(d.t('savedOnly'))+'</span><input id="homeRouteSavedOnly" type="checkbox"></label>'+
        select('homeRouteMode',d.t('filterMode'),facets.modes)+
        select('homeRouteTheme',d.t('filterTheme'),facets.themes)+
        select('homeRoutePace',d.t('fitPace'),facets.paces)+
        select('homeRouteSeason',d.t('fitSeason'),facets.seasons)+
        select('homeRouteParty',d.t('fitParty'),facets.parties)+
        select('homeRouteStart',d.t('fitStart'),facets.starts)+
        select('homeRouteAccessibility',d.t('filterAccessibility'),facets.accessibilities)+
      '</div>'+
    '</div>';
  }

  function renderCollectionContext(){
    const d=context(),host=$('#platformHomeCollectionContext');
    if(!host)return;
    const item=activeCollection?collections.find(value=>value.id===activeCollection):null;
    host.innerHTML=item?'<div><span>'+d.esc(d.t('curatedCollections'))+'</span><b>'+d.esc(d.local(item.title))+'</b><small>'+d.esc(d.local(item.description))+'</small></div><button type="button" data-home-reset>'+d.esc(d.t('resetFilters'))+'</button>':'';
    host.hidden=!item;
  }

  function renderCards({preserveLimit=true}={}){
    const d=context(),host=$('#platformHomeResults');
    if(!preserveLimit)resultLimit=PAGE_SIZE;
    if(!host)return;
    const filters={
      q:String($('#homeRouteSearch')?.value||'').trim().toLowerCase(),
      kind:$('#homeRouteKind')?.value||'',
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
    if(activeCollection){
      const definition=collections.find(item=>item.id===activeCollection);
      if(definition)found=found.filter(trip=>collectionMatches(trip,definition));
    }
    if($('#homeRouteSavedOnly')?.checked)found=found.filter(trip=>d.tripTools.isSaved(d.storage,trip.id));
    const sort=$('#homeRouteSort')?.value||(d.profileConfigured?.()?'recommended':'featured');
    if(sort==='recommended'&&d.profileConfigured?.())found=d.travellerFit.orderRecommendations(found,d.loadProfile()).map(result=>result.trip);
    else if(sort==='shortest')found=[...found].sort((a,b)=>Number(a.metrics?.days||9999)-Number(b.metrics?.days||9999)||d.local(a.title).localeCompare(d.local(b.title)));
    else if(sort==='longest')found=[...found].sort((a,b)=>Number(b.metrics?.days||0)-Number(a.metrics?.days||0)||d.local(a.title).localeCompare(d.local(b.title)));
    else if(sort==='alphabetical')found=[...found].sort((a,b)=>d.local(a.title).localeCompare(d.local(b.title)));
    else found=[...found].sort((a,b)=>Number(b.visual?.featurePriority||0)-Number(a.visual?.featurePriority||0)||d.local(a.title).localeCompare(d.local(b.title)));
    const visible=found.slice(0,resultLimit);
    renderCollectionContext();
    host.innerHTML=found.length?visible.map(card).join(''):'<div class="platform-home-empty">'+d.esc(d.t('noRoutes'))+'</div>';
    const more=$('#platformHomeMore');
    if(more){
      more.hidden=visible.length>=found.length;
      more.textContent=d.t('loadMoreJourneys').replace('{count}',String(Math.min(PAGE_SIZE,Math.max(0,found.length-visible.length))));
    }
    const count=$('#platformHomeCount');
    if(count)count.textContent=d.t('showingJourneys').replace('{shown}',String(visible.length)).replace('{total}',String(found.length));
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
    const flagship=metas.find(meta=>meta.renderer==='legacy-world');
    if(flagship){
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
    const arcs=[],points=[];
    const metaMap=new Map(metas.map(meta=>[meta.id,meta]));
    for(const entry of tripIndex){
      const meta=metaMap.get(entry.id);
      if(!meta||meta.renderer!=='regional-globe'||!entry.preview)continue;
      for(const arc of entry.preview.arcs||[]){
        arcs.push({
          ...arc,
          tripId:meta.id,
          tripTitle:d.local(meta.title),
          featured:meta.discovery?.featured===true,
          fromName:d.local(arc.fromName),
          toName:d.local(arc.toName),
          previewRole:'regional'
        });
      }
      for(const point of entry.preview.points||[]){
        points.push({
          id:point.id,
          tripId:meta.id,
          tripTitle:d.local(meta.title),
          displayName:d.local(point.name),
          coordinates:{lat:Number(point.lat),lng:Number(point.lng)},
          previewRole:'regional'
        });
      }
    }
    if(flagship){
      try{
        const response=await fetch(flagship.dataset,{cache:'force-cache'});
        if(response.ok){
          const trip=await response.json(),tripTitle=d.local(flagship.title);
          for(const segment of trip.segments||[]){
            const from=centroidMap.get(segment.from),to=centroidMap.get(segment.to);
            if(!from||!to)continue;
            arcs.push({
              ...segment,tripId:flagship.id,tripTitle,featured:true,
              start:{lat:Number(from.lat),lng:Number(from.lng)},
              end:{lat:Number(to.lat),lng:Number(to.lng)},
              fromName:countryName(from),toName:countryName(to),previewRole:'flagship'
            });
          }
          for(const country of centroids){
            if(!Number.isFinite(Number(country.lat))||!Number.isFinite(Number(country.lng)))continue;
            points.push({
              id:'flagship-'+country.cca3,tripId:flagship.id,tripTitle,
              displayName:countryName(country),
              coordinates:{lat:Number(country.lat),lng:Number(country.lng)},
              previewRole:'flagship'
            });
          }
        }
      }catch(error){console.warn('Homepage flagship route preview unavailable',error)}
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
      if(event.target.closest('[data-home-find]')){$('#platformHomeFinder')?.scrollIntoView({behavior:'smooth',block:'center'});return}
      if(event.target.closest('[data-home-finder-apply]')){
        activeCollection=null;
        const pairs=[['homeFinderRegion','homeRouteRegion'],['homeFinderKind','homeRouteKind'],['homeFinderDuration','homeRouteDuration'],['homeFinderPace','homeRoutePace'],['homeFinderTheme','homeRouteTheme'],['homeFinderParty','homeRouteParty']];
        for(const [sourceId,targetId] of pairs){const source=$('#'+sourceId),target=$('#'+targetId);if(source&&target)target.value=source.value}
        $('#platformHomeExplore')?.scrollIntoView({behavior:'smooth',block:'start'});
        renderCards({preserveLimit:false});
        return
      }
      const filterMore=event.target.closest('[data-home-filter-more]');
      if(filterMore){
        const grid=$('[data-home-filter-grid]'),expanded=grid?.classList.toggle('filters-expanded')===true;
        filterMore.setAttribute('aria-expanded',String(expanded));
        filterMore.innerHTML=d.esc(expanded?d.t('fewerFilters'):d.t('moreFilters'))+' <span>'+(expanded?'−':'+')+'</span>';
        return
      }
      if(event.target.closest('[data-home-mytrips]')){d.onMyTrips();return}
      if(event.target.closest('[data-home-traveller]')){d.onTraveller();return}
      if(event.target.closest('[data-home-method]')){$('#platformHomeMethodology')?.scrollIntoView({behavior:'smooth',block:'start'});return}
      if(event.target.closest('[data-home-top]')){host.scrollTo({top:0,behavior:'smooth'});return}
      const loadMore=event.target.closest('[data-home-load-more]');
      if(loadMore){
        resultLimit+=PAGE_SIZE;
        renderCards({preserveLimit:true});
        return;
      }
      const collection=event.target.closest('[data-home-collection]');
      if(collection){
        activeCollection=collection.dataset.homeCollection||null;
        $('#platformHomeExplore')?.scrollIntoView({behavior:'smooth',block:'start'});
        renderCards({preserveLimit:false});
        return;
      }
            const quick=event.target.closest('[data-home-quick-type]');
      if(quick){
        const targetId={region:'homeRouteRegion',mode:'homeRouteMode',theme:'homeRouteTheme',kind:'homeRouteKind'}[quick.dataset.homeQuickType];
        const node=targetId?$('#'+targetId):null;
        if(node&&[...node.options].some(option=>option.value===quick.dataset.homeQuickValue))node.value=quick.dataset.homeQuickValue;
        $('#platformHomeExplore')?.scrollIntoView({behavior:'smooth',block:'start'});
        renderCards({preserveLimit:false});
        return;
      }
      if(event.target.closest('[data-home-reset]')){
        activeCollection=null;
        for(const id of ['homeRouteSearch','homeRouteKind','homeRouteRegion','homeRouteMode','homeRouteTheme','homeRouteDuration','homeRoutePace','homeRouteSeason','homeRouteParty','homeRouteStart','homeRouteAccessibility']){
          const node=$('#'+id);if(node)node.value='';
        }
        const savedOnly=$('#homeRouteSavedOnly');if(savedOnly)savedOnly.checked=false;
        renderCards({preserveLimit:false});
      }
    });
    for(const id of ['homeRouteSearch','homeRouteKind','homeRouteRegion','homeRouteMode','homeRouteTheme','homeRouteDuration','homeRoutePace','homeRouteSeason','homeRouteParty','homeRouteStart','homeRouteAccessibility','homeRouteSavedOnly','homeRouteSort']){
      $('#'+id)?.addEventListener(id==='homeRouteSearch'?'input':'change',()=>renderCards({preserveLimit:false}));
    }
  }

  async function open(){
    const d=context(),flagship=(d.catalog.trips||[]).find(item=>item.id===d.catalog.defaultTripId);
    if(!flagship)throw new Error('Flagship trip missing from catalog');
    try{
      const [collectionResponse,indexResponse]=await Promise.all([
        fetch('./data/platform/collections.json',{cache:'no-cache'}),
        fetch('./data/platform/trip-index.json',{cache:'force-cache'})
      ]);
      collections=collectionResponse.ok?(await collectionResponse.json()).collections||[]:[];
      tripIndex=indexResponse.ok?(await indexResponse.json()).trips||[]:[];
    }catch(error){console.warn('Journey discovery support data unavailable',error);collections=[];tripIndex=[]}
    const requestedCollection=new URLSearchParams(location.search).get('collection');
    activeCollection=collections.some(item=>item.id===requestedCollection)?requestedCollection:null;
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
        '<section class="platform-home-hero"><div class="platform-home-hero-copy"><div class="platform-home-kicker">ONE WORLD ROUTE · '+d.esc(d.t('homeEyebrow'))+'</div><h1>'+d.esc(d.t('homeTitle'))+'</h1><p>'+d.esc(d.t('homeLead'))+'</p><div class="platform-home-hero-actions"><button class="primary" data-home-find type="button">'+d.esc(d.t('findJourneyTitle'))+'</button><button type="button" data-home-traveller>'+d.esc(d.profileConfigured?.()?d.t('tunePreferences'):d.t('personalizeRecommendations'))+'</button></div>'+quickExploreMarkup()+platformProofMarkup()+'</div><div class="platform-home-globe-caption"><span>'+d.esc(d.t('homeGlobeLabel'))+'</span><b>'+d.esc(d.t('homeGlobeHint'))+'</b></div></section>'+
        finderMarkup()+
        '<section class="platform-home-featured"><div class="platform-home-section-head"><div><div class="platform-home-section-kicker">'+d.esc(d.t('journeyDiscovery'))+'</div><h2>'+d.esc(d.profileConfigured?.()?d.t('recommendedForYou'):d.t('featuredJourneys'))+'</h2><p>'+d.esc(d.profileConfigured?.()?d.t('recommendationContextLead'):d.t('featuredLead'))+'</p></div></div><div class="platform-home-featured-grid" id="platformHomeFeatured"></div></section>'+
        collectionsMarkup()+
        '<section class="platform-home-regions"><div class="platform-home-section-head"><div><div class="platform-home-section-kicker">'+d.esc(d.t('filterRegion'))+'</div><h2>'+d.esc(d.t('exploreByRegion'))+'</h2></div></div>'+regionCollectionsMarkup()+'</section>'+
        '<section class="platform-home-flagship"><div><div class="platform-home-section-kicker">'+d.esc(d.t('flagshipJourney'))+'</div><h2>'+d.esc(d.local(flagship.title))+'</h2><p>'+d.esc(d.local(flagship.subtitle))+'</p><button type="button" data-open-home-trip="'+d.esc(flagship.id)+'">'+d.esc(d.t('openFlagship'))+' →</button></div><div class="platform-home-flagship-metrics"><article><b>'+d.esc(flagship.metrics?.countries??'—')+'</b><span>'+d.esc(d.t('homeStates'))+'</span></article><article><b>'+d.esc(flagship.metrics?.internationalLegs??'—')+'</b><span>'+d.esc(d.t('homeLegs'))+'</span></article><article><b>'+d.esc(flagship.metrics?.days??'—')+'</b><span>'+d.esc(d.t('homePlannedDays'))+'</span></article><article><b>'+d.esc(formatDate(flagship.metrics?.startDate))+'</b><span>'+d.esc(d.t('homeStart'))+'</span></article><article><b>'+d.esc(formatBudget(flagship.metrics?.budget))+'</b><span>'+d.esc(d.t('homeBaseModel'))+'</span></article></div></section>'+
        '<section class="platform-home-explore" id="platformHomeExplore"><div class="platform-home-section-head"><div><div class="platform-home-section-kicker">'+d.esc(d.t('journeyDiscovery'))+'</div><h2>'+d.esc(d.t('allJourneys'))+'</h2><p>'+d.esc(d.t('journeyDiscoveryLead'))+'</p></div><div class="platform-home-resultbar"><span id="platformHomeCount"></span><label class="platform-home-sort"><span>'+d.esc(d.t('sortBy'))+'</span><select id="homeRouteSort"><option value="recommended" '+(d.profileConfigured?.()?'selected':'')+'>'+d.esc(d.t('sortRecommended'))+'</option><option value="featured" '+(d.profileConfigured?.()?'':'selected')+'>'+d.esc(d.t('sortFeatured'))+'</option><option value="shortest">'+d.esc(d.t('sortShortest'))+'</option><option value="longest">'+d.esc(d.t('sortLongest'))+'</option><option value="alphabetical">'+d.esc(d.t('sortAlphabetical'))+'</option></select></label><button id="platformHomeCompare" data-home-compare-open type="button" disabled>'+d.esc(d.t('compareSelected').replace('{count}','0'))+'</button><button data-home-reset type="button">'+d.esc(d.t('resetFilters'))+'</button></div></div>'+'<div id="platformHomeCollectionContext" class="platform-home-collection-context" hidden></div>'+filtersMarkup()+'<div class="platform-home-grid" id="platformHomeResults"></div><button class="platform-home-more" id="platformHomeMore" data-home-load-more type="button" hidden>'+d.esc(d.t('loadMoreJourneys').replace('{count}',String(PAGE_SIZE)))+'</button></section>'+
        '<section class="platform-home-method" id="platformHomeMethodology"><div class="platform-home-section-kicker">'+d.esc(d.t('methodology'))+'</div><h2>'+d.esc(d.t('inspirationMethodTitle'))+'</h2><p>'+d.esc(d.t('inspirationMethodText'))+'</p><div><article><b>'+d.esc(d.t('homeSourceRuleTitle'))+'</b><span>'+d.esc(d.t('homeSourceRule'))+'</span></article><article><b>'+d.esc(d.t('homeUnknownRuleTitle'))+'</b><span>'+d.esc(d.t('homeUnknownRule'))+'</span></article><article><b>'+d.esc(d.t('globalDesignTitle'))+'</b><span>'+d.esc(d.t('globalDesignText'))+'</span></article></div></section>'+
      '</main><footer class="platform-home-footer"><strong>ONE WORLD ROUTE</strong><span>'+d.esc(d.t('homeFooter'))+'</span></footer>';
    document.querySelector('#app')?.appendChild(host);
    bind();
    window.addEventListener('one-world-route:trip-tools-changed',renderCards);
    renderFeatured();
    renderCards();
    if(activeCollection)requestAnimationFrame(()=>$('#platformHomeExplore')?.scrollIntoView({block:'start'}));
    await renderGlobe();
  }

  const api={configure,open,renderCards,renderFeatured,renderGlobe};
  root.home=api;
})();