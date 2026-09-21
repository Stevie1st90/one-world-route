(() => {
  'use strict';

  const CATALOG_URL = './data/platform/trips.json';
  const PROFILE_KEY = 'one-world-route:traveller-context:v1';
  const PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const LocaleData=PLATFORM_MODULES.i18n;
  const Model=PLATFORM_MODULES.model;
  const Traveller=PLATFORM_MODULES.traveller;
  const TravellerUi=PLATFORM_MODULES.travellerUi;
  const Discovery=PLATFORM_MODULES.discovery;
  const Extensions=PLATFORM_MODULES.extensions;
  const RouteLibrary=PLATFORM_MODULES.routeLibrary;
  const RegionalShell=PLATFORM_MODULES.regionalShell;
  const RegionalDetail=PLATFORM_MODULES.regionalDetail;
  const RegionalGlobe=PLATFORM_MODULES.regionalGlobe;
  const RegionalTimeline=PLATFORM_MODULES.regionalTimeline;
  const RegionalControls=PLATFORM_MODULES.regionalControls;
  const Story=PLATFORM_MODULES.story;
  const Terrain=PLATFORM_MODULES.terrain;
  const Ui=PLATFORM_MODULES.ui;
  const Navigation=PLATFORM_MODULES.navigation;
  const LegacyLocalization=PLATFORM_MODULES.legacyLocalization;
  if(!LocaleData||!Model||!Traveller||!TravellerUi||!Discovery||!Extensions||!RouteLibrary||!RegionalShell||!RegionalDetail||!RegionalGlobe||!RegionalTimeline||!RegionalControls||!Story||!Terrain||!Ui||!Navigation||!LegacyLocalization)throw new Error('ONE WORLD ROUTE platform modules unavailable');
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
  const local = value => typeof value === 'string' ? value : value?.[locale] || value?.en || Object.values(value || {})[0] || '';
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
  const money = (v,c='EUR',digits=0) => Number.isFinite(Number(v)) ? new Intl.NumberFormat(locale,{style:'currency',currency:c,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(v)) : '—';
  const durationLabel = p => {
    if(Number.isFinite(Number(p?.durationMinutes))) return Number(p.durationMinutes)+' min';
    if(Array.isArray(p?.durationRangeMinutes)&&p.durationRangeMinutes.length===2) return p.durationRangeMinutes[0]+'–'+p.durationRangeMinutes[1]+' min';
    if(Number.isFinite(Number(p?.minimumInVehicleMinutes))) return '≥ '+Number(p.minimumInVehicleMinutes)+' min';
    return '—';
  };
  const costLabel = p => {
    const cost=p?.cost;if(cost?.amount==null)return '—';
    const prefix=/from|floor|known-stage/.test(String(cost.basis||''))?t('publishedFrom')+' ':'';
    return prefix+money(cost.amount,cost.currency||currentTrip?.planning?.currency||'EUR',Number(cost.amount)%1?2:0);
  };
  const EDITORIAL_NOTES={
    'This is one source-backed direct operator option, not a claim that no faster option exists on another operator/date.':{
      de:'Dies ist eine quellenbasierte direkte Betreiberoption; daraus folgt nicht, dass an einem anderen Datum oder bei einem anderen Anbieter keine schnellere Verbindung existiert.',
      it:'Questa è una delle opzioni dirette supportate da fonti; non significa che in un’altra data o con un altro operatore non esista un collegamento più rapido.',
      es:'Esta es una opción directa respaldada por fuentes; no implica que no exista una conexión más rápida con otro operador o en otra fecha.',
      fr:'Il s’agit d’une option directe étayée par des sources ; cela ne signifie pas qu’aucune liaison plus rapide n’existe avec un autre opérateur ou à une autre date.',
      pt:'Esta é uma opção direta sustentada por fontes; não significa que não exista uma ligação mais rápida com outro operador ou noutra data.'
    },
    'Endpoint cruise facilities are source-backed. No specific ship service or sailing time is asserted.':{
      de:'Die Kreuzfahrtanlagen an beiden Endpunkten sind quellenbasiert. Es wird keine konkrete Schiffsverbindung oder Abfahrtszeit behauptet.',
      it:'Le strutture crocieristiche ai due estremi sono supportate da fonti. Non viene indicato uno specifico servizio navale né un orario di partenza.',
      es:'Las instalaciones de crucero en ambos extremos están respaldadas por fuentes. No se afirma ningún servicio de barco ni horario de salida concreto.',
      fr:'Les installations de croisière aux deux extrémités sont étayées par des sources. Aucun service de navire ni horaire de départ précis n’est affirmé.',
      pt:'As instalações de cruzeiro nos dois extremos são sustentadas por fontes. Não é indicado qualquer serviço de navio ou horário de partida específico.'
    },
    'This leg leaves the Schengen area. Endpoint ports are source-backed; the sailing itself is illustrative.':{
      de:'Dieses Segment verlässt den Schengen-Raum. Die Häfen an beiden Endpunkten sind quellenbasiert; die konkrete Seeverbindung ist illustrativ.',
      it:'Questa tratta esce dall’area Schengen. I porti alle estremità sono supportati da fonti; la traversata è illustrativa.',
      es:'Este tramo sale del espacio Schengen. Los puertos de ambos extremos están respaldados por fuentes; la travesía es ilustrativa.',
      fr:'Cette étape quitte l’espace Schengen. Les ports aux deux extrémités sont étayés par des sources ; la traversée reste illustrative.',
      pt:'Este trecho sai do espaço Schengen. Os portos nos dois extremos são sustentados por fontes; a travessia é ilustrativa.'
    },
    'Includes one modelled sea day. This leg re-enters the Schengen area; actual immigration handling depends on the traveller and selected sailing.':{
      de:'Enthält einen modellierten Seetag. Dieses Segment führt zurück in den Schengen-Raum; die tatsächliche Einreiseabwicklung hängt vom Reisenden und der gewählten Abfahrt ab.',
      it:'Include un giorno di navigazione modellato. Questa tratta rientra nell’area Schengen; le formalità effettive dipendono dal viaggiatore e dalla partenza selezionata.',
      es:'Incluye un día de navegación modelado. Este tramo vuelve a entrar en el espacio Schengen; las formalidades reales dependen del viajero y de la salida elegida.',
      fr:'Comprend une journée en mer modélisée. Cette étape revient dans l’espace Schengen ; les formalités réelles dépendent du voyageur et du départ choisi.',
      pt:'Inclui um dia de navegação modelado. Este trecho volta a entrar no espaço Schengen; as formalidades reais dependem do viajante e da partida escolhida.'
    }
  };
  const editorialNote = value => {
    if(value==null)return '';
    if(typeof value==='object')return local(value);
    if(locale==='en')return String(value);
    return EDITORIAL_NOTES[String(value)]?.[locale]||String(value);
  };

  const sourceMap = () => Model.sourceMap(currentTrip);
  const verificationLabel = s => s?.verification?.status==='verified'?t('verified'):(s?.verification?.status==='illustrative'?t('illustrative'):t('currentCheck'));
  const sourceLinks = ids => {
    const map=sourceMap(),seen=new Set();
    return (ids||[]).filter(id=>!seen.has(id)&&seen.add(id)).map(id=>map.get(id)).filter(Boolean).map(src=>`<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(src.issuer||src.title)}</b><span>${esc(src.title)}</span><small>${esc(t('lastChecked'))}: ${esc(src.checkedAt||'—')}</small></a>`).join('');
  };

  let catalog = null;
  let currentTrip = null;
  let currentTripMeta = null;
  let selectedSegmentIndex = 0;

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

  function configureRegionalGlobe(){
    RegionalGlobe.configure({
      getTrip:()=>currentTrip,
      getSelectedIndex:()=>selectedSegmentIndex,
      placeMap,
      stopMap,
      modelRouteGeometry:trip=>Model.routeGeometry(trip),
      local,
      settings:Ui.regionalSettings,
      isStoryActive:()=>Story.isActive(),
      selectSegment:selectSegmentIndex,
      selectStop
    });
  }

  function configureRegionalTimeline(){
    RegionalTimeline.configure({
      getTrip:()=>currentTrip,
      getSelectedIndex:()=>selectedSegmentIndex,
      t,
      local,
      esc,
      facetLabel,
      stopMap,
      placeMap,
      stopPlace,
      selectSegment:selectSegmentIndex
    });
  }

  function configureRegionalStory(){
    Story.configure({
      getTrip:()=>currentTrip,
      getTripMeta:()=>currentTripMeta,
      getSelectedIndex:()=>selectedSegmentIndex,
      placeMap,
      stopMap,
      chapterForSegment:regionalChapterForSegment,
      hasCapability:(meta,id)=>Model.hasCapability(meta,id),
      t,
      local,
      esc,
      facetLabel,
      selectSegment:selectSegmentIndex,
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
      durationLabel,
      costLabel,
      editorialNote,
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
        selectedSegmentIndex=0;
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
      selectStop,
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
      getSelectedIndex:()=>selectedSegmentIndex,
      hasCapability:(meta,id)=>Model.hasCapability(meta,id),
      routeGeometry:()=>RegionalGlobe.routeGeometry(),
      placeMap,
      local,
      routeBounds:()=>Model.routeBounds(currentTrip),
      routeCamera:()=>RegionalGlobe.routeCamera(),
      settings:Ui.regionalSettings,
      selectSegment:selectSegmentIndex,
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

  function selectSegmentIndex(index,focus=false){
    selectedSegmentIndex=Math.max(0,Math.min(currentTrip.segments.length-1,index));
    $$('.platform-stop').forEach(x=>x.classList.remove('active'));
    RegionalGlobe.render();RegionalTimeline.update();RegionalDetail.renderSegmentDetail(currentTrip.segments[selectedSegmentIndex]);Terrain.update();
    if(Story.isActive())Story.update();
    if(focus){if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(selectedSegmentIndex);else RegionalGlobe.focusSegment(currentTrip.segments[selectedSegmentIndex])}
  }

  function selectStop(index,focus=false){
    const stop=currentTrip.stops[index],p=stopPlace(currentTrip,stop);if(!stop||!p)return;
    $$('.platform-stop').forEach((x,i)=>x.classList.toggle('active',i===index));
    RegionalDetail.renderStopDetail(stop,p);
    if(index<currentTrip.segments.length){selectedSegmentIndex=index;RegionalTimeline.update();RegionalGlobe.render();Terrain.update()}
    if(focus){if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(Math.min(index,currentTrip.segments.length-1));else RegionalGlobe.focusPlace(p)}
  }

  async function activateRegionalTrip(meta){
    currentTripMeta=meta;
    selectedSegmentIndex=0;
    currentTrip=await fetch(meta.dataset,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip dataset '+r.status);return r.json()});
    await waitForCore();
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
      const p=new URLSearchParams(location.search),wanted=p.get('trip')||catalog.defaultTripId;
      currentTripMeta=catalog.trips.find(x=>x.id===wanted||x.slug===wanted)||catalog.trips.find(x=>x.id===catalog.defaultTripId);
      const profile=loadProfile();
      const explicitLang=new URLSearchParams(location.search).get('lang');
      if(!SUPPORTED_LOCALES.includes(String(explicitLang||'').toLowerCase())&&profile.language&&SUPPORTED_LOCALES.includes(profile.language))locale=profile.language;
      Ui.ensureGlobalActions({t,esc,onRoutes:openRouteLibrary,onTraveller:openTraveller});
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
