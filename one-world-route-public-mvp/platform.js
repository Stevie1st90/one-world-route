(() => {
  'use strict';

  const CATALOG_URL = './data/platform/trips.json';
  const PROFILE_KEY = 'one-world-route:traveller-context:v1';
  const PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const LocaleData=PLATFORM_MODULES.i18n;
  const Formatters=PLATFORM_MODULES.formatters;
  const Model=PLATFORM_MODULES.model;
  const Traveller=PLATFORM_MODULES.traveller;
  const TravellerUi=PLATFORM_MODULES.travellerUi;
  const Discovery=PLATFORM_MODULES.discovery;
  const Extensions=PLATFORM_MODULES.extensions;
  const RouteLibrary=PLATFORM_MODULES.routeLibrary;
  const Home=PLATFORM_MODULES.home;
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
  if(!LocaleData||!Formatters||!Model||!Traveller||!TravellerUi||!Discovery||!Extensions||!RouteLibrary||!Home||!RegionalShell||!RegionalDetail||!RegionalGlobe||!RegionalTimeline||!RegionalControls||!RegionalSelection||!Story||!Terrain||!Ui||!Navigation||!LegacyLocalization)throw new Error('ONE WORLD ROUTE platform modules unavailable');
  const SUPPORTED_LOCALES=LocaleData.supportedLocales;
  const I18N=LocaleData.messages;
  const $ = (s, r=document) => r.querySelector(s);
  const $ = (s, r=document) => [...r.querySelectorAll(s)];
  const initialLocale = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    const b = String(q || navigator.language || 'en').toLowerCase().split('-')[0];
    return SUPPORTED_LOCALES.includes(b) ? b : 'en';
  })();
  let locale = initialLocale;
  const t = key => I18N[locale]?.[key] || I18N.en[key] || key;
  const local = value => {
    if(value==null)return '';
    if(['string','number','boolean'].includes(typeof value))return String(value);
    if(Array.isArray(value))return value.map(local).filter(Boolean).join(' · ');
    if(typeof value==='object'){
      const values=Object.values(value);
      const candidate=value?.[locale]??value?.en??values.find(item=>item!=null);
      return candidate===value?'':local(candidate);
    }
    return String(value);
  };
  const esc = value => local(value).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const facetLabel = value => {
    const key='facet_'+String(value||'').replaceAll('-','_');
    const translated=t(key);
    return translated===key?String(value||'').replaceAll('-',' '):translated;
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
    return (ids||[]).filter(id=>!seen.has(id)&&seen.add(id)).map(id=>map.get(id)).filter(Boolean).map(src=>`<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(local(src.issuer||src.title))}</b><span>${esc(local(src.title))}</span><small>${esc(t('lastChecked'))}: ${esc(src.checkedAt||'—')}</small></a>`).join('');
  };

  let catalog = null;
  let currentTrip = null;
  let currentTripMeta = null;

  function loadProfile(){return Traveller.load(localStorage,PROFILE_KEY,locale)}
  function saveProfile(profile){return Traveller.save(localStorage,PROFILE_KEY,profile,locale)}
  function clearProfile(){return Traveller.clear(localStorage,PROFILE_KEY,locale)}

  async function waitForCore(max=70){
    for(let i=0;i<max;i++){
      if(window.__ONE_WORLD_ROUTE_APP__ && window.__ONE_WORLD_ROUTE_GLOBE__) return true;
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


  function openRouteLibrary(){
    return RouteLibrary.open({
      catalog,
      currentTripMeta,
      Discovery,
      ensureDialog:Ui.ensureDialog,
      t,
      local,
      esc,
      facetLabel,
      statusLabel,
      pluralLabel,
      onOpenTrip:setQueryTrip
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
      terrainActive:document.body.classList.contains('terrain-view')
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
      t,
      local,
      esc,
      facetLabel,
      countryDisplay,
      durationLabel:planning=>Formatters.durationLabel(planning),
      costLabel:planning=>Formatters.costLabel({locale,planning,defaultCurrency:currentTrip?.planning?.currency||'EUR',publishedFrom:t('publishedFrom')}),
      editorialNote:value=>Formatters.editorialNote(locale,value,local),
      verificationLabel,
      sourceLinks,
      sourceMap,
      loadProfile,
      openTraveller,
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

  async function activateRegionalTrip(meta){
    currentTripMeta=meta;
    currentTrip=await fetch(meta.dataset,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip dataset '+r.status);return r.json()});
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
      const p=new URLSearchParams(location.search),wanted=p.get('trip');
      currentTripMeta=catalog.trips.find(x=>x.id===wanted||x.slug===wanted)||catalog.trips.find(x=>x.id===catalog.defaultTripId);
      const profile=loadProfile();
      const explicitLang=new URLSearchParams(location.search).get('lang');
      if(!SUPPORTED_LOCALES.includes(String(explicitLang||'').toLowerCase())&&profile.language&&SUPPORTED_LOCALES.includes(profile.language))locale=profile.language;
      Ui.ensureGlobalActions({t,esc,onRoutes:openRouteLibrary,onTraveller:openTraveller});
      if(!wanted){
        await waitForCore();
        LegacyLocalization.configure({getLocale:()=>locale,t}).activate();
        Home.show({catalog,t,local,esc,facetLabel,statusLabel,locale,onOpenTrip:setQueryTrip});
        document.querySelector('#platformHomeTraveller')?.addEventListener('click',openTraveller);
        return;
      }
      Home.hide();
      if(currentTripMeta.renderer!=='legacy-world') await activateRegionalTrip(currentTripMeta);
      else { await waitForCore(); LegacyLocalization.configure({getLocale:()=>locale,t}).activate(); }
    }catch(e){console.warn('ONE WORLD ROUTE platform layer unavailable',e)}
  }

  window.ONE_WORLD_PLATFORM={openRoutes:openRouteLibrary,openTraveller,getProfile:loadProfile,getTrip:()=>currentTripMeta,buildTripUrl,setTerrain:active=>Terrain.setActive(active),startStory:()=>Story.start(),stopStory:()=>Story.stop(),focusRoute:()=>{if(document.body.classList.contains('terrain-view'))Terrain.focusRoute();else RegionalGlobe.focusRoute()}};
  document.addEventListener('keydown',e=>{
    if(!document.body.classList.contains('platform-regional-trip')||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(e.key==='Escape'&&Story.isActive()){e.preventDefault();Story.stop()}
    else if(e.key==='ArrowLeft'&&Story.isActive()){e.preventDefault();Story.step(-1)}
    else if(e.key==='ArrowRight'&&Story.isActive()){e.preventDefault();Story.step(1)}
  });
  window.addEventListener('DOMContentLoaded',init);
})();
