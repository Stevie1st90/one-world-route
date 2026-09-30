(() => {
  'use strict';

  const CATALOG_URL = './data/platform/trips.json';
  const COUNTRY_CENTROIDS_URL = './data/country-centroids.json';
  const PROFILE_KEY = 'one-world-route:traveller-context:v1';
  const PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const LocaleData=PLATFORM_MODULES.i18n;
  const Formatters=PLATFORM_MODULES.formatters;
  const Model=PLATFORM_MODULES.model;
  const Traveller=PLATFORM_MODULES.traveller;
  const TravellerUi=PLATFORM_MODULES.travellerUi;
  const Discovery=PLATFORM_MODULES.discovery;
  const TripTools=PLATFORM_MODULES.tripTools;
  const JourneyAdapter=PLATFORM_MODULES.journeyAdapter;
  const JourneyVariants=PLATFORM_MODULES.journeyVariants;
  const SharedKnowledge=PLATFORM_MODULES.sharedKnowledge;
  const TravellerFit=PLATFORM_MODULES.travellerFit;
  const TripCompare=PLATFORM_MODULES.tripCompare;
  const JourneyGuide=PLATFORM_MODULES.journeyGuide;
  const PlaceExperiences=PLATFORM_MODULES.placeExperiences;
  const MyTrips=PLATFORM_MODULES.myTrips;
  const Share=PLATFORM_MODULES.share||{configure:()=>({bind:()=>false}),bind:()=>false};
  const Partners=PLATFORM_MODULES.partners||{load:async()=>({enabled:false}),render:()=>''};
  const CloudSync=PLATFORM_MODULES.cloudSync||{init:async()=>({available:false}),status:()=>({available:false,signedIn:false}),subscribe:()=>()=>{},requestCode:async()=>({ok:false,reason:'unavailable'}),verifyCode:async()=>({ok:false,reason:'unavailable'}),signOut:async()=>({ok:true}),sync:async()=>({ok:false,reason:'unavailable'})};
  const PwaInstall=PLATFORM_MODULES.pwaInstall||{status:()=>({available:false,installed:false}),prompt:async()=>({ok:false,outcome:'unavailable'}),subscribe:()=>()=>{}};
  const ServiceWorker=PLATFORM_MODULES.serviceWorker;
  const TripPlanning=PLATFORM_MODULES.tripPlanning;
  const Extensions=PLATFORM_MODULES.extensions;
  const Home=PLATFORM_MODULES.home;
  const RouteLibrary=PLATFORM_MODULES.routeLibrary;
  const RegionalShell=PLATFORM_MODULES.regionalShell;
  const RegionalDetail=PLATFORM_MODULES.regionalDetail;
  const RegionalGlobe=PLATFORM_MODULES.regionalGlobe;
  const RegionalTimeline=PLATFORM_MODULES.regionalTimeline;
  const RegionalControls=PLATFORM_MODULES.regionalControls;
  const RegionalSelection=PLATFORM_MODULES.regionalSelection;
  const Story=PLATFORM_MODULES.story;
  const Terrain=PLATFORM_MODULES.terrain;
  const Ui=PLATFORM_MODULES.ui;
  const Navigation=PLATFORM_MODULES.navigation;
  const LegacyLocalization=PLATFORM_MODULES.legacyLocalization;
  if(!LocaleData||!Formatters||!Model||!Traveller||!TravellerUi||!Discovery||!TripTools||!JourneyAdapter||!JourneyVariants||!SharedKnowledge||!TravellerFit||!TripCompare||!JourneyGuide||!PlaceExperiences||!MyTrips||!TripPlanning||!Extensions||!Home||!RouteLibrary||!RegionalShell||!RegionalDetail||!RegionalGlobe||!RegionalTimeline||!RegionalControls||!RegionalSelection||!Story||!Terrain||!Ui||!Navigation||!LegacyLocalization)throw new Error('ONE WORLD ROUTE platform modules unavailable');
  const HOME_REQUEST=location.pathname==='/'&&!new URLSearchParams(location.search).has('trip');
  if(HOME_REQUEST){
    window.ONE_WORLD_ROUTE_OWNERSHIP='home';
    document.body?.classList?.add?.('platform-home');
  }
  const SUPPORTED_LOCALES=LocaleData.supportedLocales;
  const I18N=LocaleData.messages;
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const initialLocale = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    const b = String(q || navigator.language || 'en').toLowerCase().split('-')[0];
    return SUPPORTED_LOCALES.includes(b) ? b : 'en';
  })();
  let locale = initialLocale;
  const t = key => I18N[locale]?.[key] || I18N.en[key] || key;
  const local = value => {
    let current=value;
    const seen=new Set();
    while(current!==null&&current!==undefined&&typeof current==='object'){
      if(seen.has(current))return '';
      seen.add(current);
      if(Array.isArray(current)){
        current=current.find(item=>item!==null&&item!==undefined&&item!=='')??'';
        continue;
      }
      current=current?.[locale]??current?.en??Object.values(current)[0]??'';
    }
    return current===null||current===undefined?'':String(current);
  };
  const facetLabel = value => {
    const key='facet_'+String(value||'').replaceAll('-','_');
    const translated=t(key);
    if(translated!==key)return translated;
    return String(value||'').replaceAll('-',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
  };
  const countryDisplay = code => LocaleData.regionName(locale,code);
  const pluralLabel = (count,oneKey,otherKey) => LocaleData.plural(locale,count,{one:t(oneKey),other:t(otherKey)});
  const statusLabel = trip => {
    if(trip.id===catalog?.defaultTripId)return t('flagship');
    const key='status_'+String(trip.status||'draft').replaceAll('-','_');
    const translated=t(key);
    return translated===key?facetLabel(trip.status||'draft'):translated;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sourceMap = () => Model.sourceMap(currentTrip);
  const verificationLabel = s => s?.verification?.status==='verified'?t('verified'):(s?.verification?.status==='illustrative'?t('illustrative'):t('currentCheck'));
  const sourceLinks = ids => {
    const map=sourceMap(),seen=new Set();
    return (ids||[]).filter(id=>!seen.has(id)&&seen.add(id)).map(id=>map.get(id)).filter(Boolean).map(src=>`<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(src.issuer||src.title)}</b><span>${esc(src.title)}</span><small>${esc(t('lastChecked'))}: ${esc(src.checkedAt||'—')}</small></a>`).join('');
  };

  let catalog = null;
  let currentTrip = null;
  let currentTripMeta = null;
  let countryCentroidsPromise = null;

  function loadProfile(){return Traveller.load(localStorage,PROFILE_KEY,locale)}
  function loadCountryCentroids(){
    if(!countryCentroidsPromise){
      countryCentroidsPromise=fetch(COUNTRY_CENTROIDS_URL,{cache:'force-cache'})
        .then(r=>{if(!r.ok)throw new Error('Country centroids '+r.status);return r.json()})
        .catch(error=>{console.warn('Country centroids unavailable for entry suggestions',error);return []});
    }
    return countryCentroidsPromise;
  }
  function saveProfile(profile){return Traveller.save(localStorage,PROFILE_KEY,profile,locale)}
  function clearProfile(){return Traveller.clear(localStorage,PROFILE_KEY,locale)}

  async function waitForCore(max=70){
    for(let i=0;i<max;i++){
      if(window.__ONE_WORLD_ROUTE_APP__) return true;
      await sleep(80);
    }
    return false;
  }

  function buildTripUrl(id){
    return Navigation.buildTripUrl({
      id,
      defaultTripId:catalog?.defaultTripId||'world-195',
      search:location.search
    });
  }

  function setQueryTrip(id){
    if(!catalog?.trips?.some(t=>t.id===id||t.slug===id))return;
    location.assign(buildTripUrl(id));
  }

  function goHome(){
    const p=new URLSearchParams(location.search);
    for(const key of ['trip','segment','country','phase','view'])p.delete(key);
    location.assign(`/${p.toString()?`?${p.toString()}`:''}`);
  }

  function openMyTrips(){return MyTrips.open()}

  function openRouteLibrary(){
    return RouteLibrary.open({
      catalog,
      currentTripMeta,
      Discovery,
      travellerFit:TravellerFit,
      loadProfile,
      profileConfigured:()=>Boolean(localStorage.getItem(PROFILE_KEY)),
      ensureDialog:Ui.ensureDialog,
      t,
      local,
      esc,
      facetLabel,
      statusLabel,
      pluralLabel,
      onOpenTrip:setQueryTrip,
      onDiscovery:()=>location.assign('/'+(locale?'?lang='+encodeURIComponent(locale):'')+'#platformHomeExplore')
    });
  }

  function openTraveller(){
    return TravellerUi.open({
      locale,
      supportedLocales:SUPPORTED_LOCALES,
      loadProfile,
      ensureDialog:Ui.ensureDialog,
      t,
      esc,
      facetLabel,
      preferenceOptions:Discovery.facets(catalog),
      onClear:()=>{
        clearProfile();
        location.reload();
      },
      onSave:next=>{
        saveProfile(next);
        locale=SUPPORTED_LOCALES.includes(next.language)?next.language:locale;
        const p=new URLSearchParams(location.search);
        p.set('lang',locale);
        location.assign(`${location.pathname}?${p.toString()}`);
      }
    });
  }

  const placeMap=trip=>Model.placeMap(trip);
  const stopMap=trip=>Model.stopMap(trip);
  const stopPlace=(trip,stop)=>Model.stopPlace(trip,stop);

  function syncRegionalUrl(){
    if(!currentTripMeta||currentTripMeta.renderer==='legacy-world')return;
    history.replaceState(null,'',Navigation.regionalUrl({
      tripId:currentTripMeta.id,
      locale,
      search:location.search,
      pathname:location.pathname,
      terrainActive:document.body.classList.contains('terrain-view'),
      variantId:currentTrip?._variant?.id||null
    }));
  }



  function regionalChapterForSegment(index){return Model.chapterForSegment(currentTrip,index)}

  function configureRegionalSelection(){
    RegionalSelection.configure({
      getTrip:()=>currentTrip,
      stopPlace,
      renderGlobe:()=>RegionalGlobe.render(),
      updateTimeline:()=>RegionalTimeline.update(),
      renderSegmentDetail:segment=>RegionalDetail.renderSegmentDetail(segment),
      renderStopDetail:(stop,place)=>RegionalDetail.renderStopDetail(stop,place),
      updateTerrain:()=>Terrain.update(),
      isStoryActive:()=>Story.isActive(),
      updateStory:()=>Story.update(),
      isTerrainActive:()=>document.body.classList.contains('terrain-view'),
      focusTerrainSegment:index=>Terrain.focusSegment(index),
      focusGlobeSegment:segment=>RegionalGlobe.focusSegment(segment),
      focusGlobePlace:place=>RegionalGlobe.focusPlace(place)
    });
  }

  function configureRegionalGlobe(){
    RegionalGlobe.configure({
      getTrip:()=>currentTrip,
      getSelectedIndex:()=>RegionalSelection.getIndex(),
      placeMap,
      stopMap,
      modelRouteGeometry:trip=>Model.routeGeometry(trip),
      local,
      settings:Ui.regionalSettings,
      isStoryActive:()=>Story.isActive(),
      selectSegment:(index,focus)=>RegionalSelection.selectSegment(index,focus),
      selectStop:(index,focus)=>RegionalSelection.selectStop(index,focus)
    });
  }

  function configureRegionalTimeline(){
    RegionalTimeline.configure({
      getTrip:()=>currentTrip,
      getSelectedIndex:()=>RegionalSelection.getIndex(),
      t,
      local,
      esc,
      facetLabel,
      stopMap,
      placeMap,
      stopPlace,
      selectSegment:(index,focus)=>RegionalSelection.selectSegment(index,focus)
    });
  }

  function configureRegionalStory(){
    Story.configure({
      getTrip:()=>currentTrip,
      getTripMeta:()=>currentTripMeta,
      getSelectedIndex:()=>RegionalSelection.getIndex(),
      placeMap,
      stopMap,
      chapterForSegment:regionalChapterForSegment,
      hasCapability:(meta,id)=>Model.hasCapability(meta,id),
      t,
      local,
      esc,
      facetLabel,
      selectSegment:(index,focus)=>RegionalSelection.selectSegment(index,focus),
      setTerrain:active=>Terrain.setActive(active),
      stopRoutePlayback:()=>RegionalTimeline.stopPlayback(),
      renderRoute:()=>RegionalGlobe.render()
    });
  }

  function configureRegionalDetail(){
    RegionalDetail.configure({
      getTrip:()=>currentTrip,
      getTripMeta:()=>currentTripMeta,
      t,
      local,
      esc,
      facetLabel,
      statusLabel,
      pluralLabel,
      countryDisplay,
      selectStop:(index,focus)=>RegionalSelection.selectStop(index,focus),
      durationLabel:planning=>Formatters.durationLabel(planning),
      costLabel:planning=>Formatters.costLabel({locale,planning,defaultCurrency:currentTrip?.planning?.currency||'EUR',publishedFrom:t('publishedFrom')}),
      editorialNote:value=>Formatters.editorialNote(locale,value,local),
      verificationLabel,
      sourceLinks,
      sourceMap,
      loadProfile,
      openTraveller,
      locale:()=>locale,
      tripPlanning:TripPlanning,
      journeyGuide:JourneyGuide,
      placeExperiences:PlaceExperiences,
      tripTools:TripTools,
      journeyAdapter:JourneyAdapter,
      sharedKnowledge:SharedKnowledge,
      partners:Partners,
      travellerFit:TravellerFit,
      storage:localStorage,
      toast:Ui.toast,
      onRouteVariantChange:change=>activateRegionalTrip(currentTripMeta,change||{}).catch(error=>console.warn('Regional route variant refresh failed',error)),
      extensions:Extensions,
      stopMap,
      placeMap
    });
  }

  function configureRegionalControls(){
    RegionalControls.configure({
      getTrip:()=>currentTrip,
      getTripMeta:()=>currentTripMeta,
      t,
      esc,
      hasCapability:(meta,id)=>Model.hasCapability(meta,id),
      onHome:()=>{
        RegionalSelection.reset(0);
        RegionalDetail.renderTripOverview();
        RegionalGlobe.render();
        if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(0);
        else RegionalGlobe.focusRoute();
      },
      onStoryStart:()=>Story.start(),
      onAutoRotateChange:()=>RegionalGlobe.updateAutoRotate(),
      onVisualChange:()=>{
        RegionalGlobe.render();
        Terrain.update();
      }
    });
  }

  function configureRegionalShell(){
    RegionalShell.configure({
      getTrip:()=>currentTrip,
      getTripMeta:()=>currentTripMeta,
      getLocale:()=>locale,
      t,
      local,
      esc,
      facetLabel,
      stopPlace,
      selectStop:(index,focus)=>RegionalSelection.selectStop(index,focus),
      isolateRegionalRuntime:()=>RegionalGlobe.isolate(),
      syncRegionalUrl,
      replaceTimeline:()=>RegionalTimeline.replace(),
      ensureStoryUi:()=>Story.ensureUi(),
      configureRegionalSettings:()=>RegionalControls.apply(),
      renderTripOverview:()=>RegionalDetail.renderTripOverview()
    });
  }

  function configureRegionalTerrain(){
    Terrain.configure({
      locale:()=>locale,
      getTrip:()=>currentTrip,
      getTripMeta:()=>currentTripMeta,
      getSelectedIndex:()=>RegionalSelection.getIndex(),
      hasCapability:(meta,id)=>Model.hasCapability(meta,id),
      routeGeometry:()=>RegionalGlobe.routeGeometry(),
      placeMap,
      local,
      routeBounds:()=>Model.routeBounds(currentTrip),
      routeCamera:()=>RegionalGlobe.routeCamera(),
      settings:Ui.regionalSettings,
      selectSegment:(index,focus)=>RegionalSelection.selectSegment(index,focus),
      renderRoute:()=>RegionalGlobe.render(),
      isStoryActive:()=>Story.isActive(),
      stopStory:()=>Story.stop(),
      setViewParam:active=>{
        const p=new URLSearchParams(location.search);
        if(active)p.set('view','terrain');
        else p.delete('view');
        history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
      },
      t,
      toast:Ui.toast
    });
  }

  async function activateRegionalTrip(meta,change={}){
    currentTripMeta=meta;
    const [baseTrip,countryCentroids]=await Promise.all([
      fetch(meta.dataset,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip dataset '+r.status);return r.json()}),
      loadCountryCentroids()
    ]);
    const profile=loadProfile();
    const urlVariant=new URLSearchParams(location.search).get('variant');
    const requestedVariant=String(change?.variantId||urlVariant||TripTools.getVariant(localStorage,meta.id)||'base');
    if(urlVariant&&!change?.variantId)TripTools.setVariant(localStorage,meta.id,urlVariant);
    const variantTrip=JourneyVariants.apply(await window.ONE_WORLD_PLATFORM_MODULES.media.resolveReference(meta,baseTrip),requestedVariant);
    const storedStart=TripTools.getRouteStart(localStorage,meta.id);
    const entrySuggestion=JourneyAdapter.recommendEntry(variantTrip,profile,countryCentroids);
    const suggestedStart=!storedStart&&entrySuggestion?.available?entrySuggestion.stopId:'';
    currentTrip=JourneyAdapter.apply(variantTrip,{
      startStopId:storedStart||suggestedStart,
      startSource:storedStart?'saved':(suggestedStart?'suggested':'default'),
      entrySuggestion
    });
    await PlaceExperiences.loadForTrip(currentTrip).catch(error=>console.warn('Place experience layer unavailable',error));
    await waitForCore();
    configureRegionalSelection();
    RegionalSelection.reset(0);
    configureRegionalGlobe();
    configureRegionalTimeline();
    configureRegionalTerrain();
    configureRegionalStory();
    configureRegionalDetail();
    configureRegionalControls();
    configureRegionalShell();
    RegionalShell.apply();
    RegionalGlobe.render();
    setTimeout(()=>RegionalGlobe.render(),500);
    if(Model.hasCapability(currentTripMeta,'terrain')&&new URLSearchParams(location.search).get('view')==='terrain')setTimeout(()=>Terrain.setActive(true),650);
  }

  async function init(){
    try{
      catalog=await fetch(CATALOG_URL,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip catalog '+r.status);return r.json()});
      await SharedKnowledge.load();
      await Partners.load().catch(error=>console.warn('Commercial config unavailable',error));
      await CloudSync.init({storage:localStorage,TripTools,catalog}).catch(error=>console.warn('Cloud sync init failed',error));
      const p=new URLSearchParams(location.search);
      const profile=loadProfile();
      const explicitLang=new URLSearchParams(location.search).get('lang');
      if(!SUPPORTED_LOCALES.includes(String(explicitLang||'').toLowerCase())&&profile.language&&SUPPORTED_LOCALES.includes(profile.language))locale=profile.language;
      MyTrips.configure({
        catalog,
        TripTools,
        TripPlanning,
        TravellerFit,
        journeyAdapter:JourneyAdapter,
        journeyVariants:JourneyVariants,
        storage:localStorage,
        loadProfile,
        ensureDialog:Ui.ensureDialog,
        t,
        esc,
        local,
        facetLabel,
        statusLabel,
        locale:()=>locale,
        onOpenTrip:(id,step)=>{const url=buildTripUrl(id);location.assign(url+(step?'&planStep='+encodeURIComponent(step):''))},
        onTraveller:openTraveller,
        serviceWorker:ServiceWorker,
        pwaInstall:PwaInstall,
        cloudSync:CloudSync,
        toast:Ui.toast
      });
      Ui.ensureGlobalActions({t,esc,onHome:goHome,onRoutes:openRouteLibrary,onMyTrips:openMyTrips,onTraveller:openTraveller});
      const socialDeps={t,esc,local,facetLabel,locale:()=>locale,ensureDialog:Ui.ensureDialog,toast:Ui.toast,url:meta=>meta.id===currentTripMeta?.id?location.href:location.origin+buildTripUrl(meta.id),onOpen:setQueryTrip};
      PLATFORM_MODULES.socialStory?.configure(socialDeps);
      const openPlanning=()=>PLATFORM_MODULES.planningContext?.open(currentTripMeta,{...socialDeps,tripTools:TripTools,storage:localStorage});
      Share.configure({...socialDeps,title:()=>currentTripMeta?local(currentTripMeta.title):t('homeTitle'),getMeta:()=>currentTripMeta,getTrip:()=>currentTrip,onPlanning:openPlanning});
      Share.bind();
      if(HOME_REQUEST){
        currentTripMeta=null;
        currentTrip=null;
        await waitForCore();
        Home.configure({
          catalog,
          Discovery,
          Model,
          t,
          local,
          esc,
          facetLabel,
          statusLabel,
          pluralLabel,
          locale:()=>locale,
          onOpenTrip:setQueryTrip,
          onTraveller:openTraveller,
          onMyTrips:openMyTrips,
          tripTools:TripTools,
          tripCompare:TripCompare,
          travellerFit:TravellerFit,
          storage:localStorage,
          ensureDialog:Ui.ensureDialog,
          loadProfile,
          profileConfigured:()=>Boolean(localStorage.getItem(PROFILE_KEY)),
          toast:Ui.toast
        });
        await Home.open();
        return;
      }
      const wanted=p.get('trip')||catalog.defaultTripId;
      currentTripMeta=catalog.trips.find(x=>x.id===wanted||x.slug===wanted)||catalog.trips.find(x=>x.id===catalog.defaultTripId);
      TripTools.markViewed(localStorage,currentTripMeta.id);
      window.ONE_WORLD_ROUTE_OWNERSHIP=currentTripMeta.renderer==='legacy-world'?'legacy':'regional';
      if(currentTripMeta.renderer!=='legacy-world') await activateRegionalTrip(currentTripMeta);
      else {
        await waitForCore();
        LegacyLocalization.configure({getLocale:()=>locale,t}).activate();
        const titleNode=document.querySelector('.brand small');if(titleNode)titleNode.textContent=local(currentTripMeta.title);
        const panel=document.querySelector('.left-panel');
        if(panel){const note=document.createElement('div');note.className='platform-scenario-note';note.innerHTML='<p>'+esc(t('snapshotOnly'))+'</p><button type="button" data-context-planning>'+esc(t('chooseStartDate'))+' →</button>';panel.prepend(note);note.querySelector('button').onclick=openPlanning}
        if(p.get('planStep')==='startDate')openPlanning();
        window.__ONE_WORLD_ROUTE_APP__?.refreshPlanning?.();
        window.__ONE_WORLD_ROUTE_APP__?.refreshGlobe?.();
      }
    }catch(e){
      console.warn('ONE WORLD ROUTE platform layer unavailable',e);
    }finally{
      document.body.classList.remove('platform-booting');
      document.body.classList.add('platform-ready');
    }
  }

  window.ONE_WORLD_PLATFORM={openHome:goHome,openRoutes:openRouteLibrary,openMyTrips,openTraveller,getProfile:loadProfile,getTrip:()=>currentTripMeta,buildTripUrl,setTerrain:active=>Terrain.setActive(active),startStory:()=>Story.start(),stopStory:()=>Story.stop(),focusRoute:()=>{if(document.body.classList.contains('platform-home'))return Home.renderGlobe();if(document.body.classList.contains('terrain-view'))Terrain.focusRoute();else RegionalGlobe.focusRoute()}};
  document.addEventListener('keydown',e=>{
    if(!document.body.classList.contains('platform-regional-trip')||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(e.key==='Escape'&&Story.isActive()){e.preventDefault();Story.stop()}
    else if(e.key==='ArrowLeft'&&Story.isActive()){e.preventDefault();Story.step(-1)}
    else if(e.key==='ArrowRight'&&Story.isActive()){e.preventDefault();Story.step(1)}
  });
  window.addEventListener('DOMContentLoaded',init);
})();
