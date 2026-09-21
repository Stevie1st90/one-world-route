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
  const Story=PLATFORM_MODULES.story;
  const Terrain=PLATFORM_MODULES.terrain;
  const Ui=PLATFORM_MODULES.ui;
  const Navigation=PLATFORM_MODULES.navigation;
  const LegacyLocalization=PLATFORM_MODULES.legacyLocalization;
  if(!LocaleData||!Model||!Traveller||!TravellerUi||!Discovery||!Extensions||!RouteLibrary||!RegionalShell||!RegionalDetail||!Story||!Terrain||!Ui||!Navigation||!LegacyLocalization)throw new Error('ONE WORLD ROUTE platform modules unavailable');
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
  let playTimer = null;

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



  function routeCamera(){
    const places=[...placeMap(currentTrip).values()].filter(p=>Number.isFinite(Number(p.coordinates?.lat))&&Number.isFinite(Number(p.coordinates?.lng)));
    if(!places.length)return currentTrip.rendering?.camera||{lat:20,lng:12,altitude:.8};
    const lats=places.map(p=>Number(p.coordinates.lat)),lngs=places.map(p=>Number(p.coordinates.lng));
    const lat=(Math.min(...lats)+Math.max(...lats))/2,lng=(Math.min(...lngs)+Math.max(...lngs))/2;
    const latSpan=Math.max(...lats)-Math.min(...lats),lngSpan=(Math.max(...lngs)-Math.min(...lngs))*Math.max(.35,Math.cos(lat*Math.PI/180));
    const span=Math.max(latSpan,lngSpan);
    let altitude=span<7?.15:span<13?.21:span<22?.30:span<34?.40:.54;
    if(innerWidth<=820)altitude+=.07;
    return {lat,lng,altitude};
  }

  function regionalChapterForSegment(index){return Model.chapterForSegment(currentTrip,index)}

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
      stopRoutePlayback:()=>{
        if(!playTimer)return;
        clearInterval(playTimer);
        playTimer=null;
        const button=$('#regionalPlayBtn');
        if(button)button.textContent='▶';
      },
      renderRoute:renderRegionalGlobe
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
      isolateRegionalRuntime,
      syncRegionalUrl,
      replaceTimeline,
      ensureStoryUi:()=>Story.ensureUi(),
      configureRegionalSettings,
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
      routeGeometry,
      placeMap,
      local,
      routeBounds:()=>Model.routeBounds(currentTrip),
      routeCamera,
      settings:Ui.regionalSettings,
      selectSegment:selectSegmentIndex,
      renderRoute:renderRegionalGlobe,
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

  function configureRegionalMethodology(){
    const modal=$('#infoModal'),card=$('.modal-card',modal);if(!modal||!card)return;
    const sourced=currentTrip.segments.filter(s=>(s.verification?.sourceIds||[]).length).length;
    card.innerHTML=`<button class="modal-close" aria-label="Close">×</button><div class="eyebrow">${esc(t('methodology').toUpperCase())}</div><h2>${esc(t('routeMethodTitle'))}</h2><p>${esc(t('routeMethodText'))}</p><div class="method-grid"><article><b>${currentTrip.stops.length}</b><span>${esc(t('stops'))}</span></article><article><b>${currentTrip.segments.length}</b><span>${esc(t('segments'))}</span></article><article><b>${currentTrip.planning?.days||'—'}</b><span>${esc(t('days'))}</span></article><article><b>${sourced}/${currentTrip.segments.length}</b><span>${esc(t('evidenceCoverage'))}</span></article></div><h3>${esc(t('editorialStatus'))}</h3><p>${esc(t('editorial'))}</p>`;
    $('.modal-close',card)?.addEventListener('click',()=>modal.classList.add('hidden'));
  }

  function configureRegionalSettings(){
    const actions=$('.top-actions');if(actions)actions.classList.add('platform-regional-actions');
    const brand=$('#brandBtn');if(brand)brand.onclick=()=>{selectedSegmentIndex=0;RegionalDetail.renderTripOverview();renderRegionalGlobe();if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(0);else window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView(routeCamera(),Ui.regionalSettings().reducedMotion?0:650)};
    const settingsButton=$('#settingsBtn');if(settingsButton){settingsButton.title=t('settings');settingsButton.setAttribute('aria-label',t('settings'))}
    const infoButton=$('#infoBtn');if(infoButton){infoButton.title=t('methodology');infoButton.setAttribute('aria-label',t('methodology'))}
    const shareButton=$('#shareBtn');if(shareButton){shareButton.title=t('share');shareButton.setAttribute('aria-label',t('share'))}
    const search=$('#searchBtn');if(search)search.hidden=true;
    const labels=[['autoRotate','autoRotate'],['highDetailGlobe','highDetail'],['terrainView','terrain'],['showPoints','showPoints'],['routeGlow','routeGlow'],['arcWidth','arcThickness'],['reducedMotion','reducedMotion']];
    const terrainToggle=$('#terrainView'),terrainLabel=terrainToggle?.closest('label');
    if(terrainLabel)terrainLabel.hidden=!Model.hasCapability(currentTripMeta,'terrain');
    for(const [id,key] of labels){const span=$('#'+id)?.closest('label')?.querySelector('span');if(span)span.textContent=t(key)}
    const title=$('#settingsPopover .settings-head h3');if(title)title.textContent=t('settings');
    const share=$('#mobileShareBtn');if(share)share.textContent=t('share');
    const info=$('#mobileInfoBtn');if(info)info.textContent=t('methodology');
    let storyBtn=$('#regionalStorySettingsBtn');
    if(!storyBtn){storyBtn=document.createElement('button');storyBtn.id='regionalStorySettingsBtn';storyBtn.type='button';storyBtn.addEventListener('click',()=>{$('#settingsPopover')?.classList.add('hidden');Story.start()});$('#settingsPopover .mobile-settings-actions')?.appendChild(storyBtn)}
    if(storyBtn){storyBtn.textContent=t('storyPlay');storyBtn.hidden=!Model.hasCapability(currentTripMeta,'story')}
    const bind=(id,event,fn)=>{const el=$('#'+id);if(!el||el.dataset.platformRegionalWired)return;el.dataset.platformRegionalWired='1';el.addEventListener(event,fn)};
    bind('autoRotate','change',()=>{const ctl=window.__ONE_WORLD_ROUTE_GLOBE__?.controls?.();if(ctl){ctl.autoRotate=$('#autoRotate').checked&&!Story.isActive()&&!document.body.classList.contains('terrain-view');ctl.autoRotateSpeed=.28}});
    bind('showPoints','change',()=>{renderRegionalGlobe();Terrain.update()});
    bind('routeGlow','change',()=>{renderRegionalGlobe();Terrain.update()});
    bind('arcWidth','input',()=>{renderRegionalGlobe();Terrain.update()});
    bind('reducedMotion','change',()=>{});
    configureRegionalMethodology();
  }

  function isolateRegionalRuntime(){
    document.body.classList.add('platform-regional-trip');
    document.body.classList.remove('story-mode','story-launching');
    window.ONE_WORLD_MOVEMENTS?.clear?.();
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    if(!globe)return;
    try{
      if(typeof globe.ringsData==='function')globe.ringsData([]);
      if(typeof globe.labelsData==='function')globe.labelsData([]);
      if(typeof globe.htmlElementsData==='function')globe.htmlElementsData([]);
      if(typeof globe.onPolygonClick==='function')globe.onPolygonClick(()=>{});
      if(typeof globe.onPolygonHover==='function')globe.onPolygonHover(()=>{});
      if(typeof globe.polygonLabel==='function')globe.polygonLabel(()=> '');
      if(typeof globe.polygonCapColor==='function')globe.polygonCapColor(()=> 'rgba(16,31,46,.10)');
      if(typeof globe.polygonSideColor==='function')globe.polygonSideColor(()=> 'rgba(7,13,22,.08)');
      if(typeof globe.polygonStrokeColor==='function')globe.polygonStrokeColor(()=> 'rgba(135,166,201,.16)');
      if(typeof globe.polygonAltitude==='function')globe.polygonAltitude(()=> .001);
    }catch(e){console.warn('Regional isolation failed',e)}
  }

  function regionalHtmlLabel(place){
    const el=document.createElement('div');
    el.className='platform-globe-label';
    const dot=document.createElement('i');el.appendChild(dot);
    const text=document.createElement('span');text.textContent=local(place?.name);el.appendChild(text);
    return el;
  }

  function replaceTimeline(){
    const timeline=$('#timeline');if(!timeline)return;
    timeline.innerHTML=`<div class="timeline-top platform-regional-timeline-top"><div class="platform-regional-playback"><button class="timeline-step" id="regionalPrevBtn" type="button" aria-label="${esc(t('previous'))}">‹</button><button class="play-btn" id="regionalPlayBtn" type="button" aria-label="Play">▶</button><button class="timeline-step" id="regionalNextBtn" type="button" aria-label="${esc(t('next'))}">›</button></div><div class="timeline-meta"><strong id="regionalTimelineTitle"></strong><span id="regionalTimelineMeta"></span></div></div><div class="range-wrap"><input id="regionalRouteRange" type="range" min="1" max="${Math.max(1,currentTrip.segments.length)}" value="1" step="1" aria-label="${esc(t('segments'))}"/><div class="range-labels" id="regionalRangeLabels"><span></span><span></span><span></span></div></div>`;
    $('#regionalPlayBtn')?.addEventListener('click',togglePlayback);
    $('#regionalPrevBtn')?.addEventListener('click',()=>selectSegmentIndex(selectedSegmentIndex-1,true));
    $('#regionalNextBtn')?.addEventListener('click',()=>selectSegmentIndex(selectedSegmentIndex+1,true));
    $('#regionalRouteRange')?.addEventListener('input',e=>selectSegmentIndex(Number(e.currentTarget.value)-1,true));
    updateTimelineRegional();
  }

  function updateTimelineRegional(){
    const s=currentTrip.segments[selectedSegmentIndex];if(!s)return;
    const stops=stopMap(currentTrip),places=placeMap(currentTrip),a=places.get(stops.get(s.fromStopId)?.placeId),b=places.get(stops.get(s.toStopId)?.placeId);
    const title=$('#regionalTimelineTitle');if(title)title.textContent=`${local(a?.name)} → ${local(b?.name)}`;
    const meta=$('#regionalTimelineMeta');if(meta)meta.textContent=`${t('segment')} ${s.sequence} / ${currentTrip.segments.length} · ${facetLabel(String(s.transport?.mode||''))}`;
    const range=$('#regionalRouteRange');if(range){range.value=String(selectedSegmentIndex+1);range.style.setProperty('--range-progress',`${currentTrip.segments.length<=1?100:(selectedSegmentIndex/(currentTrip.segments.length-1))*100}%`)}
    const labels=$$('#regionalRangeLabels span');
    if(labels[0])labels[0].innerHTML=`<b>${esc(t('start').toUpperCase())}</b> · ${esc(local(stopPlace(currentTrip,currentTrip.stops[0])?.name))}`;
    if(labels[1])labels[1].textContent=`${currentTrip.planning?.days||'—'} ${t('days')}`;
    if(labels[2])labels[2].innerHTML=`<b>${esc(t('finish').toUpperCase())}</b> · ${esc(local(stopPlace(currentTrip,currentTrip.stops.at(-1))?.name))}`;
  }

  function togglePlayback(){
    const btn=$('#regionalPlayBtn');if(playTimer){clearInterval(playTimer);playTimer=null;if(btn)btn.textContent='▶';return}
    if(btn)btn.textContent='Ⅱ';playTimer=setInterval(()=>{if(selectedSegmentIndex>=currentTrip.segments.length-1){clearInterval(playTimer);playTimer=null;if(btn)btn.textContent='▶';return}selectSegmentIndex(selectedSegmentIndex+1,true)},1400);
  }

  function routeGeometry(){
    const stops=stopMap(currentTrip),places=placeMap(currentTrip);
    return Model.routeGeometry(currentTrip).map(s=>({...s,fromName:local(places.get(stops.get(s.fromStopId)?.placeId)?.name),toName:local(places.get(stops.get(s.toStopId)?.placeId)?.name)}));
  }

  function renderRegionalGlobe(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;if(!globe)return;
    const arcs=routeGeometry();
    const places=[...placeMap(currentTrip).values()];
    const active=arcs[selectedSegmentIndex];
    const activeIds=new Set([active?.start&&currentTrip.stops.find(s=>s.id===active.fromStopId)?.placeId,active?.end&&currentTrip.stops.find(s=>s.id===active.toStopId)?.placeId].filter(Boolean));
    const labelPlaces=places.filter(p=>activeIds.has(p.id));
    try{
      isolateRegionalRuntime();
      const settings=Ui.regionalSettings(),story=Story.isActive(),scale=Math.max(.45,settings.arcWidth/.55);
      globe.arcsData(arcs)
        .arcStartLat(d=>d.start.lat).arcStartLng(d=>d.start.lng)
        .arcEndLat(d=>d.end.lat).arcEndLng(d=>d.end.lng)
        .arcAltitude(d=>d._index===selectedSegmentIndex?.075:.045)
        .arcStroke(d=>(d._index===selectedSegmentIndex?.42:.18)*scale)
        .arcColor(d=>d._index===selectedSegmentIndex?(settings.routeGlow?['#59ddff','#ffffff']:'#59ddff'):(story?'rgba(92,124,151,.18)':'rgba(113,151,190,.62)'))
        .arcLabel(()=> '')
        .arcDashLength(d=>d._index===selectedSegmentIndex&&story?.62:1).arcDashGap(d=>d._index===selectedSegmentIndex&&story?.16:0).arcDashAnimateTime(d=>d._index===selectedSegmentIndex&&story&&!settings.reducedMotion?1200:0)
        .onArcClick(d=>{if(!Story.isActive())selectSegmentIndex(d._index,true)});
      globe.pointsData(settings.showPoints?places:[])
        .pointLat(d=>d.coordinates.lat).pointLng(d=>d.coordinates.lng)
        .pointAltitude(.012)
        .pointRadius(d=>activeIds.has(d.id)?.11:.065)
        .pointColor(d=>activeIds.has(d.id)?'#dff8ff':'rgba(130,185,214,.68)')
        .onPointClick(p=>{const idx=currentTrip.stops.findIndex(s=>s.placeId===p.id);if(idx>=0)selectStop(idx,true)});
      if(typeof globe.labelsData==='function')globe.labelsData([]);
      if(typeof globe.ringsData==='function')globe.ringsData([]);
      if(typeof globe.htmlElementsData==='function'){
        globe.htmlElementsData(labelPlaces).htmlLat(d=>d.coordinates.lat).htmlLng(d=>d.coordinates.lng).htmlAltitude(.018).htmlElement(regionalHtmlLabel).htmlTransitionDuration(0);
      }
      if(typeof globe.onPolygonClick==='function')globe.onPolygonClick(()=>{});
      if(typeof globe.polygonLabel==='function')globe.polygonLabel(()=> '');
      if(globe.controls()){globe.controls().autoRotate=settings.autoRotate&&!story&&!document.body.classList.contains('terrain-view');globe.controls().autoRotateSpeed=.28;globe.controls().enableZoom=true}
      const camera=routeCamera();
      if(!document.body.dataset.regionalCameraReady){document.body.dataset.regionalCameraReady='1';globe.pointOfView(camera,settings.reducedMotion?0:700)}
    }catch(e){console.warn('Regional globe render failed',e)}
  }

  function selectSegmentIndex(index,focus=false){
    selectedSegmentIndex=Math.max(0,Math.min(currentTrip.segments.length-1,index));
    $$('.platform-stop').forEach(x=>x.classList.remove('active'));
    renderRegionalGlobe();updateTimelineRegional();RegionalDetail.renderSegmentDetail(currentTrip.segments[selectedSegmentIndex]);Terrain.update();
    if(Story.isActive())Story.update();
    if(focus){if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(selectedSegmentIndex);else focusSegment(currentTrip.segments[selectedSegmentIndex])}
  }

  function selectStop(index,focus=false){
    const stop=currentTrip.stops[index],p=stopPlace(currentTrip,stop);if(!stop||!p)return;
    $$('.platform-stop').forEach((x,i)=>x.classList.toggle('active',i===index));
    RegionalDetail.renderStopDetail(stop,p);
    if(index<currentTrip.segments.length){selectedSegmentIndex=index;updateTimelineRegional();renderRegionalGlobe();Terrain.update()}
    if(focus){if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(Math.min(index,currentTrip.segments.length-1));else window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView({lat:p.coordinates.lat,lng:p.coordinates.lng,altitude:.48},Ui.regionalSettings().reducedMotion?0:650)}
  }

  function focusSegment(seg){
    const sm=stopMap(currentTrip),pm=placeMap(currentTrip),a=pm.get(sm.get(seg.fromStopId)?.placeId),b=pm.get(sm.get(seg.toStopId)?.placeId);if(!a||!b)return;
    let lng=(a.coordinates.lng+b.coordinates.lng)/2;let lat=(a.coordinates.lat+b.coordinates.lat)/2;
    const spread=Math.max(Math.abs(Number(a.coordinates.lat)-Number(b.coordinates.lat)),Math.abs(Number(a.coordinates.lng)-Number(b.coordinates.lng))*Math.max(.35,Math.cos(lat*Math.PI/180)));
    let altitude=spread<1?.09:spread<2.5?.13:spread<5?.18:spread<10?.25:.34;
    if(innerWidth<=820)altitude+=.055;
    window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView({lat,lng,altitude},Ui.regionalSettings().reducedMotion?0:650);
  }

  async function activateRegionalTrip(meta){
    currentTripMeta=meta;
    selectedSegmentIndex=0;
    currentTrip=await fetch(meta.dataset,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip dataset '+r.status);return r.json()});
    await waitForCore();
    configureRegionalTerrain();
    configureRegionalStory();
    configureRegionalDetail();
    configureRegionalShell();
    RegionalShell.apply();
    renderRegionalGlobe();
    setTimeout(renderRegionalGlobe,500);
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

  window.ONE_WORLD_PLATFORM={openRoutes:openRouteLibrary,openTraveller,getProfile:loadProfile,getTrip:()=>currentTripMeta,buildTripUrl,setTerrain:active=>Terrain.setActive(active),startStory:()=>Story.start(),stopStory:()=>Story.stop(),focusRoute:()=>{if(document.body.classList.contains('terrain-view'))Terrain.focusRoute();else window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView(routeCamera(),Ui.regionalSettings().reducedMotion?0:650)}};
  document.addEventListener('keydown',e=>{
    if(!document.body.classList.contains('platform-regional-trip')||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(e.key==='Escape'&&Story.isActive()){e.preventDefault();Story.stop()}
    else if(e.key==='ArrowLeft'&&Story.isActive()){e.preventDefault();Story.step(-1)}
    else if(e.key==='ArrowRight'&&Story.isActive()){e.preventDefault();Story.step(1)}
  });
  window.addEventListener('DOMContentLoaded',init);
})();
