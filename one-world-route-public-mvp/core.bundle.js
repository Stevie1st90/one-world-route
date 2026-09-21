/* ONE WORLD ROUTE core runtime bundle. */

/* ===== locale-en.js ===== */
(() => {
  'use strict';
  const names=new Map();
  const SUPPORTED=['en','de','it','es','fr','pt'];
  const locale=(()=>{
    const query=new URLSearchParams(location.search).get('lang');
    if(SUPPORTED.includes(String(query||'').toLowerCase()))return String(query).toLowerCase();
    try{
      const saved=JSON.parse(localStorage.getItem('one-world-route:traveller-context:v1')||'{}')?.language;
      if(SUPPORTED.includes(String(saved||'').toLowerCase()))return String(saved).toLowerCase();
    }catch{}
    const browser=String(navigator.language||'en').toLowerCase().split('-')[0];
    return SUPPORTED.includes(browser)?browser:'en';
  })();
  let regionNames=null;
  try{regionNames=new Intl.DisplayNames([locale],{type:'region'});}catch{}

  const MODE=new Map(Object.entries({
    'Zug':'Train','Flug':'Flight','Bus':'Bus','Fähre':'Ferry','Land':'Overland',
    'Auto':'Car','Zu Fuß/Shuttle':'Walk / Shuttle','Bus+Flug':'Bus + Flight',
    'Bus/4x4':'Bus / 4x4','Bus/Auto':'Bus / Car','Bus/Flug':'Bus / Flight',
    'Bus/Sammeltaxi':'Bus / Shared taxi','Bus/Shuttle':'Bus / Shuttle',
    'Bus/Zug':'Bus / Train','Flug (1 Stopp)':'Flight (1 stop)',
    'Flug (via Fidschi)':'Flight (via Fiji)','Flug – Dualstrategie':'Flight – dual strategy',
    'Flug/Bus':'Flight / Bus','Fähre/Flug':'Ferry / Flight',
    'Fähre/Hors-bord':'Ferry / Speedboat','Land+Flug':'Overland + Flight',
    'Zug+Bus':'Train + Bus','Zug/Bus':'Train / Bus'
  }));

  const EXACT=new Map(Object.entries({
    'Planbar':'Plannable','Bedingt':'Conditional','Kritisch':'Critical',
    'Plausibel':'Plausible','Verifiziert':'Verified',
    'JETZT BUCHEN':'BOOK NOW','JETZT BUCHEN / FLEX':'BOOK NOW / FLEX',
    'NICHT LANGFRISTIG FIXIEREN':'DO NOT LOCK LONG-TERM',
    'Visumfrei':'Visa-free','Visumfrei 30 Tage':'Visa-free 30 days',
    'Visumfrei bis 31.12.2026':'Visa-free until 31 Dec 2026',
    'Visum erforderlich':'Visa required','Pflichtformular':'Mandatory form',
    'Start/Heimatland':'Start / home country',
    'Israelische Einreisekontrolle':'Israeli entry control',
    'K-ETA ab 2027 einplanen':'Plan for K-ETA from 2027',
    'KALENDERKONFLIKT':'CALENDAR CONFLICT','LOI + Visum':'LOI + visa',
    'eVisa/VOA – kritisch':'eVisa / VOA – critical','BLOCKIERT':'BLOCKED',
    'Keine Einreisegenehmigung':'No entry authorisation required',
    'Keine Vorabgenehmigung':'No prior authorisation required',
    'Kein belastbarer Visaplan':'No reliable visa plan',
    'Klassisches Visum / Konsularweg':'Standard visa / consular route',
    'Klassisches Visum organisieren':'Arrange standard visa',
    'VOA-Unterlagen':'VOA documents','VOA-Unterlagen vorbereiten':'Prepare VOA documents',
    'VOA-Voraussetzungen prüfen':'Check VOA requirements','VOA-Voraussetzungen vorbereiten':'Prepare VOA requirements',
    'VOA/eVisa vorbereiten':'Prepare VOA / eVisa','eVisa oder VOA vorbereiten':'Prepare eVisa or VOA',
    'eVisa vor Reise':'Obtain eVisa before travel','eVisa empfohlen':'eVisa recommended',
    'eVisa/VOA vorbereiten':'Prepare eVisa / VOA','eVisa/Einreisegenehmigung prüfen':'Check eVisa / entry authorisation',
    'eVisitor vor Flug':'Obtain eVisitor before flight',
    'Visa/Entry innerhalb 90 Tage':'Visa / entry action within 90 days',
    'Booking-Fenster offen – nicht dringend':'Booking window open – not urgent',
    'Spätere Visa-/Entry-Aktion beobachten':'Monitor later visa / entry action',
    'Späteres kritisches Segment beobachten':'Monitor later critical segment',
    'Tier A/B Buchung jetzt bearbeiten':'Handle Tier A/B booking now',
    'Brisbane-Default früh/flexibel sichern; Guam nur optionale Visa-Optimierung':'Secure Brisbane default early/flexibly; Guam is only an optional visa optimisation',
    'ICVP mitführen; keine besondere Route-Pflicht identifiziert.':'Carry ICVP; no special route-specific requirement identified.',
    'ICVP EINREISEPFLICHT: Land verlangt YF-Nachweis von allen ankommenden Reisenden.':'ICVP ENTRY REQUIREMENT: the country requires yellow-fever proof from all arriving travellers.',
    'Gelbfieberimpfung je nach Reisegebiet empfohlen; ICVP auf der gesamten Route mitführen.':'Yellow-fever vaccination recommended depending on travel area; carry the ICVP throughout the journey.',
    'Einreise aus Angola: gültiges Gelbfieberzertifikat erforderlich.':'Arrival from Angola: valid yellow-fever certificate required.',
    'Einreise aus Gambia (Gelbfiebergebiet): ICVP erforderlich.':'Arrival from Gambia (yellow-fever area): ICVP required.',
    'Einreise aus Kenia: ICVP erforderlich; Ausnahme nur bei reinem Airside-Transit <12 h.':'Arrival from Kenya: ICVP required; exception only for airside transit under 12 hours.',
    'Einreise aus Sudan: Gelbfiebernachweis erforderlich; ohne Nachweis kann Quarantäne drohen.':'Arrival from Sudan: yellow-fever proof required; quarantine may apply without proof.',
    'Einreise aus Südsudan: gültiges Gelbfieberzertifikat erforderlich.':'Arrival from South Sudan: valid yellow-fever certificate required.',
    'Einreise aus Äquatorialguinea: ICVP erforderlich.':'Arrival from Equatorial Guinea: ICVP required.',
    '2027-Regel kurz vorher bestätigen':'Reconfirm the 2027 rule shortly before travel',
    'Aktuelles Ghana-Verfahren prüfen':'Check the current Ghana procedure',
    'Bhutan-Genehmigung organisieren':'Arrange Bhutan authorisation',
    'Canada eTA vor Flug':'Obtain Canada eTA before flight',
    'China-Visum einplanen / Policy neu prüfen':'Plan China visa / recheck policy',
    'Einreisegenehmigung unmittelbar bestätigen':'Confirm entry authorisation immediately before travel',
    'Einreisegenehmigung/VOA prüfen':'Check entry authorisation / VOA',
    'K-ETA-Status 2027 prüfen':'Check 2027 K-ETA status',
    'Kein separates Touristenvisum; Bewegungsregeln prüfen':'No separate tourist visa; check movement rules',
    'Kuba-eVisa vor Reise':'Obtain Cuba eVisa before travel',
    'MDAC vor Einreise':'Complete MDAC before entry',
    'NZeTA vor Flug':'Obtain NZeTA before flight',
    'Nauru-Visum/Entry Permit frühzeitig klären':'Resolve Nauru visa / entry permit early',
    'Online-Einreisegebühr/Registrierung prüfen':'Check online entry fee / registration',
    'Online-Genehmigung vor Reise':'Obtain online authorisation before travel',
    'Pre-enrolment vor Reise':'Complete pre-enrolment before travel',
    'Regel + Landgrenzen kurz vor Einreise prüfen':'Recheck rule and land borders shortly before entry',
    'Russland-eVisa zeitnah beantragen':'Apply for Russia eVisa in good time',
    'Saudi-eVisa empfohlen':'Saudi eVisa recommended',
    'Seychellen-Registrierung':'Seychelles registration',
    'Touragentur + LOI organisieren':'Arrange tour agency + LOI',
    'UK ETA vor Reise':'Obtain UK ETA before travel',
    'Visum 4–8 Wochen vor Einreise':'Obtain visa 4–8 weeks before entry',
    'Visum vor Einreise':'Obtain visa before entry',
    'DEFAULT/Plan B operational: PNI→MAJ→TRW→INU→BNE, danach Qantas BNE→ROR. OPTION A: PNI→GUM→ROR nur mit regulärem US-Visum nach Kuba. V18 Phase 1 17.09.2026: Brisbane route removes the US visa as a single point of failure.':'DEFAULT / Plan B operational: PNI→MAJ→TRW→INU→BNE, then Qantas BNE→ROR. OPTION A: PNI→GUM→ROR only with a regular US visa after Cuba. V18 Phase 1 17.09.2026: Brisbane route removes the US visa as a single point of failure.',
    'Sükhbaatar/Naushki Landgrenze':'Sükhbaatar / Naushki land border',
    'Bischkek→Duschanbe Flug, falls veröffentlicht':'Bishkek → Dushanbe flight, if published',
    'anderer Istanbuler Flughafen → EBL':'other Istanbul airport → EBL',
    'Melloula/Babbouch Landgrenze':'Melloula / Babbouch land border',
    'Flug via Lomé, anschließend Cotonou':'Flight via Lomé, then Cotonou',
    'Cotonou→Lomé Flug/Regionalhub':'Cotonou → Lomé flight / regional hub',
    'ACC→ABJ nonstop, sofern am Datum verfügbar':'ACC → ABJ nonstop, if available on the planned date',
    'ROB→FNA nonstop':'ROB → FNA nonstop',
    'Kambia/Pamelap Landroute':'Kambia / Pamelap overland route',
    'Gabu/Buruntuma Landroute':'Gabu / Buruntuma overland route',
    'zusätzliche Nacht in Jeddah bis nächster ASM-Flug':'additional night in Jeddah until the next ASM flight',
    'Einreisepunkt prüfen: VOA/eVisa gilt nicht automatisch an jedem Land-/Seegrenzpunkt.':'Check entry point: VOA / eVisa is not automatically valid at every land or sea border.',
    'HARTER TERMINKONFLIKT: geplante Einreise 2027 liegt nach Ende der aktuell veröffentlichten Visumfreiheit (31.12.2026).':'HARD DATE CONFLICT: planned 2027 entry is after the end of the currently published visa-free period (31 Dec 2026).',
    'Kein Kalenderdatum; 195/195 bleibt blockiert.':'No calendar date; 195/195 remains blocked.',
    'Geplante Einreise 2027 liegt nach Ende der derzeit veröffentlichten K-ETA-Befreiung (31.12.2026).':'Planned 2027 entry is after the end of the currently published K-ETA exemption (31 Dec 2026).',
    'LOI über registrierte Touragentur ist Kernabhängigkeit; ohne LOI kein belastbarer Eintritt.':'LOI via a registered tour agency is a core dependency; entry is not reliable without the LOI.',
    'Visum 90 Tage ab Ausstellung gültig; daher ein Antrag vor Reisebeginn im Okt. 2026 wäre für die späte 2027-Einreise unbrauchbar.':'Visa valid for 90 days from issue; an application before departure in Oct 2026 would therefore be unusable for the late-2027 entry.'
  }));

  function registerCountries(list=[]){
    for(const c of list){
      if(!c?.name)continue;
      let en='';
      const code=String(c.cca2||'').toUpperCase();
      if(regionNames&&/^[A-Z]{2}$/.test(code)){
        try{en=regionNames.of(code)||'';}catch{}
      }
      if(en)names.set(c.name,en);
    }
  }

  function country(raw,cca2=''){
    if(!raw)return '';
    if(cca2&&regionNames){
      try{const en=regionNames.of(String(cca2).toUpperCase());if(en)return en;}catch{}
    }
    return names.get(raw)||raw;
  }

  const MODE_WORDS={
    it:[['Train','Treno'],['Flight','Volo'],['Ferry','Traghetto'],['Overland','Via terra'],['Car','Auto'],['Walk','A piedi'],['Shared taxi','Taxi condiviso'],['Shuttle','Navetta'],['stop','scalo'],['dual strategy','strategia doppia'],['via Fiji','via Figi']],
    es:[['Train','Tren'],['Flight','Vuelo'],['Ferry','Ferry'],['Overland','Por tierra'],['Car','Coche'],['Walk','A pie'],['Shared taxi','Taxi compartido'],['Shuttle','Lanzadera'],['stop','escala'],['dual strategy','estrategia dual'],['via Fiji','vía Fiyi']],
    fr:[['Train','Train'],['Flight','Vol'],['Ferry','Ferry'],['Overland','Par voie terrestre'],['Car','Voiture'],['Walk','À pied'],['Shared taxi','Taxi collectif'],['Shuttle','Navette'],['stop','escale'],['dual strategy','double stratégie'],['via Fiji','via Fidji']],
    pt:[['Train','Trem'],['Flight','Voo'],['Ferry','Balsa'],['Overland','Por terra'],['Car','Carro'],['Walk','A pé'],['Shared taxi','Táxi compartilhado'],['Shuttle','Transfer'],['stop','escala'],['dual strategy','estratégia dupla'],['via Fiji','via Fiji']]
  };
  function mode(v){
    const raw=String(v||'');
    if(locale==='de')return raw;
    let out=MODE.get(raw)||raw;
    if(locale==='en')return out;
    for(const [a,b] of MODE_WORDS[locale]||[])out=out.replaceAll(a,b);
    return out;
  }

  function text(v){
    if(v===null||v===undefined)return v;
    let s=String(v);
    if(locale==='de')return s;
    if(EXACT.has(s))return EXACT.get(s);
    s=s
      .replace(/^WARTEN bis /,'WAIT until ')
      .replace(/^HOLD bis /,'HOLD until ')
      .replace(/Luxemburg-Stadt/g,'Luxembourg City')
      .replace(/Bischkek/g,'Bishkek')
      .replace(/Duschanbe/g,'Dushanbe')
      .replace(/Fidschi/g,'Fiji')
      .replace(/Landgrenze/g,'land border');
    return s;
  }

  function value(v){
    if(v===null||v===undefined)return v;
    const s=String(v);
    if(locale==='de')return MODE.has(s)?mode(s):s;
    return EXACT.get(s)||mode(s)||text(s);
  }

  window.ONE_WORLD_EN={locale,registerCountries,country,mode,text,value};
})();

/* ===== iteration4.js ===== */
(() => {
  'use strict';

  const PHASES = [
    {id:1, range:[1,29]}, {id:2, range:[30,39]}, {id:3, range:[40,52]},
    {id:4, range:[53,64]}, {id:5, range:[65,78]}, {id:6, range:[79,95]},
    {id:7, range:[96,112]}, {id:8, range:[113,120]}, {id:9, range:[121,145]},
    {id:10, range:[146,169]}, {id:11, range:[170,181]}, {id:12, range:[182,194]}
  ];

  const runtime = {
    globe:null,
    lastSegment:null,
    lastPhase:null,
    lockedPhase:null,
    normalArcTransition:null,
    applyingHierarchy:false,
    applyingCamera:false,
    applyingSceneData:false,
    focusTimer:null,
    syncFrame:null,
    chapterTimer:null,
    active:false,
    userInteracting:false,
    interactionTimer:null,
    cancelCameraTween:null,
    readCameraPOV:null,
    setCameraPOV:null,
    controlsEnabledBeforeStory:true,
    pointers:new Map(),
    dragStart:null,
    pinchStart:null
  };

  const $ = (s, root=document) => root.querySelector(s);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const phaseFor = id => PHASES.find(p => id >= p.range[0] && id <= p.range[1]) || PHASES[0];
  const isStory = () => document.body.classList.contains('story-mode');
  const segmentId = () => clamp(Number($('#routeRange')?.value || 1),1,194);
  const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

  function createStoryGlobeStub(){
    let stub;
    const controls = {enabled:false,autoRotate:false};
    stub = new Proxy({}, {
      get(_target,prop){
        if(prop === 'controls') return () => controls;
        if(prop === 'globeMaterial') return () => null;
        if(prop === 'width' || prop === 'height') return () => stub;
        return () => stub;
      }
    });
    return stub;
  }

  function installPersistentStoryRenderer(instance){
    if(!instance || instance.__oneWorldPersistentStory) return;

    const nativeArcsData = instance.arcsData?.bind(instance);
    if(nativeArcsData){
      instance.arcsData = function(value){
        if(arguments.length === 0) return nativeArcsData();
        if(!isStory()){
          runtime.lockedPhase=null;
          return nativeArcsData(value);
        }

        const phase=phaseFor(segmentId());
        const current=nativeArcsData() || [];
        const currentIsChapter=current.length>0 && current.every(s=>Number(s?.id)>=phase.range[0] && Number(s?.id)<=phase.range[1]);
        if(currentIsChapter && runtime.lockedPhase===phase.id) return instance;

        const incoming=Array.isArray(value)?value:[];
        const chapter=incoming.filter(s=>Number(s?.id)>=phase.range[0] && Number(s?.id)<=phase.range[1]);
        if(!chapter.length) return instance;

        runtime.lockedPhase=phase.id;
        const result=nativeArcsData(chapter);
        setTimeout(()=>syncStoryScene({focus:true}),0);
        return result;
      };
    }

    ['arcColor','arcStroke','arcDashLength','arcDashGap','arcDashAnimateTime','arcCurveResolution'].forEach(name=>{
      const method=instance[name];
      if(typeof method!=='function') return;
      const native=method.bind(instance);
      instance[name]=function(...args){
        if(!args.length) return native();
        if(isStory() && !runtime.applyingHierarchy) return instance;
        return native(...args);
      };
    });

    ['pointsData','labelsData','ringsData','polygonsData'].forEach(name=>{
      const method=instance[name];
      if(typeof method!=='function') return;
      const native=method.bind(instance);
      instance[name]=function(...args){
        if(!args.length) return native();
        if(isStory() && !runtime.applyingSceneData) return instance;
        return native(...args);
      };
    });

    const pointOfView=instance.pointOfView;
    if(typeof pointOfView==='function'){
      const nativePointOfView=pointOfView.bind(instance);
      runtime.readCameraPOV=()=>{
        try{
          const pov=nativePointOfView();
          return pov&&Number.isFinite(pov.lat)&&Number.isFinite(pov.lng)&&Number.isFinite(pov.altitude)
            ? {lat:Number(pov.lat),lng:Number(pov.lng),altitude:Number(pov.altitude)}
            : null;
        }catch{return null}
      };
      runtime.setCameraPOV=(view,duration=0)=>{
        try{return nativePointOfView(view,Math.max(0,Number(duration)||0));}catch{return instance}
      };
      runtime.cancelCameraTween=()=>{
        const pov=runtime.readCameraPOV?.();
        if(pov)runtime.setCameraPOV?.(pov,0);
      };
      instance.pointOfView=function(...args){
        if(isStory() && !runtime.applyingCamera) return args.length?instance:nativePointOfView();
        return nativePointOfView(...args);
      };
    }

    instance.__oneWorldPersistentStory=true;
  }

  function captureMainGlobe(){
    const NativeGlobe = window.Globe;
    if(typeof NativeGlobe !== 'function' || NativeGlobe.__oneWorldIteration4) return;

    function WrappedGlobe(el,...args){
      if(el?.id === 'storyOverlay') return createStoryGlobeStub();
      const instance = Reflect.construct(NativeGlobe,[el,...args]);
      if(el?.id === 'globe' || !runtime.globe){
        runtime.globe = instance;
        window.__ONE_WORLD_ROUTE_GLOBE__ = instance;
        installPersistentStoryRenderer(instance);
      }
      return instance;
    }

    try{ Object.setPrototypeOf(WrappedGlobe,NativeGlobe); }catch{}
    WrappedGlobe.prototype = NativeGlobe.prototype;
    WrappedGlobe.__oneWorldIteration4 = true;
    window.Globe = WrappedGlobe;
  }

  captureMainGlobe();

  function getGlobe(){
    return runtime.globe || window.__ONE_WORLD_ROUTE_GLOBE__ || null;
  }

  function currentChapterSegments(){
    const globe = getGlobe();
    if(!globe || typeof globe.arcsData !== 'function') return [];
    let data=[];
    try{ data = globe.arcsData() || []; }catch{return []}
    const phase = phaseFor(segmentId());
    return data.filter(s => Number(s?.id) >= phase.range[0] && Number(s?.id) <= phase.range[1]);
  }

  function hierarchyColor(s,id){
    const delta = Number(s.id) - id;
    if(delta === 0) return ['rgba(255,255,255,.98)','rgba(89,221,255,1)'];
    if(delta < 0) return 'rgba(89,221,255,.055)';
    if(delta === 1) return ['rgba(89,221,255,.74)','rgba(146,118,255,.68)'];
    if(delta === 2) return 'rgba(126,170,255,.28)';
    if(delta === 3) return 'rgba(146,118,255,.16)';
    return 'rgba(129,151,181,.055)';
  }

  function hierarchyStroke(s,id){
    const delta = Number(s.id) - id;
    const mobileScale = isMobile() ? .86 : 1;
    if(delta === 0) return 1.62 * mobileScale;
    if(delta < 0) return .12;
    if(delta === 1) return .58 * mobileScale;
    if(delta === 2) return .30 * mobileScale;
    if(delta === 3) return .20 * mobileScale;
    return .11;
  }

  function applyRouteHierarchy(){
    if(!isStory()) return;
    const globe=getGlobe();
    if(!globe) return;
    const id=segmentId();

    runtime.applyingHierarchy=true;
    try{
      globe
        .arcColor(s=>hierarchyColor(s,id))
        .arcStroke(s=>hierarchyStroke(s,id))
        .arcDashLength(()=>1)
        .arcDashGap(()=>0)
        .arcDashAnimateTime(()=>0)
        .arcCurveResolution(isMobile()?24:36);
    }catch{}
    finally{ runtime.applyingHierarchy=false; }
  }

  function sphericalMidpoint(s){
    const d2r=Math.PI/180, r2d=180/Math.PI;
    const lat1=Number(s.startLat)*d2r, lon1=Number(s.startLng)*d2r;
    const lat2=Number(s.endLat)*d2r, lon2=Number(s.endLng)*d2r;
    const a=[Math.cos(lat1)*Math.cos(lon1),Math.cos(lat1)*Math.sin(lon1),Math.sin(lat1)];
    const b=[Math.cos(lat2)*Math.cos(lon2),Math.cos(lat2)*Math.sin(lon2),Math.sin(lat2)];
    const v=[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
    const mag=Math.hypot(v[0],v[1],v[2]);
    if(mag<.0001) return {lat:Number(s.endLat)||0,lng:Number(s.endLng)||0};
    return {lat:Math.asin(v[2]/mag)*r2d,lng:Math.atan2(v[1],v[0])*r2d};
  }

  function angularDistance(s){
    const d2r=Math.PI/180;
    const lat1=Number(s.startLat)*d2r, lat2=Number(s.endLat)*d2r;
    const dLon=(Number(s.endLng)-Number(s.startLng))*d2r;
    const cos=Math.sin(lat1)*Math.sin(lat2)+Math.cos(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return Math.acos(clamp(cos,-1,1))*180/Math.PI;
  }

  function activeSpeed(){
    const b=$('.speed-control button.active');
    return clamp(Number(b?.dataset.speed || 700),220,1600);
  }

  function focusCurrentSegment(force=false){
    if(!isStory() || runtime.userInteracting) return;
    const globe=getGlobe();
    if(!globe || typeof globe.pointOfView!=='function') return;
    const id=segmentId();
    if(!force && runtime.lastSegment===id) return;
    const chapter=currentChapterSegments();
    const seg=chapter.find(s=>Number(s.id)===id);
    if(!seg) return;

    const phase=phaseFor(id);
    const chapterChanged=runtime.lastPhase!==null && runtime.lastPhase!==phase.id;
    const midpoint=sphericalMidpoint(seg);
    const distance=angularDistance(seg);
    let altitude=clamp(1.36+(distance/110)*.72,1.36,2.18);
    if(isMobile()) altitude+=.16;
    if(id===phase.range[0] || chapterChanged) altitude=Math.max(altitude,1.92);
    const duration=$('#reducedMotion')?.checked ? 0 : clamp(Math.round(activeSpeed()*.68),180,920);

    clearTimeout(runtime.focusTimer);
    runtime.applyingCamera=true;
    try{
      const view=safePOV({lat:midpoint.lat,lng:midpoint.lng,altitude});
      if(view)runtime.setCameraPOV?.(view,duration);
    }catch{}
    finally{ runtime.applyingCamera=false; }
    runtime.lastSegment=id;
    if(runtime.lastPhase!==phase.id){
      runtime.lastPhase=phase.id;
      animateChapterShift();
    }
  }

  function ensurePreview(){
    const route=$('#storyRoute');
    const hud=$('#storyHud');
    if(!route || !hud) return null;
    let preview=$('#storyPreview',hud);
    if(!preview){
      preview=document.createElement('div');
      preview.id='storyPreview';
      preview.className='story-preview';
      route.insertAdjacentElement('afterend',preview);
    }
    return preview;
  }

  function updatePreview(){
    if(!isStory()) return;
    const preview=ensurePreview();
    if(!preview) return;
    const id=segmentId();
    const chapter=currentChapterSegments();
    const next=chapter.filter(s=>Number(s.id)>id).sort((a,b)=>a.id-b.id).slice(0,isMobile()?1:3);
    if(!next.length){
      preview.innerHTML='<span class="story-preview-label">CHAPTER END</span><b>Next chapter incoming</b>';
      return;
    }
    preview.innerHTML='<span class="story-preview-label">NEXT</span>'+next.map((s,i)=>`<span class="story-preview-leg ${i===0?'is-next':''}"><i>+${i+1}</i>${escapeText(s.displayFrom||window.ONE_WORLD_EN?.country?.(s.from)||s.from)} → ${escapeText(s.displayTo||window.ONE_WORLD_EN?.country?.(s.to)||s.to)}</span>`).join('');
  }

  function escapeText(value){
    return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function animateChapterShift(){
    const hud=$('#storyHud');
    if(!hud) return;
    if($('#reducedMotion')?.checked){hud.classList.remove('chapter-shift');return;}
    hud.classList.remove('chapter-shift');
    void hud.offsetWidth;
    hud.classList.add('chapter-shift');
    clearTimeout(runtime.chapterTimer);
    runtime.chapterTimer=setTimeout(()=>hud.classList.remove('chapter-shift'),650);
  }

  function syncStoryScene({focus=true}={}){
    if(!isStory()) return;
    cancelAnimationFrame(runtime.syncFrame);
    runtime.syncFrame=requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        applyRouteHierarchy();
        updatePreview();
        if(focus) focusCurrentSegment();
      });
    });
  }

  function enterStory(){
    runtime.active=true;
    setNativeStoryControls(true);
    runtime.pointers.clear();
    runtime.dragStart=null;
    runtime.pinchStart=null;
    runtime.lastSegment=null;
    runtime.lastPhase=null;
    runtime.lockedPhase=null;
    const globe=getGlobe();
    if(globe && typeof globe.arcsTransitionDuration==='function'){
      try{
        if(runtime.normalArcTransition===null) runtime.normalArcTransition=globe.arcsTransitionDuration();
        globe.arcsTransitionDuration(0);
      }catch{}
    }

    runtime.applyingSceneData=true;
    try{
      globe?.pointsData?.([]);
      globe?.labelsData?.([]);
      globe?.ringsData?.([]);
    }catch{}
    finally{ runtime.applyingSceneData=false; }

    runtime.applyingHierarchy=true;
    try{ globe?.arcCurveResolution?.(isMobile()?24:36); }catch{}
    finally{ runtime.applyingHierarchy=false; }
    syncStoryScene({focus:true});
  }

  function exitStory(){
    runtime.active=false;
    runtime.pointers.clear();
    runtime.dragStart=null;
    runtime.pinchStart=null;
    runtime.userInteracting=false;
    setNativeStoryControls(false);
    runtime.lastSegment=null;
    runtime.lastPhase=null;
    runtime.lockedPhase=null;
    runtime.applyingCamera=false;
    runtime.applyingSceneData=false;
    clearTimeout(runtime.focusTimer);
    clearTimeout(runtime.chapterTimer);
    const globe=getGlobe();
    if(globe && typeof globe.arcsTransitionDuration==='function' && runtime.normalArcTransition!==null){
      try{ globe.arcsTransitionDuration(runtime.normalArcTransition); }catch{}
    }
    try{ globe?.arcCurveResolution?.(48); }catch{}
    const preview=$('#storyPreview');
    if(preview) preview.innerHTML='';
  }

  function setNativeStoryControls(active){
    const ctl=getGlobe()?.controls?.();
    if(!ctl)return;
    try{
      if(active){
        runtime.controlsEnabledBeforeStory=ctl.enabled!==false;
        ctl.autoRotate=false;
        ctl.enablePan=false;ctl.noPan=true;ctl.screenSpacePanning=false;
        if(ctl.target?.set)ctl.target.set(0,0,0);
        ctl.enabled=false;
      }else{
        ctl.enabled=runtime.controlsEnabledBeforeStory;
        ctl.enablePan=false;ctl.noPan=true;ctl.screenSpacePanning=false;
        ctl.enableRotate=true;ctl.noRotate=false;
        ctl.enableZoom=true;ctl.noZoom=false;
        if(ctl.target?.set)ctl.target.set(0,0,0);
      }
      ctl.update?.();
    }catch{}
  }

  function safePOV(pov){
    if(!pov)return null;
    const lat=clamp(Number(pov.lat)||0,-84,84);
    let lng=Number(pov.lng)||0;
    lng=((lng+540)%360)-180;
    const altitude=clamp(Number(pov.altitude)||1.65,isMobile()?.92:.78,isMobile()?3.15:3.4);
    return {lat,lng,altitude};
  }

  function setStoryPOV(pov){
    const safe=safePOV(pov);if(!safe)return;
    runtime.setCameraPOV?.(safe,0);
  }

  function bindStoryGlobeInteraction(){
    const host=$('#globe');
    if(!host||host.dataset.storyInteractionBound)return;
    host.dataset.storyInteractionBound='1';

    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const resetGesture=()=>{
      runtime.dragStart=null;
      runtime.pinchStart=null;
      if(runtime.pointers.size===1){
        const p=[...runtime.pointers.values()][0];
        const pov=safePOV(runtime.readCameraPOV?.());
        if(pov)runtime.dragStart={x:p.x,y:p.y,pov,moved:false};
      }else if(runtime.pointers.size===2){
        const [a,b]=[...runtime.pointers.values()];
        const pov=safePOV(runtime.readCameraPOV?.());
        if(pov)runtime.pinchStart={distance:Math.max(8,distance(a,b)),pov};
      }
    };

    const down=e=>{
      if(!isStory())return;
      runtime.cancelCameraTween?.();
      runtime.userInteracting=true;
      runtime.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      try{host.setPointerCapture?.(e.pointerId)}catch{}
      resetGesture();
      e.preventDefault();
    };

    const move=e=>{
      if(!isStory()||!runtime.pointers.has(e.pointerId))return;
      runtime.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(runtime.pointers.size===1&&runtime.dragStart){
        const p=[...runtime.pointers.values()][0];
        const dx=p.x-runtime.dragStart.x,dy=p.y-runtime.dragStart.y;
        if(Math.hypot(dx,dy)>3)runtime.dragStart.moved=true;
        if(runtime.dragStart.moved){
          const factor=isMobile()?.20:.16;
          setStoryPOV({
            lat:runtime.dragStart.pov.lat+dy*factor,
            lng:runtime.dragStart.pov.lng-dx*factor,
            altitude:runtime.dragStart.pov.altitude
          });
        }
      }else if(runtime.pointers.size===2){
        const [a,b]=[...runtime.pointers.values()];
        if(!runtime.pinchStart)resetGesture();
        if(runtime.pinchStart){
          const ratio=runtime.pinchStart.distance/Math.max(8,distance(a,b));
          setStoryPOV({...runtime.pinchStart.pov,altitude:runtime.pinchStart.pov.altitude*ratio});
        }
      }
      e.preventDefault();
    };

    const up=e=>{
      if(!runtime.pointers.has(e.pointerId))return;
      runtime.pointers.delete(e.pointerId);
      try{host.releasePointerCapture?.(e.pointerId)}catch{}
      if(runtime.pointers.size){
        resetGesture();
      }else{
        runtime.dragStart=null;
        runtime.pinchStart=null;
        runtime.userInteracting=false;
      }
      if(isStory())e.preventDefault();
    };

    const wheel=e=>{
      if(!isStory())return;
      const pov=safePOV(runtime.readCameraPOV?.());if(!pov)return;
      runtime.cancelCameraTween?.();
      const scale=Math.exp(clamp(e.deltaY,-180,180)*.0015);
      setStoryPOV({...pov,altitude:pov.altitude*scale});
      runtime.userInteracting=false;
      e.preventDefault();
    };

    host.addEventListener('pointerdown',down,{capture:true,passive:false});
    host.addEventListener('pointermove',move,{capture:true,passive:false});
    host.addEventListener('pointerup',up,{capture:true,passive:false});
    host.addEventListener('pointercancel',up,{capture:true,passive:false});
    host.addEventListener('wheel',wheel,{capture:true,passive:false});
  }

  function wire(){
    bindStoryGlobeInteraction();

    const bodyObserver=new MutationObserver(()=>{
      const active=isStory();
      if(active && !runtime.active) enterStory();
      else if(!active && runtime.active) exitStory();
    });
    bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});

    $('#routeRange')?.addEventListener('input',()=>setTimeout(()=>syncStoryScene({focus:true}),0));
    $('#playBtn')?.addEventListener('click',()=>setTimeout(()=>syncStoryScene({focus:false}),0));
    document.addEventListener('click',e=>{
      if(e.target.closest('.speed-control button')) setTimeout(()=>syncStoryScene({focus:false}),0);
    });

    const timeline=$('#timelineTitle');
    if(timeline){
      new MutationObserver(()=>setTimeout(()=>syncStoryScene({focus:true}),0)).observe(timeline,{childList:true,characterData:true,subtree:true});
    }

    window.addEventListener('resize',()=>{
      if(!isStory()) return;
      setTimeout(()=>syncStoryScene({focus:true}),80);
    },{passive:true});

    if(isStory()) enterStory();
  }

  setTimeout(wire,0);
})();


/* ===== app.js ===== */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const colors = {
    cyan:'#59ddff', blue:'#4f7cff', violet:'#9276ff', amber:'#ffbf5a', orange:'#ff7a45', red:'#ff4d67', green:'#65e5a7', muted:'#526277'
  };

  const PHASES = [
    {id:1, range:[1,29], name:'Europe I', short:'Europe I', color:'#59ddff'},
    {id:2, range:[30,39], name:'North & Central America', short:'N. America', color:'#4f7cff'},
    {id:3, range:[40,52], name:'Caribbean', short:'Caribbean', color:'#42e6c4'},
    {id:4, range:[53,64], name:'South America', short:'S. America', color:'#7be495'},
    {id:5, range:[65,78], name:'South Pacific', short:'Pacific', color:'#9276ff'},
    {id:6, range:[79,95], name:'Southeast Asia & Indian Ocean', short:'SE Asia', color:'#e47cff'},
    {id:7, range:[96,112], name:'East & Central Asia', short:'C. Asia', color:'#ffcf62'},
    {id:8, range:[113,120], name:'Levant & North Africa', short:'Levant', color:'#ff9b55'},
    {id:9, range:[121,145], name:'West & Central Africa', short:'W. Africa', color:'#ff704f'},
    {id:10, range:[146,169], name:'Southern & East Africa', short:'E. Africa', color:'#ff4d67'},
    {id:11, range:[170,181], name:'Gulf & Levant', short:'Gulf', color:'#ff8acb'},
    {id:12, range:[182,194], name:'Europe II · Finish', short:'Finish', color:'#79a7ff'}
  ];

  const COUNTRY_ALIASES = {
    'USA':'United States','St. Kitts und Nevis':'Saint Kitts and Nevis','St. Lucia':'Saint Lucia',
    'St. Vincent und die Grenadinen':'Saint Vincent and the Grenadines','Côte d’Ivoire':'Ivory Coast',
    'Cabo Verde':'Cape Verde','Äquatorialguinea':'Equatorial Guinea','Republik Kongo':'Republic of the Congo',
    'Demokratische Republik Kongo':'DR Congo','Südsudan':'South Sudan','Dschibuti':'Djibouti',
    'Staat Palästina':'Palestine','Nordmazedonien':'North Macedonia','Bosnien und Herzegowina':'Bosnia and Herzegovina',
    'Vatikanstadt':'Vatican City','Mikronesien':'Micronesia','Marshallinseln':'Marshall Islands',
    'Salomonen':'Solomon Islands','Südkorea':'South Korea','Nordkorea':'North Korea',
    'Vereinigte Arabische Emirate':'United Arab Emirates','Tschechien':'Czechia','Eswatini':'Eswatini',
    'Moldau':'Moldova','Osttimor':'Timor-Leste','Türkei':'Turkey'
  };

  const state = {
    raw:null, segments:[], countries:[], geo:[], geoIndex:new Map(), countryByCca3:new Map(), polygons:[], globe:null,
    selectedSegmentId:1, selectedCountry:null, layer:'route', phase:'all', mode:'explore', activeTab:'overview',
    filters:{mode:'all', tier:'all', feasibility:'all', alert:'all'},
    playing:false, playTimer:null, speed:700, criticalIds:new Set(),
    settings:{autoRotate:false, showPoints:true, routeGlow:true, arcWidth:.55, reducedMotion:false}
  };
  let inlineHits=[];
  let commandHits=[];
  const platformOwnsRoute=()=>document.body.classList.contains('platform-regional-trip')||new URLSearchParams(location.search).has('trip');
  const EN=window.ONE_WORLD_EN||{locale:'en',registerCountries(){},country:s=>s,mode:s=>s,text:s=>s,value:s=>s};
  const UI_LOCALE=EN.locale||'en';
  const countryDisplay=c=>c?.displayName||EN.country(c?.name||'',c?.cca2||'');
  const segmentFrom=s=>s?.displayFrom||EN.country(s?.from||'');
  const segmentTo=s=>s?.displayTo||EN.country(s?.to||'');
  const segmentMode=s=>s?.displayMode||EN.mode(s?.mode||'');
  const englishValue=v=>EN.value(v);
  const englishText=v=>EN.text(v);

  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
  const excelDate = v => {
    if (!v) return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v+'T00:00:00Z');
    if (typeof v === 'number') return new Date(Date.UTC(1899,11,30) + v*86400000);
    return null;
  };
  const fmtDate = v => { const d = v instanceof Date ? v : excelDate(v); return d ? new Intl.DateTimeFormat(UI_LOCALE,{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d) : '—'; };
  const eur = v => Number.isFinite(Number(v)) ? new Intl.NumberFormat(UI_LOCALE,{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v)) : '—';
  const phaseFor = id => PHASES.find(p => id >= p.range[0] && id <= p.range[1]) || PHASES[0];
  const daysFromStart = v => { const d=excelDate(v), s=new Date(Date.UTC(2026,9,21)); return d ? Math.max(1,Math.round((d-s)/86400000)+1) : null; };
  const statusColor = a => ({RED:colors.red,ORANGE:colors.orange,WATCH:colors.amber,GREEN:colors.green}[a] || colors.muted);
  const readinessColor = r => r === 'READY' ? colors.green : r === 'BLOCKED' ? colors.red : colors.amber;
  const sourceList = s => String(s||'').split(/\s*;\s*/).filter(x=>/^https?:/.test(x));
  const escapeHtml = s => String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const trim = (s,n=84) => String(s||'').length>n ? String(s).slice(0,n-1)+'…' : String(s||'');
  const flagAssetUrl = c => /^[a-z]{2}$/i.test(String(c?.cca2||'')) ? `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/${String(c.cca2).toLowerCase()}.svg` : '';
  const flagMarkup = (c,w=24,h=18) => { const u=flagAssetUrl(c); return u ? `<img src="${u}" alt="" width="${w}" height="${h}" style="display:block;object-fit:cover;box-shadow:0 0 0 1px rgba(255,255,255,.10)">` : ''; };
  const safeGlobeText = s => String(s||'').replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
  function globeHtmlLabel(d){
    const el=document.createElement('div');
    el.className='globe-selected-label';
    const country=d.country||state.countries.find(c=>c.name===d.text);
    const flag=flagAssetUrl(country);
    if(flag){
      const img=document.createElement('img');img.src=flag;img.alt='';img.loading='eager';el.appendChild(img);
    }
    const text=document.createElement('span');text.textContent=d.text;el.appendChild(text);
    return el;
  }
  const colorAlpha = (hex,alpha) => { const m=/^#([0-9a-f]{6})$/i.exec(String(hex||'')); if(!m)return hex; const n=parseInt(m[1],16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`; };

  function criticalScore(s){
    let x={A:30,B:20,C:10,D:5,E:4}[s.bookingTier]||5;
    if(s.feasibility==='Kritisch') x+=30; else if(s.feasibility==='Bedingt') x+=15;
    if(s.alertLevel==='RED') x+=35; else if(s.alertLevel==='ORANGE') x+=24; else if(s.alertLevel==='WATCH') x+=9;
    if(s.dataQuality && !/verifiziert/i.test(s.dataQuality)) x+=12;
    if(/Nauru|Tuvalu|Marshall|Mikronesien|Palau|Haiti|Syrien|Jemen|Sudan|Somalia/i.test(`${s.from} ${s.to}`)) x+=9;
    return x;
  }

  async function loadGeo(){
    try {
      const r = await fetch('./data/country-centroids.json', {cache:'force-cache'});
      if (!r.ok) throw new Error(r.status);
      const local = await r.json();
      if (Array.isArray(local) && local.length === 195) {
        return local.map(x => ({name:{common:x.name},translations:{deu:{common:x.name}},latlng:[x.lat,x.lng],cca2:x.cca2,cca3:x.cca3,region:x.region,subregion:x.subregion,flag:x.flag,altSpellings:[x.cca2,x.cca3]}));
      }
    } catch(e) { console.warn('Local centroid dataset failed', e); }
    const urls=[
      'https://restcountries.com/v3.1/all?fields=name,translations,latlng,cca3,region,subregion,flag,flags,altSpellings',
      'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'
    ];
    for(const url of urls){
      try{ const r=await fetch(url,{cache:'force-cache'}); if(!r.ok) throw new Error(r.status); const j=await r.json(); if(Array.isArray(j)&&j.length>180) return j; }catch(e){ console.warn('Geo source failed',url,e); }
    }
    throw new Error('No geographic reference source available');
  }

  function buildGeoIndex(geo){
    const index=new Map();
    geo.forEach(g=>{
      const names=[g.name?.common,g.name?.official,g.translations?.deu?.common,g.translations?.deu?.official,...(g.altSpellings||[])].filter(Boolean);
      names.forEach(n=>index.set(normalize(n),g));
    });
    state.geoIndex=index;
  }

  function findGeo(name){
    const alias=COUNTRY_ALIASES[name];
    return state.geoIndex.get(normalize(name)) || (alias && state.geoIndex.get(normalize(alias))) || null;
  }

  function enrich(){
    state.countries=state.raw.countries.map(c=>{
      const g=findGeo(c.name); const latlng=g?.latlng || [0,0];
      return {...c, lat:+latlng[0], lng:+latlng[1], flag:g?.flag||'', cca2:g?.cca2||'', cca3:g?.cca3||'', region:g?.region||'', subregion:g?.subregion||''};
    });
    EN.registerCountries(state.countries);
    state.countries=state.countries.map(c=>({...c,displayName:EN.country(c.name,c.cca2)}));
    const cMap=new Map(state.countries.map(c=>[c.name,c]));
    state.segments=state.raw.segments.map(s=>{
      const a=cMap.get(s.from), b=cMap.get(s.to), p=phaseFor(s.id);
      return {...s, phaseId:p.id, phaseName:p.name, phaseColor:p.color,
        displayFrom:a?.displayName||EN.country(s.from),displayTo:b?.displayName||EN.country(s.to),displayMode:EN.mode(s.mode),
        startLat:a?.lat||0,startLng:a?.lng||0,endLat:b?.lat||0,endLng:b?.lng||0,
        criticalScore:criticalScore(s), departureDate:excelDate(s.planDeparture), arrivalDate:excelDate(s.planArrival)};
    });
    state.countryByCca3=new Map(state.countries.filter(c=>c.cca3).map(c=>[c.cca3,c]));
    state.criticalIds=new Set([...state.segments].sort((a,b)=>b.criticalScore-a.criticalScore).slice(0,20).map(s=>s.id));
  }

  function arcColor(s){
    if(state.layer==='status') return statusColor(s.alertLevel);
    if(state.layer==='visa'){
      if(/block/i.test(s.visaStatusTarget||'')) return colors.red;
      if(/pending/i.test(s.visaStatusTarget||'')) return colors.orange;
      if(/N\/A|Approved|Completed/i.test(s.visaStatusTarget||'')) return colors.green;
      return colors.amber;
    }
    if(state.layer==='health') return Number(s.healthPriorityTarget)>=4 ? colors.red : Number(s.healthPriorityTarget)>=2 ? colors.amber : colors.green;
    if(state.layer==='cost'){
      const v=Number(s.transportBudgetEur||0); return v>600?colors.red:v>350?colors.violet:v>150?colors.blue:colors.cyan;
    }
    if(state.layer==='risk') return s.feasibility==='Kritisch'?colors.red:s.feasibility==='Bedingt'?colors.orange:/verifiziert/i.test(s.dataQuality||'')?colors.green:colors.amber;
    if(state.layer==='progress') return colors.blue;
    if(state.layer==='critical') return state.criticalIds.has(s.id)?colors.red:'#273346';
    return s.phaseColor;
  }

  function visibleSegments(){
    const exploreAllRoute=state.mode==='explore' && state.layer==='route' && state.phase==='all';
    return state.segments.filter(s=>{
      if(state.phase!=='all' && s.phaseId!==Number(state.phase)) return false;
      if(!exploreAllRoute){
        if(state.filters.mode!=='all' && s.mode!==state.filters.mode) return false;
        if(state.filters.tier!=='all' && s.bookingTier!==state.filters.tier) return false;
        if(state.filters.feasibility!=='all' && s.feasibility!==state.filters.feasibility) return false;
        if(state.filters.alert!=='all' && s.alertLevel!==state.filters.alert) return false;
      }
      if(state.layer==='critical' && !state.criticalIds.has(s.id)) return false;
      return true;
    });
  }

  function storyLocksGlobeSelection(){
    return document.body.classList.contains('story-mode') || document.body.classList.contains('story-launching');
  }

  async function loadPolygons(){
    try{
      const r=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',{cache:'force-cache'});
      if(!r.ok) throw new Error(r.status);
      const g=await r.json(); return Array.isArray(g.features)?g.features:[];
    }catch(e){ console.warn('Country polygons unavailable; point interaction remains active.',e); return []; }
  }

  function initGlobe(){
    if(typeof window.Globe!=='function'){ $('#globeLoader').classList.add('hidden'); $('#globeFallback').classList.remove('hidden'); return; }
    const el=$('#globe');
    try{
      const globe = new Globe(el)
        .width(el.clientWidth).height(el.clientHeight)
        .backgroundColor('rgba(0,0,0,0)')
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .showAtmosphere(true).atmosphereColor('#4e8cff').atmosphereAltitude(.13)
        .showGraticules(false)
        .arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
        .arcAltitudeAutoScale(.28).arcCurveResolution(48)
        .arcLabel(s=>`<b>#${s.id} ${escapeHtml(segmentFrom(s))} → ${escapeHtml(segmentTo(s))}</b><br><span style="color:#8ba0b8">${escapeHtml(segmentMode(s))} · ${escapeHtml(s.phaseName)}</span>`)
        .onArcClick(s=>{if(!storyLocksGlobeSelection())selectSegment(s.id,true)})
        .pointLat('lat').pointLng('lng').pointAltitude(.011)
        .pointLabel(c=>`<div style="display:flex;align-items:center;gap:7px">${flagMarkup(c,22,16)}<div><b>${escapeHtml(countryDisplay(c))}</b><br><span style="color:#8ba0b8">Country ${c.number}/195 · ${escapeHtml(c.readiness)}</span></div></div>`)
        .onPointClick(c=>{if(!storyLocksGlobeSelection())selectCountry(c.name,true)})
        .labelLat('lat').labelLng('lng').labelText('text').labelColor(()=> '#eafaff').labelSize(1.2).labelAltitude(.025)
        .ringLat('lat').ringLng('lng').ringColor(()=>[colors.cyan,'rgba(89,221,255,0)']).ringMaxRadius(2.8).ringPropagationSpeed(1.2).ringRepeatPeriod(900)
        .polygonGeoJsonGeometry(f=>f.geometry).polygonStrokeColor(()=> 'rgba(135,166,201,.18)')
        .polygonSideColor(()=> 'rgba(7,13,22,.12)').polygonLabel(f=>escapeHtml(f.properties?.name||''))
        .onPolygonClick(f=>{if(storyLocksGlobeSelection())return;const c=state.countryByCca3.get(f.id); if(c)selectCountry(c.name,true)});
      state.globe=globe;
      const ctl=globe.controls();
      ctl.autoRotate=state.settings.autoRotate; ctl.autoRotateSpeed=.28;
      ctl.enableDamping=true; ctl.dampingFactor=.08;
      ctl.enablePan=false; ctl.noPan=true; ctl.screenSpacePanning=false;
      ctl.enableRotate=true; ctl.noRotate=false;
      ctl.enableZoom=true; ctl.noZoom=false;
      ctl.minDistance=170; ctl.maxDistance=520;
      if(ctl.target?.set)ctl.target.set(0,0,0);
      ctl.update?.();
      updateGlobe();
      loadPolygons().then(features=>{state.polygons=features;updateGlobe()});
      globe.pointOfView({lat:20,lng:12,altitude:2.25},0);
      setTimeout(()=>$('#globeLoader').classList.add('hidden'),550);
      window.addEventListener('resize',()=>globe.width(el.clientWidth).height(el.clientHeight));
    }catch(e){console.error(e); $('#globeLoader').classList.add('hidden'); $('#globeFallback').classList.remove('hidden');}
  }

  function updateGlobe(){
    if(!state.globe || platformOwnsRoute()) return;
    const filtered=visibleSegments(); const sel=state.segments.find(s=>s.id===state.selectedSegmentId);
    const segs=sel&&!filtered.some(s=>s.id===sel.id)?[...filtered,sel]:filtered;
    const labelCountry=state.selectedCountry || (sel ? state.countries.find(c=>c.name===sel.to) : null);
    const labelData=labelCountry ? [{lat:labelCountry.lat,lng:labelCountry.lng,text:countryDisplay(labelCountry),country:labelCountry}] : [];
    const useHtmlLabels=typeof state.globe.htmlElementsData==='function';
    state.globe
      .arcsData(segs)
      .arcColor(s=>{
        const c=arcColor(s);
        if(s.id===state.selectedSegmentId)return state.settings.routeGlow?[c,'#ffffff']:c;
        if(state.layer==='route'&&state.phase==='all')return colorAlpha(c,s.phaseId===phaseFor(state.selectedSegmentId).id?.96:.68);
        return c;
      })
      .arcStroke(s=>{
        if(s.id===state.selectedSegmentId)return Math.max(1.05,state.settings.arcWidth*1.8);
        if(state.layer==='route'&&state.phase==='all')return s.phaseId===phaseFor(state.selectedSegmentId).id?Math.max(.42,state.settings.arcWidth*1.08):Math.max(.24,state.settings.arcWidth*.72);
        return state.settings.arcWidth;
      })
      .arcDashLength(s => s.id === state.selectedSegmentId ? .65 : 1)
      .arcDashGap(s => s.id === state.selectedSegmentId ? .18 : 0)
      .arcDashAnimateTime(s=>s.id===state.selectedSegmentId && !state.settings.reducedMotion?1600:0)
      .pointsData(state.settings.showPoints ? state.countries : [])
      .pointRadius(c => c.name === state.selectedCountry?.name ? .22 : .09)
      .pointColor(c=>c.name===state.selectedCountry?.name?colors.cyan:(c.readiness==='BLOCKED'?colors.red:'rgba(188,215,239,.62)'))
      .labelsData(useHtmlLabels || document.body.classList.contains('story-mode') ? [] : labelData.map(d=>({...d,text:safeGlobeText(d.text)})))
      .ringsData(state.selectedCountry ? [state.selectedCountry] : sel ? [{lat:sel.endLat,lng:sel.endLng}] : [])
      .polygonsData(state.polygons)
      .polygonCapColor(f=>{
        const c=state.countryByCca3.get(f.id);
        if(state.globe.__oneWorldArtifactFreeBorders){
          return state.selectedCountry?.cca3===f.id?'rgba(89,221,255,.075)':'rgba(8,14,24,.001)';
        }
        if(!c)return 'rgba(16,23,36,.16)';
        if(state.selectedCountry?.cca3===f.id)return 'rgba(89,221,255,.34)';
        return c.readiness==='BLOCKED'?'rgba(255,77,103,.22)':'rgba(80,118,160,.18)';
      })
      .polygonSideColor(()=>state.globe.__oneWorldArtifactFreeBorders?'rgba(8,14,24,.001)':'rgba(7,13,22,.12)')
      .polygonStrokeColor(()=>state.globe.__oneWorldArtifactFreeBorders?'rgba(8,14,24,.001)':'rgba(135,166,201,.18)')
      .polygonAltitude(f=>state.globe.__oneWorldArtifactFreeBorders?(state.selectedCountry?.cca3===f.id?.003:.0005):(state.selectedCountry?.cca3===f.id?.012:.002));
    if(useHtmlLabels){
      state.globe
        .htmlElementsData(document.body.classList.contains('story-mode')?[]:labelData)
        .htmlLat('lat').htmlLng('lng').htmlAltitude(.028)
        .htmlElement(globeHtmlLabel).htmlTransitionDuration(0);
    }
    if(state.globe.controls()) state.globe.controls().autoRotate=state.settings.autoRotate && !state.playing;
    updateLegend(); updateFloatingStats(); $('#filterCount').textContent=`${filtered.length} / 194`;
  }

  function focusSegment(s,duration=900){ if(state.globe) state.globe.pointOfView({lat:s.endLat,lng:s.endLng,altitude:1.65}, state.settings.reducedMotion?0:duration); }
  function focusCountry(c,duration=900){ if(state.globe) state.globe.pointOfView({lat:c.lat,lng:c.lng,altitude:1.45}, state.settings.reducedMotion?0:duration); }
  function focusAllRoute(duration=850){
    if(!state.globe)return;
    const altitude=window.innerWidth<=820?2.62:2.42;
    state.globe.pointOfView({lat:18,lng:12,altitude},state.settings.reducedMotion?0:duration);
  }

  function selectSegment(id,focus=false){
    if(platformOwnsRoute())return;
    window.ONE_WORLD_MOVEMENTS?.clear();
    const s=state.segments.find(x=>x.id===Number(id)); if(!s)return;
    state.selectedSegmentId=s.id; state.selectedCountry=null; state.activeTab=state.mode==='operations'?'operations':'overview';
    if(state.phase!=='all' && Number(state.phase)!==s.phaseId){state.phase=String(s.phaseId);renderChrome();}
    $('#routeRange').value=s.id; updateRange(); updateGlobe(); renderDetail(); updateTimeline(); updateUrl(); if(focus)focusSegment(s);
  }
  function countryContextSegment(c){
    if(!c)return null;
    const incoming=state.segments.find(s=>s.to===c.name);
    const outgoing=state.segments.find(s=>s.from===c.name);
    if(c.name==='Deutschland') return state.selectedSegmentId>120 ? (incoming||outgoing) : (outgoing||incoming);
    return incoming||outgoing||null;
  }

  function selectCountry(name,focus=false){
    if(platformOwnsRoute())return;
    const c=state.countries.find(x=>x.name===name); if(!c)return;
    const context=countryContextSegment(c);
    if(context){
      state.selectedSegmentId=context.id;
      $('#routeRange').value=context.id;
      updateRange();
      updateTimeline();
      if(state.phase!=='all' && Number(state.phase)!==context.phaseId){state.phase=String(context.phaseId);renderChrome();}
    }
    state.selectedCountry=c;
    state.activeTab=state.mode==='operations'?'operations':'overview';
    updateGlobe(); renderDetail(); updateUrl(); if(focus)focusCountry(c);
    if(focus&&window.innerWidth<=820&&!document.body.classList.contains('story-mode'))openMobilePanel('details');
  }

  function updateUrl(){
    if(platformOwnsRoute())return;
    const current=new URLSearchParams(location.search),p=new URLSearchParams();
    if(state.selectedCountry) p.set('country',state.selectedCountry.name); else p.set('segment',state.selectedSegmentId);
    if(state.layer!=='route')p.set('layer',state.layer); if(state.phase!=='all')p.set('phase',state.phase); if(state.mode!=='explore')p.set('mode',state.mode);
    if(state.filters.mode!=='all')p.set('fmode',state.filters.mode);if(state.filters.tier!=='all')p.set('tier',state.filters.tier);if(state.filters.feasibility!=='all')p.set('feasibility',state.filters.feasibility);if(state.filters.alert!=='all')p.set('alert',state.filters.alert);
    if(document.body.classList.contains('terrain-view')||current.get('view')==='terrain')p.set('view','terrain');
    if(document.body.classList.contains('story-mode')||current.get('story')==='1')p.set('story','1');
    history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
  }
  function restoreUrl(){
    const p=new URLSearchParams(location.search); if(p.get('trip'))return; if(p.get('layer'))state.layer=p.get('layer'); if(p.get('phase'))state.phase=p.get('phase'); if(p.get('mode'))state.mode=p.get('mode');
    if(p.get('fmode'))state.filters.mode=p.get('fmode');if(p.get('tier'))state.filters.tier=p.get('tier');if(p.get('feasibility'))state.filters.feasibility=p.get('feasibility');if(p.get('alert'))state.filters.alert=p.get('alert');
    if(p.get('country')){
      state.selectedCountry=state.countries.find(c=>c.name===p.get('country'))||null;
      const context=countryContextSegment(state.selectedCountry);
      if(context){
        state.selectedSegmentId=context.id;
        if(state.phase!=='all' && Number(state.phase)!==context.phaseId)state.phase=String(context.phaseId);
      }
      state.activeTab=state.mode==='operations'?'operations':'overview';
    } else if(p.get('segment')){
      state.selectedSegmentId=Math.min(194,Math.max(1,Number(p.get('segment'))||1));
      const selected=state.segments.find(s=>s.id===state.selectedSegmentId);
      if(selected&&state.phase!=='all'&&Number(state.phase)!==selected.phaseId)state.phase=String(selected.phaseId);
    }
  }

  function renderChrome(){
    $('#topKpis').innerHTML=`<div class="kpi"><b>195</b><span>countries</span></div><div class="kpi"><b>379</b><span>planned days</span></div><div class="kpi"><b>194</b><span>intl. legs</span></div><div class="kpi"><b>€90.6k</b><span>base model</span></div>`;
    $('#phaseRail').innerHTML=`<button data-phase="all" class="${state.phase==='all'?'active':''}">All route</button>`+PHASES.map(p=>`<button data-phase="${p.id}" class="${String(state.phase)===String(p.id)?'active':''}" title="${p.name}"><span class="phase-dot" style="background:${p.color}"></span>${String(p.id).padStart(2,'0')} ${p.short}</button>`).join('');
    $$('#phaseRail button').forEach(b=>b.onclick=()=>{
      state.phase=b.dataset.phase;
      if(state.phase==='all'){
        state.selectedCountry=null;
        renderChrome();updateGlobe();renderDetail();updateUrl();focusAllRoute();
        return;
      }
      renderChrome();updateGlobe();renderDetail();updateUrl();
      const p=PHASES.find(x=>String(x.id)===state.phase);if(p)selectSegment(p.range[0],true);
    });
    if(window.innerWidth<=820)requestAnimationFrame(()=>{
      const rail=$('#phaseRail'),active=rail?.querySelector('button.active');if(!rail||!active)return;
      const max=Math.max(0,rail.scrollWidth-rail.clientWidth);
      const target=state.phase==='all'?0:Math.max(0,Math.min(max,active.offsetLeft-(rail.clientWidth-active.offsetWidth)/2));
      rail.scrollTo({left:target,behavior:state.settings.reducedMotion?'auto':'smooth'});
    });
    $$('#layerGrid button').forEach(b=>b.classList.toggle('active',b.dataset.layer===state.layer));
    $$('.mode-switch button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));
  }

  function fillFilters(){
    const modes=[...new Set(state.segments.map(s=>s.mode))].sort(); $('#modeFilter').innerHTML='<option value="all">All modes</option>'+modes.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(EN.mode(x))}</option>`).join('');
    const feas=[...new Set(state.segments.map(s=>s.feasibility))].filter(Boolean).sort(); $('#feasibilityFilter').innerHTML='<option value="all">All</option>'+feas.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(EN.value(x))}</option>`).join('');
    for(const k of ['mode','tier','feasibility','alert']){const el=$(`#${k}Filter`);if(el&&[...el.options].some(o=>o.value===state.filters[k]))el.value=state.filters[k];}
  }

  function badge(label,color){return `<span class="status-badge" style="color:${color}">${escapeHtml(label||'Unknown')}</span>`}
  function dataCard(label,value,sub=''){return `<div class="data-card"><span>${escapeHtml(label)}</span><b>${escapeHtml(value??'—')}</b>${sub?`<small class="route-sub">${escapeHtml(sub)}</small>`:''}</div>`}
  function relatedSegments(country){return state.segments.filter(s=>s.from===country.name||s.to===country.name)}

  function renderDetail(){
    const tabBtns=$$('#detailTabs button'); tabBtns.forEach(b=>b.classList.toggle('active',b.dataset.tab===state.activeTab));
    const box=$('#detailContent');
    const resetScroll=()=>requestAnimationFrame(()=>{ if(box) box.scrollTop=0; });
    if(state.selectedCountry){ renderCountryDetail(box,state.selectedCountry); resetScroll(); return; }
    const s=state.segments.find(x=>x.id===state.selectedSegmentId);
    if(s){ renderSegmentDetail(box,s); resetScroll(); return; }
    renderProjectOverview(box); resetScroll();
  }

  function renderSegmentDetail(box,s){
    $('#detailEyebrow').textContent=`SEGMENT ${s.id} · ${s.phaseName}`; $('#detailTitle').textContent=`${segmentFrom(s)} → ${segmentTo(s)}`;
    if(state.activeTab==='overview'){
      box.innerHTML=`<div class="overview-number">${String(s.id).padStart(2,'0')}<small>/194</small></div><p class="detail-copy">${escapeHtml(englishText(s.corridor||''))}</p>
      <div class="data-grid">${dataCard('Departure',fmtDate(s.planDeparture),`Day ${daysFromStart(s.planDeparture)||'—'}`)}${dataCard('Transport',segmentMode(s))}${dataCard('Phase',s.phaseName)}${dataCard('Plan budget',eur(s.transportBudgetEur))}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${badge(s.alertLevel,statusColor(s.alertLevel))}${badge(englishValue(s.feasibility),s.feasibility==='Kritisch'?colors.red:s.feasibility==='Bedingt'?colors.orange:colors.green)}</div>
      <div class="op-callout"><b>Why this route?</b><br>${escapeHtml(s.planB ? `Primary corridor: ${s.corridor}. A documented fallback exists and is shown under Operations.` : `This is the current operational corridor in the public master plan.`)}</div>`;
    } else if(state.activeTab==='details'){
      box.innerHTML=`<div class="data-grid">${dataCard('From',segmentFrom(s))}${dataCard('To',segmentTo(s))}${dataCard('Plan depart',fmtDate(s.planDeparture))}${dataCard('Plan arrive',fmtDate(s.planArrival))}${dataCard('Booking tier',s.bookingTier||'—')}${dataCard('Data quality',englishValue(s.dataQuality)||'—')}${dataCard('Plan status',englishText(s.planStatus)||'—')}${dataCard('Budget',eur(s.transportBudgetEur))}</div><h3>Corridor</h3><p class="detail-copy">${escapeHtml(englishText(s.corridor||'—'))}</p>`;
    } else if(state.activeTab==='operations'){
      box.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${badge(s.alertLevel,statusColor(s.alertLevel))}${badge(`Tier ${s.bookingTier||'—'}`,colors.blue)}${state.criticalIds.has(s.id)?badge('Critical path',colors.red):''}</div>
      <div class="data-grid">${dataCard('Visa target',englishValue(s.visaTypeTarget)||'—',englishValue(s.visaStatusTarget)||'')}${dataCard('Health',`Priority ${s.healthPriorityTarget??'—'}`,englishValue(s.healthStatusTarget)||'')}${dataCard('Verified',fmtDate(s.lastVerified))}${dataCard('Criticality',`${s.criticalScore}/100-ish`)}</div>
      ${s.alertMessage?`<div class="op-callout">${escapeHtml(englishText(s.alertMessage))}</div>`:''}<h3>Plan B</h3><p class="detail-copy">${escapeHtml(englishText(s.planB||'No specific fallback recorded; use surrounding hub/next published service logic.'))}</p>`;
    } else {
      const links=sourceList(s.source); box.innerHTML=links.length?`<p class="detail-copy">Source links attached to this segment. “Verified” refers to the planning snapshot date, not a guarantee that conditions remain unchanged.</p>${links.map((u,i)=>`<a class="source-link" target="_blank" rel="noopener" href="${escapeHtml(u)}">Source ${i+1} · ${escapeHtml(trim(u,62))}</a>`).join('')}`:`<p class="detail-copy">No public source URL is attached to this segment in the current snapshot.</p>`;
    }
  }

  function renderCountryDetail(box,c){
    $('#detailEyebrow').textContent=`COUNTRY ${c.number} · ${c.region||'WORLD'}`; $('#detailTitle').innerHTML=`<span style="display:inline-flex;align-items:center;gap:9px">${flagMarkup(c,24,18)}<span>${escapeHtml(countryDisplay(c))}</span></span>`;
    const rel=relatedSegments(c); const incoming=rel.find(s=>s.to===c.name), outgoing=rel.find(s=>s.from===c.name);
    if(state.activeTab==='overview'){
      box.innerHTML=`<div class="overview-number">${c.number}<small>/195</small></div><p class="detail-copy">Planned entry ${fmtDate(c.planEntry)} · ${escapeHtml(c.subregion||c.region||'')}</p><div class="data-grid">${dataCard('Readiness',englishValue(c.readiness))}${dataCard('Visa',englishValue(c.visaType)||'—',englishValue(c.visaStatus)||'')}${dataCard('Health',`Priority ${c.healthPriority??'—'}`,englishValue(c.healthStatus)||'')}${dataCard('Planned entry',fmtDate(c.planEntry))}</div><div style="display:flex;gap:6px">${badge(englishValue(c.readiness),readinessColor(c.readiness))}</div>${incoming?`<h3>Arrival</h3><div class="route-row" data-segment="${incoming.id}"><span class="route-id">#${incoming.id}</span><div><div class="route-name">${segmentFrom(incoming)} → ${segmentTo(incoming)}</div><div class="route-sub">${segmentMode(incoming)} · ${fmtDate(incoming.planDeparture)}</div></div><span>›</span></div>`:''}${outgoing?`<h3>Next</h3><div class="route-row" data-segment="${outgoing.id}"><span class="route-id">#${outgoing.id}</span><div><div class="route-name">${segmentFrom(outgoing)} → ${segmentTo(outgoing)}</div><div class="route-sub">${segmentMode(outgoing)} · ${fmtDate(outgoing.planDeparture)}</div></div><span>›</span></div>`:''}`;
    } else if(state.activeTab==='details'){
      box.innerHTML=`<h3>Entry planning</h3><p class="detail-copy">${escapeHtml(englishText(c.visaAction||'No public action recorded.'))}</p><div class="data-grid">${dataCard('Visa priority',c.visaPriority??'—')}${dataCard('Health priority',c.healthPriority??'—')}${dataCard('Entry docs',englishValue(c.entryDocs)||'—')}${dataCard('Visited',c.visited||'No')}</div>${c.entryConflict?`<div class="op-callout">${escapeHtml(englishText(c.entryConflict))}</div>`:''}`;
    } else if(state.activeTab==='operations'){
      box.innerHTML=`<div class="data-grid">${dataCard('Readiness',c.readiness)}${dataCard('Visa status',englishValue(c.visaStatus)||'—')}${dataCard('Health status',englishValue(c.healthStatus)||'—')}${dataCard('Region',c.subregion||c.region||'—')}</div><h3>Health note</h3><p class="detail-copy">${escapeHtml(englishText(c.healthNote||'No special public route note.'))}</p><h3>Related route</h3><div class="route-list">${rel.map(s=>`<div class="route-row" data-segment="${s.id}"><span class="route-id">#${s.id}</span><div><div class="route-name">${segmentFrom(s)} → ${segmentTo(s)}</div><div class="route-sub">${segmentMode(s)} · ${s.alertLevel}</div></div><span>›</span></div>`).join('')}</div>`;
    } else {
      const urls=[...new Set(rel.flatMap(s=>sourceList(s.source)))]; box.innerHTML=urls.length?urls.map((u,i)=>`<a class="source-link" target="_blank" rel="noopener" href="${escapeHtml(u)}">Related source ${i+1} · ${escapeHtml(trim(u,62))}</a>`).join(''):`<p class="detail-copy">No related public URLs in this snapshot.</p>`;
    }
    $$('[data-segment]',box).forEach(x=>x.onclick=()=>selectSegment(Number(x.dataset.segment),true));
  }

  function renderProjectOverview(box){
    $('#detailEyebrow').textContent='PROJECT OVERVIEW'; $('#detailTitle').textContent='The route at a glance';
    const segs=visibleSegments();
    box.innerHTML=`<div class="overview-number">195<small> countries</small></div><p class="detail-copy">One continuous, data-driven route. The globe is the interface: select a route line or country to inspect the plan.</p><div class="data-grid">${dataCard('Route legs','194')}${dataCard('Planned days','379')}${dataCard('Base model','€90.6k')}${dataCard('Countries in legs','194 / 195')}</div><h3>Visible route</h3><div class="route-list">${segs.slice(0,14).map(s=>`<div class="route-row" data-segment="${s.id}"><span class="route-id">#${s.id}</span><div><div class="route-name">${segmentFrom(s)} → ${segmentTo(s)}</div><div class="route-sub">${segmentMode(s)} · ${s.phaseName}</div></div><span>›</span></div>`).join('')}</div>`;
    $$('[data-segment]',box).forEach(x=>x.onclick=()=>selectSegment(Number(x.dataset.segment),true));
  }

  function updateLegend(){
    const sets={
      route:PHASES.slice(0,6).map(p=>[p.short,p.color]),status:[['Ready / green',colors.green],['Watch',colors.amber],['Action',colors.orange],['Blocked',colors.red]],
      visa:[['Clear / approved',colors.green],['Pending',colors.orange],['Review',colors.amber],['Blocked',colors.red]],health:[['Low',colors.green],['Medium',colors.amber],['High',colors.red]],
      cost:[['< €150',colors.cyan],['€150–350',colors.blue],['€350–600',colors.violet],['> €600',colors.red]],risk:[['Plannable / verified',colors.green],['Review',colors.amber],['Conditional',colors.orange],['Critical',colors.red]],
      progress:[['Planned',colors.blue],['Visited',colors.green]],critical:[['Top 20 constraint',colors.red],['Other hidden',colors.muted]]
    };
    $('#legend').innerHTML=(sets[state.layer]||sets.route).map(([l,c])=>`<div class="legend-item" style="color:${c}"><i class="legend-dot"></i><span style="color:var(--muted)">${l}</span></div>`).join('');
  }

  function updateFloatingStats(){
    const segs=visibleSegments(), budget=segs.reduce((a,s)=>a+Number(s.transportBudgetEur||0),0), crit=segs.filter(s=>state.criticalIds.has(s.id)).length;
    $('#floatingStats').innerHTML=`<div class="float-card"><b>${segs.length}</b><span>visible legs</span></div><div class="float-card"><b>${eur(budget)}</b><span>transport model</span></div><div class="float-card"><b>${crit}</b><span>critical</span></div>`;
  }

  function updateTimeline(){
    if(platformOwnsRoute())return;
    const s=state.segments.find(x=>x.id===state.selectedSegmentId)||state.segments[0]; if(!s)return;
    $('#timelineTitle').textContent=`${segmentFrom(s)} → ${segmentTo(s)}`; $('#timelineMeta').textContent=`Segment ${s.id} · Day ${daysFromStart(s.planDeparture)||'—'} · ${segmentMode(s)}`;
  }
  function updateRange(){const r=$('#routeRange'),p=((Number(r.value)-1)/193)*100;r.style.setProperty('--range-progress',`${p}%`);}

  function search(q){
    q=normalize(q); if(!q)return[];
    const cs=state.countries.filter(c=>normalize(`${c.name} ${countryDisplay(c)} ${c.region} ${c.subregion} ${englishValue(c.visaType)}`).includes(q)).slice(0,8).map(c=>({type:'country',title:countryDisplay(c),sub:`Country ${c.number} · ${englishValue(c.readiness)}`,obj:c}));
    const ss=state.segments.filter(s=>normalize(`${s.from} ${s.to} ${segmentFrom(s)} ${segmentTo(s)} ${s.mode} ${segmentMode(s)} ${s.corridor} ${s.phaseName} ${s.alertLevel}`).includes(q)).slice(0,10).map(s=>({type:'segment',title:`${segmentFrom(s)} → ${segmentTo(s)}`,sub:`#${s.id} · ${segmentMode(s)} · ${s.phaseName}`,obj:s}));
    return [...cs,...ss].slice(0,14);
  }
  function showInlineResults(q){
    const hits=search(q),box=$('#searchResults');
    inlineHits=hits.slice(0,7);
    if(!q||!inlineHits.length){box.classList.add('hidden');box.innerHTML='';return}
    box.classList.remove('hidden');
    box.innerHTML=inlineHits.map((h,i)=>`<button type="button" class="search-hit" data-i="${i}">${escapeHtml(h.title)}<small>${escapeHtml(h.sub)}</small></button>`).join('');
  }
  function activateHit(h){
    if(!h)return;
    $('#searchResults').classList.add('hidden');closeCommand();closeMobilePanels();
    if(h.type==='country')selectCountry(h.obj.name,true);
    else{
      selectSegment(h.obj.id,true);
      if(window.innerWidth<=820&&!document.body.classList.contains('story-mode'))openMobilePanel('details');
    }
  }
  function renderCommand(q=''){
    commandHits=q?search(q):state.segments.slice(0,8).map(s=>({type:'segment',title:`${segmentFrom(s)} → ${segmentTo(s)}`,sub:`#${s.id} · ${s.phaseName}`,obj:s}));
    $('#commandResults').innerHTML=`<div class="command-group">${q?'Search results':'Jump to route'}</div>${commandHits.map((h,i)=>`<button type="button" class="command-item" data-i="${i}"><b>${escapeHtml(h.title)}</b><span>${escapeHtml(h.sub)}</span></button>`).join('')}`;
  }
  function closeCommand(){ $('#commandPalette')?.classList.add('hidden'); }
  function closeMobilePanels(){
    $('#leftPanel')?.classList.remove('mobile-open');
    $('#rightPanel')?.classList.remove('mobile-open');
  }
  function openMobilePanel(which){
    const left=$('#leftPanel'),right=$('#rightPanel');
    if(which==='filters'){
      const opening=!left?.classList.contains('mobile-open');
      right?.classList.remove('mobile-open');
      left?.classList.toggle('mobile-open',opening);
      if(opening)left.scrollTop=0;
    }else{
      const opening=!right?.classList.contains('mobile-open');
      left?.classList.remove('mobile-open');
      right?.classList.toggle('mobile-open',opening);
      if(opening)$('#detailContent').scrollTop=0;
    }
  }
  function openCommand(){
    closeMobilePanels();
    $('#settingsPopover')?.classList.add('hidden');
    const m=$('#commandPalette');m.classList.remove('hidden');$('#commandInput').value='';renderCommand();setTimeout(()=>$('#commandInput').focus(),30);
  }

  function play(){
    if(state.playing){stopPlay();return} state.playing=true;$('#playBtn').textContent='Ⅱ'; if(state.globe?.controls())state.globe.controls().autoRotate=false;
    let transferShownAfter=null;
    const tick=()=>{
      if(!state.playing)return;
      const movements=window.ONE_WORLD_MOVEMENTS;
      const transfer=movements?.data?.movements.find(m=>m.parentAfterLeg===state.selectedSegmentId&&m.status!=='cancelled');
      if(document.body.classList.contains('story-mode')&&transfer&&transferShownAfter!==state.selectedSegmentId){
        transferShownAfter=state.selectedSegmentId;movements.show(transfer);
      }else{
        transferShownAfter=null;let n=state.selectedSegmentId+1;if(n>194)n=1;selectSegment(n,true);
      }
      state.playTimer=setTimeout(tick,state.speed);
    }; state.playTimer=setTimeout(tick,state.speed);
  }
  function stopPlay(){window.ONE_WORLD_MOVEMENTS?.clear();state.playing=false;clearTimeout(state.playTimer);$('#playBtn').textContent='▶';if(state.globe?.controls())state.globe.controls().autoRotate=state.settings.autoRotate}

  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),2200)}

  function bindUI(){
    $$('.mode-switch button').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;if(state.mode==='operations'){state.layer='status';state.activeTab='operations'}else{state.layer='route';state.activeTab='overview'}renderChrome();updateGlobe();renderDetail();updateUrl()});
    $$('#layerGrid button').forEach(b=>b.onclick=()=>{state.layer=b.dataset.layer;renderChrome();updateGlobe();renderDetail();updateUrl()});
    ['mode','tier','feasibility','alert'].forEach(k=>{$(`#${k}Filter`).onchange=e=>{state.filters[k]=e.target.value;updateGlobe();renderDetail()}});
    $('#clearFilters').onclick=()=>{state.filters={mode:'all',tier:'all',feasibility:'all',alert:'all'};['mode','tier','feasibility','alert'].forEach(k=>$(`#${k}Filter`).value='all');state.phase='all';renderChrome();updateGlobe();renderDetail();updateUrl()};
    $('#inlineSearch').oninput=e=>showInlineResults(e.target.value);
    $('#searchResults').onclick=e=>{const hit=e.target.closest?.('.search-hit');if(hit)activateHit(inlineHits[Number(hit.dataset.i)])};
    $('#searchBtn').onclick=openCommand;
    $('#commandInput').oninput=e=>renderCommand(e.target.value);
    $('#commandInput').onkeydown=e=>{if(e.key==='Enter'&&commandHits[0]){e.preventDefault();activateHit(commandHits[0])}};
    $('#commandResults').onclick=e=>{const hit=e.target.closest?.('.command-item');if(hit)activateHit(commandHits[Number(hit.dataset.i)])};
    $('#routeRange').oninput=e=>{selectSegment(Number(e.target.value),false);updateRange()}; $('#playBtn').onclick=play;
    $$('.speed-control button').forEach(b=>b.onclick=()=>{$$('.speed-control button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.speed=Number(b.dataset.speed)});
    $$('#detailTabs button').forEach(b=>b.onclick=()=>{state.activeTab=b.dataset.tab;renderDetail()});
    $('#brandBtn').onclick=()=>{closeMobilePanels();closeCommand();$('#settingsPopover').classList.add('hidden');state.selectedCountry=null;state.selectedSegmentId=1;state.phase='all';state.layer='route';renderChrome();selectSegment(1,true)};
    $('#infoBtn').onclick=()=>{closeMobilePanels();closeCommand();$('#settingsPopover').classList.add('hidden');$('#infoModal').classList.remove('hidden')}; $$('.modal-close').forEach(x=>x.onclick=()=>x.closest('.modal').classList.add('hidden')); $('#infoModal').onclick=e=>{if(e.target.id==='infoModal')e.currentTarget.classList.add('hidden')};
    $('#settingsBtn').onclick=()=>{closeMobilePanels();closeCommand();$('#settingsPopover').classList.toggle('hidden')};
    $('#settingsClose')?.addEventListener('click',()=>$('#settingsPopover').classList.add('hidden'));
    $('#commandClose')?.addEventListener('click',closeCommand);
    $('#commandPalette')?.addEventListener('click',e=>{if(e.target.id==='commandPalette')closeCommand()});
    $('#mobileShareBtn')?.addEventListener('click',()=>{ $('#settingsPopover').classList.add('hidden'); $('#shareBtn').onclick?.(); });
    $('#mobileInfoBtn')?.addEventListener('click',()=>{ $('#settingsPopover').classList.add('hidden'); $('#infoBtn').click(); });
    $('#autoRotate').onchange=e=>{state.settings.autoRotate=e.target.checked;updateGlobe()}; $('#showPoints').onchange=e=>{state.settings.showPoints=e.target.checked;updateGlobe()}; $('#routeGlow').onchange=e=>{state.settings.routeGlow=e.target.checked;updateGlobe()}; $('#arcWidth').oninput=e=>{state.settings.arcWidth=Number(e.target.value);updateGlobe()}; $('#reducedMotion').onchange=e=>state.settings.reducedMotion=e.target.checked;
    $('#shareBtn').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Share link copied')}catch{toast('Copy the URL from your browser')}};
    $('#mobileFilters').onclick=()=>openMobilePanel('filters');
    $('#mobileDetails').onclick=()=>openMobilePanel('details');
    $('#closeFilters')?.addEventListener('click',()=>$('#leftPanel').classList.remove('mobile-open'));
    $('#closeDetails').onclick=()=>$('#rightPanel').classList.remove('mobile-open');
    document.addEventListener('pointerdown',e=>{
      if(window.innerWidth>820)return;
      const settings=$('#settingsPopover');
      if(settings&&!settings.classList.contains('hidden')&&!settings.contains(e.target)&&!e.target.closest?.('#settingsBtn'))settings.classList.add('hidden');
      const left=$('#leftPanel'),right=$('#rightPanel');
      const closeLeft=left?.classList.contains('mobile-open')&&!left.contains(e.target)&&!e.target.closest?.('#mobileFilters');
      const closeRight=right?.classList.contains('mobile-open')&&!right.contains(e.target)&&!e.target.closest?.('#mobileDetails');
      if(closeLeft||closeRight){
        if(closeLeft)left.classList.remove('mobile-open');
        if(closeRight)right.classList.remove('mobile-open');
        e.preventDefault();e.stopPropagation();
      }
    },true);
    document.addEventListener('keydown',e=>{
      if(platformOwnsRoute()){
        if(e.key==='Escape'){closeCommand();$('#infoModal').classList.add('hidden');$('#settingsPopover').classList.add('hidden');closeMobilePanels()}
        return;
      }
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommand()}else if(e.key==='Escape'){closeCommand();$('#infoModal').classList.add('hidden');$('#settingsPopover').classList.add('hidden');closeMobilePanels()}else if(e.code==='Space'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();play()}else if(e.key==='ArrowRight')selectSegment(Math.min(194,state.selectedSegmentId+1),true);else if(e.key==='ArrowLeft')selectSegment(Math.max(1,state.selectedSegmentId-1),true)
    });
  }

  window.__ONE_WORLD_ROUTE_APP__={
    selectSegment:(id,focus=true)=>selectSegment(Number(id),Boolean(focus)),
    selectCountry:(name,focus=true)=>selectCountry(String(name),Boolean(focus)),
    openDetails:()=>openMobilePanel('details'),
    setPhase:(phase,{jump=false,focus=true}={})=>{
      const next=String(phase)==='all'?'all':String(Math.max(1,Math.min(12,Number(phase)||1)));
      state.phase=next;renderChrome();updateGlobe();renderDetail();updateUrl();
      if(jump&&next!=='all'){const p=PHASES.find(x=>String(x.id)===next);if(p)selectSegment(p.range[0],focus);}
    },
    getState:()=>({selectedSegmentId:state.selectedSegmentId,selectedCountry:state.selectedCountry?.name||null,layer:state.layer,phase:state.phase,mode:state.mode,filters:{...state.filters},settings:{...state.settings},playing:state.playing,speed:state.speed})
  };

  async function init(){
    try{
      const [raw,geo]=await Promise.all([fetch('./data/public-route.json').then(r=>{if(!r.ok)throw new Error('public data');return r.json()}),loadGeo()]);
      state.raw=raw; state.geo=geo; buildGeoIndex(geo); enrich(); restoreUrl(); fillFilters(); bindUI(); renderChrome(); updateRange(); updateTimeline(); renderDetail(); initGlobe();
      if(state.selectedCountry)focusCountry(state.selectedCountry,0);else{const s=state.segments.find(x=>x.id===state.selectedSegmentId);if(s&&state.selectedSegmentId!==1)focusSegment(s,0)}
      const missing=state.countries.filter(c=>!c.lat&&!c.lng).map(c=>c.name); if(missing.length)console.warn('Countries without coordinates',missing);
    }catch(e){console.error(e);$('#globeLoader').classList.add('hidden');$('#globeFallback').classList.remove('hidden');$('#globeFallback').textContent='Public route data could not be loaded. Run this site through a local/static web server rather than opening index.html directly.';}
  }

  window.addEventListener('DOMContentLoaded',init);
})();

/* ===== iteration2.js ===== */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  const PHASES = [
    {id:1, range:[1,29], title:'Europe I', note:'The journey begins across Europe.'},
    {id:2, range:[30,39], title:'North & Central America', note:'Across the Atlantic into North America.'},
    {id:3, range:[40,52], title:'Caribbean', note:'Island connections and short regional hops.'},
    {id:4, range:[53,64], title:'South America', note:'A continuous line through South America.'},
    {id:5, range:[65,78], title:'South Pacific', note:'The route opens into the Pacific.'},
    {id:6, range:[79,95], title:'Southeast Asia & Indian Ocean', note:'Dense regional links and island crossings.'},
    {id:7, range:[96,112], title:'East & Central Asia', note:'Long-distance transitions across Asia.'},
    {id:8, range:[113,120], title:'Levant & North Africa', note:'A compact but operationally complex chapter.'},
    {id:9, range:[121,145], title:'West & Central Africa', note:'Overland and air corridors across West Africa.'},
    {id:10, range:[146,169], title:'Southern & East Africa', note:'The route turns south, then back north-east.'},
    {id:11, range:[170,181], title:'Gulf & Levant', note:'The final Middle East sequence.'},
    {id:12, range:[182,194], title:'Europe II · Finish', note:'The closing run back to Germany.'}
  ];

  const EN=window.ONE_WORLD_EN||{registerCountries(){},country:s=>s,mode:s=>s,text:s=>s,value:s=>s};
  const story = {
    active:false,
    phaseId:null,
    completionTimer:null,
    routeData:null,
    overlay:null,
    overlayReady:false,
    restore:{arcWidth:null,showPoints:null,autoRotate:null}
  };

  function phaseFor(id){
    return PHASES.find(p => id >= p.range[0] && id <= p.range[1]) || PHASES[0];
  }

  function currentSegmentId(){
    const r=$('#routeRange');
    return Math.max(1,Math.min(194,Number(r?.value||1)));
  }

  function progressPct(id=currentSegmentId()){
    return Math.max(0,Math.min(100,((id-1)/193)*100));
  }

  function ensureStoryStyles(){
    if(document.querySelector('#appBundleCss')||document.querySelector('link[data-story-route]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet'; link.href='./story.css'; link.dataset.storyRoute='1';
    document.head.appendChild(link);
  }

  function ensureControls(){
    const stage=$('.globe-stage');
    if(stage && !$('#journeyBtn')){
      const b=document.createElement('button');
      b.id='journeyBtn'; b.className='journey-btn glass';
      b.innerHTML='<span class="journey-icon">▶</span><span><b>Play the journey</b><small>Follow all 194 route legs</small></span>';
      stage.appendChild(b);
      b.addEventListener('click',startStory);
    }

    if(stage && !$('#storyOverlay')){
      const overlay=document.createElement('div');
      overlay.id='storyOverlay'; overlay.className='story-overlay'; overlay.setAttribute('aria-hidden','true');
      stage.appendChild(overlay);
    }

    if(stage && !$('#storyHud')){
      const hud=document.createElement('section');
      hud.id='storyHud'; hud.className='story-hud glass'; hud.setAttribute('aria-live','polite');
      hud.innerHTML=`
        <div class="story-hud-head">
          <div><span id="storyKicker">CHAPTER 01 / 12</span><b id="storyTitle">Europe I</b></div>
          <button id="storyExit" type="button">Exit story</button>
        </div>
        <div id="storyRoute" class="story-route">Germany → Luxembourg</div>
        <div class="story-track"><i></i></div>
        <div class="story-hud-foot"><span id="storyNote">The journey begins across Europe.</span><strong id="storyPct">0%</strong></div>`;
      stage.appendChild(hud);
      $('#storyExit',hud).addEventListener('click',stopStory);
    }

    const play=$('#playBtn');
    if(play && !$('#prevBtn')){
      const prev=document.createElement('button'); prev.id='prevBtn'; prev.className='timeline-step'; prev.setAttribute('aria-label','Previous segment'); prev.textContent='‹';
      const next=document.createElement('button'); next.id='nextBtn'; next.className='timeline-step'; next.setAttribute('aria-label','Next segment'); next.textContent='›';
      play.parentNode.insertBefore(prev,play); play.after(next);
      const step=delta=>{
        const r=$('#routeRange'); if(!r)return;
        const n=Math.max(Number(r.min||1),Math.min(Number(r.max||194),Number(r.value||1)+delta));
        r.value=String(n); r.dispatchEvent(new Event('input',{bubbles:true}));
      };
      prev.addEventListener('click',()=>step(-1)); next.addEventListener('click',()=>step(1));
    }
  }

  function normalize(s){
    return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }

  async function loadStoryData(){
    if(story.routeData)return story.routeData;
    try{
      const [routeRes,geoRes]=await Promise.all([
        fetch('./data/public-route.json',{cache:'force-cache'}),
        fetch('./data/country-centroids.json',{cache:'force-cache'})
      ]);
      if(!routeRes.ok||!geoRes.ok)throw new Error('story data unavailable');
      const route=await routeRes.json();
      const geo=await geoRes.json();
      EN.registerCountries(geo);
      const geoMap=new Map(geo.map(c=>[normalize(c.name),c]));
      const segments=(route.segments||[]).map(s=>{
        const a=geoMap.get(normalize(s.from));
        const b=geoMap.get(normalize(s.to));
        return {...s,displayFrom:EN.country(s.from,a?.cca2),displayTo:EN.country(s.to,b?.cca2),displayMode:EN.mode(s.mode),startLat:a?.lat??0,startLng:a?.lng??0,endLat:b?.lat??0,endLng:b?.lng??0};
      });
      story.routeData={segments};
      return story.routeData;
    }catch(err){
      console.warn('Story route overlay data unavailable',err);
      story.routeData={segments:[]};
      return story.routeData;
    }
  }

  function ensureStoryOverlay(){
    if(story.overlayReady || typeof window.Globe!=='function')return;
    const host=$('#storyOverlay');
    if(!host)return;
    try{
      const overlay=new Globe(host)
        .width(host.clientWidth||window.innerWidth)
        .height(host.clientHeight||window.innerHeight)
        .backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(false)
        .showGraticules(false)
        .arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
        .arcAltitudeAutoScale(.28).arcCurveResolution(48)
        .arcLabel(()=> '')
        .pointLat('lat').pointLng('lng').pointAltitude(.018)
        .ringLat('lat').ringLng('lng')
        .ringMaxRadius(2.2).ringPropagationSpeed(1.5).ringRepeatPeriod(850);
      if(typeof overlay.showGlobe==='function')overlay.showGlobe(false);
      try{
        const mat=overlay.globeMaterial?.();
        if(mat){mat.transparent=true;mat.opacity=0;mat.depthWrite=false;}
      }catch{}
      const ctl=overlay.controls?.();
      if(ctl){ctl.enabled=false;ctl.autoRotate=false;}
      story.overlay=overlay; story.overlayReady=true;
      window.addEventListener('resize',()=>{
        if(!story.overlay)return;
        story.overlay.width(host.clientWidth||window.innerWidth).height(host.clientHeight||window.innerHeight);
      });
    }catch(err){
      console.warn('Story overlay unavailable',err);
      story.overlay=null; story.overlayReady=false;
    }
  }

  function overlayArcColor(s,id){
    if(s.id===id)return ['rgba(255,255,255,.98)','rgba(89,221,255,.98)'];
    if(s.id<id)return 'rgba(89,221,255,.18)';
    return 'rgba(146,118,255,.58)';
  }

  async function renderStoryOverlay(id){
    if(!story.active)return;
    await loadStoryData();
    ensureStoryOverlay();
    if(!story.overlay)return;
    const phase=phaseFor(id);
    const all=story.routeData.segments;
    const active=all.find(s=>s.id===id);
    if(!active)return;
    const visible=all.filter(s=>s.id>=Math.max(phase.range[0],id-4) && s.id<=Math.min(phase.range[1],id+3));
    story.overlay
      .arcsData(visible)
      .arcColor(s=>overlayArcColor(s,id))
      .arcStroke(s=>s.id===id?1.5:(s.id<id?.28:.58))
      .arcDashLength(s=>s.id===id?.58:1)
      .arcDashGap(s=>s.id===id?.16:0)
      .arcDashAnimateTime(s=>s.id===id?1100:0)
      .pointsData([{lat:active.endLat,lng:active.endLng}])
      .pointRadius(.105)
      .pointColor(()=> '#ffffff')
      .ringsData([{lat:active.endLat,lng:active.endLng}])
      .ringColor(()=>['rgba(89,221,255,.9)','rgba(89,221,255,0)']);
    story.overlay.pointOfView({lat:active.endLat,lng:active.endLng,altitude:1.65},480);
  }

  function clearStoryOverlay(){
    if(!story.overlay)return;
    try{story.overlay.arcsData([]).pointsData([]).ringsData([]);}catch{}
  }

  function syncMode(){
    const active=$('.mode-switch button.active');
    document.body.dataset.mode=active?.dataset.mode||'explore';
  }

  function syncProgress(){
    if(document.body.classList.contains('platform-regional-trip')){
      document.querySelector('#detailContent .journey-context')?.remove();
      return;
    }
    const id=currentSegmentId();
    const pct=progressPct(id);
    document.documentElement.style.setProperty('--journey-progress',`${pct}%`);
    const j=$('#journeyBtn'), p=$('#playBtn');
    if(j&&p){
      const running=p.textContent.trim()!=='▶';
      j.classList.toggle('active',running || story.active);
      const i=j.querySelector('.journey-icon'); if(i)i.textContent=running?'Ⅱ':'▶';
    }
    updateJourneyContext(id,pct);
    if(story.active){
      requestAnimationFrame(()=>{
        updateStory(id,pct);
        renderStoryOverlay(id);
      });
    }
  }

  function updateJourneyContext(id,pct){
    if(document.body.classList.contains('platform-regional-trip'))return;
    const box=$('#detailContent'); if(!box)return;
    let card=$('.journey-context',box);
    if(!card){card=document.createElement('div');card.className='journey-context';box.appendChild(card);}
    const phase=phaseFor(id);
    const country=new URLSearchParams(location.search).get('country');
    card.innerHTML=`<div class="journey-context-top"><span>${country?'Route context':'Journey position'}</span><b>${id} / 194</b></div><div class="journey-context-track"><i></i></div><div class="journey-context-note"><span>Current chapter</span><strong>${phase.title}</strong></div>`;
  }

  function ensureExploreRoute(){
    const explore=$('.mode-switch button[data-mode="explore"]');
    if(explore && !explore.classList.contains('active')) explore.click();
    const route=$('#layerGrid button[data-layer="route"]');
    if(route && !route.classList.contains('active')) route.click();
  }

  function setPhaseFilter(phaseId){
    const button=$(`#phaseRail button[data-phase="${phaseId}"]`);
    if(button?.classList.contains('active'))return;
    if(window.__ONE_WORLD_ROUTE_APP__?.setPhase){
      window.__ONE_WORLD_ROUTE_APP__.setPhase(phaseId,{jump:false,focus:false});
      return;
    }
    if(button) button.click();
  }

  function setControlValue(selector,value,eventName){
    const el=$(selector); if(!el)return;
    if(el.type==='checkbox')el.checked=Boolean(value); else el.value=String(value);
    el.dispatchEvent(new Event(eventName,{bubbles:true}));
  }

  async function startStory(){
    clearTimeout(story.completionTimer);
    story.active=true; story.phaseId=null;
    document.body.classList.add('story-mode');
    ensureExploreRoute();
    await loadStoryData();
    ensureStoryOverlay();

    const width=$('#arcWidth'),points=$('#showPoints'),rotate=$('#autoRotate');
    story.restore.arcWidth=width?.value??null;
    story.restore.showPoints=points?.checked??null;
    story.restore.autoRotate=rotate?.checked??null;
    setControlValue('#arcWidth',0.12,'input');
    setControlValue('#showPoints',false,'change');
    setControlValue('#autoRotate',false,'change');

    const startId=currentSegmentId();
    setTimeout(()=>{
      setPhaseFilter(phaseFor(startId).id);
      syncProgress();
      const play=$('#playBtn');
      if(play && play.textContent.trim()==='▶')play.click();
    },90);
  }

  function stopStory(){
    clearTimeout(story.completionTimer);
    story.active=false; story.phaseId=null;
    document.body.classList.remove('story-mode');
    clearStoryOverlay();
    const play=$('#playBtn');
    if(play && play.textContent.trim()!=='▶')play.click();
    if(story.restore.arcWidth!==null)setControlValue('#arcWidth',story.restore.arcWidth,'input');
    if(story.restore.showPoints!==null)setControlValue('#showPoints',story.restore.showPoints,'change');
    if(story.restore.autoRotate!==null)setControlValue('#autoRotate',story.restore.autoRotate,'change');
    syncProgress();
  }

  function updateStory(id,pct){
    const phase=phaseFor(id);
    if(story.phaseId!==phase.id){
      story.phaseId=phase.id;
      setTimeout(()=>setPhaseFilter(phase.id),0);
    }
    const seg=story.routeData?.segments?.find(s=>s.id===id);
    const route=seg?`${seg.displayFrom||EN.country(seg.from)} → ${seg.displayTo||EN.country(seg.to)}`:($('#timelineTitle')?.textContent?.trim()||`Segment ${id}`);
    const kicker=$('#storyKicker'),title=$('#storyTitle'),routeEl=$('#storyRoute'),note=$('#storyNote'),pctEl=$('#storyPct');
    if(kicker)kicker.textContent=`CHAPTER ${String(phase.id).padStart(2,'0')} / 12`;
    if(title)title.textContent=phase.title;
    if(routeEl)routeEl.textContent=route;
    if(note)note.textContent=phase.note;
    if(pctEl)pctEl.textContent=`${Math.round(pct)}%`;

    if(id===194){
      clearTimeout(story.completionTimer);
      story.completionTimer=setTimeout(()=>{
        if(!story.active)return;
        const play=$('#playBtn');if(play&&play.textContent.trim()!=='▶')play.click();
        if(kicker)kicker.textContent='JOURNEY COMPLETE';
        if(title)title.textContent='195 countries. One route.';
        if(note)note.textContent='The planned continuous route returns to Germany.';
        if(pctEl)pctEl.textContent='100%';
      },160);
    }
  }

  function wireObservers(){
    $$('.mode-switch button').forEach(b=>b.addEventListener('click',()=>setTimeout(syncMode,0)));
    $('#routeRange')?.addEventListener('input',()=>setTimeout(syncProgress,0));
    $('#playBtn')?.addEventListener('click',()=>setTimeout(syncProgress,0));
    const p=$('#playBtn');if(p)new MutationObserver(()=>setTimeout(syncProgress,0)).observe(p,{childList:true,characterData:true,subtree:true});
    const timelineTitle=$('#timelineTitle');if(timelineTitle)new MutationObserver(()=>setTimeout(syncProgress,0)).observe(timelineTitle,{childList:true,characterData:true,subtree:true});
    const detail=$('#detailContent');if(detail)new MutationObserver(()=>setTimeout(syncProgress,0)).observe(detail,{childList:true});

    document.addEventListener('keydown',e=>{
      if(document.body.classList.contains('platform-regional-trip'))return;
      if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
      if(e.key==='ArrowLeft'){e.preventDefault();$('#prevBtn')?.click();}
      if(e.key==='ArrowRight'){e.preventDefault();$('#nextBtn')?.click();}
      if(e.key==='Escape'&&story.active){e.preventDefault();stopStory();}
    });
  }

  function tuneGlobeDensity(){
    const width=$('#arcWidth');
    if(width&&!width.dataset.iteration2Tuned){
      width.dataset.iteration2Tuned='1';width.value='0.34';width.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }

  function init(){
    ensureStoryStyles();ensureControls();syncMode();syncProgress();wireObservers();
    setTimeout(()=>{tuneGlobeDensity();loadStoryData();},300);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== iteration5.js ===== */
(() => {
  'use strict';

  const PHASES = [
    {id:1,range:[1,29],title:'Europe I',note:'The journey begins across Europe.'},
    {id:2,range:[30,39],title:'North & Central America',note:'Across the Atlantic into North America.'},
    {id:3,range:[40,52],title:'Caribbean',note:'Island connections and short regional hops.'},
    {id:4,range:[53,64],title:'South America',note:'A continuous line through South America.'},
    {id:5,range:[65,78],title:'South Pacific',note:'The route opens into the Pacific.'},
    {id:6,range:[79,95],title:'Southeast Asia & Indian Ocean',note:'Dense regional links and island crossings.'},
    {id:7,range:[96,112],title:'East & Central Asia',note:'Long-distance transitions across Asia.'},
    {id:8,range:[113,120],title:'Levant & North Africa',note:'A compact but operationally complex chapter.'},
    {id:9,range:[121,145],title:'West & Central Africa',note:'Overland and air corridors across West Africa.'},
    {id:10,range:[146,169],title:'Southern & East Africa',note:'The route turns south, then back north-east.'},
    {id:11,range:[170,181],title:'Gulf & Levant',note:'The final Middle East sequence.'},
    {id:12,range:[182,194],title:'Europe II · Finish',note:'The closing run back to Germany.'}
  ];

  const EN=window.ONE_WORLD_EN||{registerCountries(){},country:s=>s,mode:s=>s,text:s=>s,value:s=>s};
  const runtime={
    route:null,
    countries:new Map(),
    lastSegment:null,
    lastPhase:null,
    arrivalTimer:null,
    chapterTimer:null,
    urlTimer:null,
    restoringStory:false,
    rendererPixelRatio:null,
    storyActive:false
  };

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const segmentId=()=>clamp(Number($('#routeRange')?.value||1),1,194);
  const phaseFor=id=>PHASES.find(p=>id>=p.range[0]&&id<=p.range[1])||PHASES[0];
  const isStory=()=>document.body.classList.contains('story-mode');
  const isMobile=()=>window.matchMedia('(max-width:820px)').matches;
  const excelDate=v=>v?new Date(Date.UTC(1899,11,30)+Number(v)*86400000):null;
  const fmtDate=v=>{const d=excelDate(v);return d?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d):'—'};
  const dayFromStart=v=>{const d=excelDate(v),s=new Date(Date.UTC(2026,9,21));return d?Math.max(1,Math.round((d-s)/86400000)+1):null};
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function ensureStyles(){
    if(document.querySelector('#appBundleCss')||document.querySelector('link[data-iteration5]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='./iteration5.css';link.dataset.iteration5='1';
    document.head.appendChild(link);
  }

  async function loadData(){
    if(runtime.route)return runtime.route;
    try{
      const [routeRes,countryRes]=await Promise.all([
        fetch('./data/public-route.json',{cache:'force-cache'}),
        fetch('./data/country-centroids.json',{cache:'force-cache'})
      ]);
      const route=await routeRes.json();
      const countries=await countryRes.json();
      EN.registerCountries(countries||[]);
      const countryMap=new Map((countries||[]).map(c=>[c.name,c]));
      route.segments=(route.segments||[]).map(s=>{
        const a=countryMap.get(s.from),b=countryMap.get(s.to);
        return {...s,displayFrom:EN.country(s.from,a?.cca2),displayTo:EN.country(s.to,b?.cca2),displayMode:EN.mode(s.mode)};
      });
      runtime.route=route;
      runtime.countries=new Map((countries||[]).map(c=>[c.name,{...c,displayName:EN.country(c.name,c.cca2)}]));
      return route;
    }catch(err){
      console.warn('Iteration 5 story data unavailable',err);
      runtime.route={segments:[]};
      return runtime.route;
    }
  }

  function currentSegment(){
    return runtime.route?.segments?.find(s=>Number(s.id)===segmentId())||null;
  }

  function activeSpeed(){
    return clamp(Number($('.speed-control button.active')?.dataset.speed||700),220,1600);
  }

  function isAutoPlaying(){
    return $('#playBtn')?.textContent?.trim()==='Ⅱ';
  }

  function ensureStoryChrome(){
    const stage=$('.globe-stage');
    if(!stage)return;

    if(!$('#chapterTransition')){
      const el=document.createElement('section');
      el.id='chapterTransition';el.className='chapter-transition';el.setAttribute('aria-live','polite');
      el.innerHTML='<div class="chapter-transition-inner"><span id="chapterTransitionKicker"></span><strong id="chapterTransitionTitle"></strong><small id="chapterTransitionNote"></small></div>';
      stage.appendChild(el);
    }

    if(!$('#arrivalMoment')){
      const el=document.createElement('section');
      el.id='arrivalMoment';el.className='arrival-moment';el.setAttribute('aria-live','polite');
      stage.appendChild(el);
    }

    const hud=$('#storyHud');
    if(hud&&!$('#storySegmentMeta',hud)){
      const route=$('#storyRoute',hud);
      const meta=document.createElement('div');
      meta.id='storySegmentMeta';meta.className='story-segment-meta';
      route?.insertAdjacentElement('afterend',meta);
    }

    const timeline=$('#timeline');
    if(timeline&&!$('#storyMissionMeta',timeline)){
      const meta=document.createElement('div');
      meta.id='storyMissionMeta';meta.className='story-mission-meta';
      meta.innerHTML='<span><i>DAY</i><b id="storyDayValue">1</b></span><span><i>COUNTRY</i><b id="storyCountryValue">2 / 195</b></span><span><i>CHAPTER</i><b id="storyChapterValue">1 / 12</b></span><span><i>CHAPTER PROGRESS</i><b id="storyChapterProgress">1 / 29</b></span>';
      timeline.appendChild(meta);
    }

    const wrap=$('.range-wrap',timeline||document);
    if(wrap&&!$('#storyChapterTicks',wrap)){
      const ticks=document.createElement('div');
      ticks.id='storyChapterTicks';ticks.className='story-chapter-ticks';
      ticks.innerHTML=PHASES.map(p=>`<i style="left:${((p.range[0]-1)/193)*100}%" title="${escapeHtml(p.title)}"></i>`).join('');
      wrap.appendChild(ticks);
    }
  }

  function updateHudContext(){
    if(!isStory())return;
    const seg=currentSegment();if(!seg)return;
    const phase=phaseFor(seg.id);
    const day=dayFromStart(seg.planDeparture)||'—';
    const country=runtime.countries.get(seg.to);
    const phaseIndex=seg.id-phase.range[0]+1;
    const phaseTotal=phase.range[1]-phase.range[0]+1;

    const meta=$('#storySegmentMeta');
    if(meta)meta.innerHTML=`<span>${escapeHtml(seg.displayMode||EN.mode(seg.mode)||'Route')}</span><i></i><span>${fmtDate(seg.planDeparture)}</span><i></i><span>Day ${day}</span>`;
    const dayEl=$('#storyDayValue'),countryEl=$('#storyCountryValue'),chapterEl=$('#storyChapterValue'),chapterProgress=$('#storyChapterProgress');
    if(dayEl)dayEl.textContent=String(day);
    if(countryEl)countryEl.textContent=`${country?.number||Math.min(195,seg.id+1)} / 195`;
    if(chapterEl)chapterEl.textContent=`${phase.id} / 12`;
    if(chapterProgress)chapterProgress.textContent=`${phaseIndex} / ${phaseTotal}`;
  }

  function flagMarkup(country){
    const code=String(country?.cca2||'').toLowerCase();
    if(/^[a-z]{2}$/.test(code))return `<img class="arrival-flag-img" src="https://flagcdn.com/48x36/${code}.png" alt="${escapeHtml(country.displayName||EN.country(country.name,country.cca2)||'Country')} flag" width="32" height="24" loading="eager">`;
    return '<span class="arrival-flag-fallback">◎</span>';
  }

  function showArrival(seg){
    if(!isStory()||runtime.restoringStory)return;
    // Automatic playback only shows arrivals at 1×. At 2×/5× the globe and route remain the focus.
    if(isAutoPlaying()&&activeSpeed()<1200)return;
    const box=$('#arrivalMoment');if(!box)return;
    const country=runtime.countries.get(seg.to)||{};
    const day=dayFromStart(seg.planArrival||seg.planDeparture)||'—';
    box.innerHTML=`<span class="arrival-flag">${flagMarkup({...country,name:seg.to})}</span><div><small>ARRIVAL · COUNTRY ${country.number||Math.min(195,seg.id+1)} / 195</small><strong>${escapeHtml(seg.displayTo||EN.country(seg.to,country.cca2))}</strong><em>${escapeHtml(seg.displayMode||EN.mode(seg.mode)||'Route')} · ${fmtDate(seg.planArrival||seg.planDeparture)} · Day ${day}</em></div>`;
    box.classList.remove('show');void box.offsetWidth;box.classList.add('show');
    clearTimeout(runtime.arrivalTimer);
    runtime.arrivalTimer=setTimeout(()=>box.classList.remove('show'),Math.min(1200,Math.max(780,activeSpeed()*.72)));
  }

  function showChapterTransition(phase){
    if(!isStory()||runtime.restoringStory)return;
    const box=$('#chapterTransition');if(!box)return;
    $('#chapterTransitionKicker').textContent=`CHAPTER ${String(phase.id).padStart(2,'0')} / 12`;
    $('#chapterTransitionTitle').textContent=phase.title;
    $('#chapterTransitionNote').textContent=phase.note;
    box.classList.remove('show');void box.offsetWidth;box.classList.add('show');
    clearTimeout(runtime.chapterTimer);
    runtime.chapterTimer=setTimeout(()=>box.classList.remove('show'),1100);
  }

  function updateStoryUrl(){
    clearTimeout(runtime.urlTimer);
    runtime.urlTimer=setTimeout(()=>{
      const p=new URLSearchParams(location.search);
      p.set('segment',String(segmentId()));
      if(isStory())p.set('story','1');else p.delete('story');
      history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
    },0);
  }

  function tuneGlobeForStory(active){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;if(!globe)return;
    try{
      if(active){
        globe.atmosphereColor?.('#5b8dff');
        globe.atmosphereAltitude?.(.16);
        globe.polygonStrokeColor?.(()=> 'rgba(121,154,193,.12)');
      }else{
        globe.atmosphereColor?.('#4e8cff');
        globe.atmosphereAltitude?.(.13);
        globe.polygonStrokeColor?.(()=> 'rgba(135,166,201,.18)');
      }
    }catch{}

    try{
      const renderer=globe.renderer?.();
      if(!renderer)return;
      if(runtime.rendererPixelRatio===null&&typeof renderer.getPixelRatio==='function')runtime.rendererPixelRatio=renderer.getPixelRatio();
      if(active&&isMobile())renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));
      else if(runtime.rendererPixelRatio!==null)renderer.setPixelRatio(runtime.rendererPixelRatio);
    }catch{}
  }

  function onSegmentChanged(){
    if(!isStory())return;
    const id=segmentId();
    const seg=currentSegment();if(!seg)return;
    const phase=phaseFor(id);
    const previousPhase=runtime.lastPhase;
    const changed=id!==runtime.lastSegment;
    const phaseChanged=previousPhase!==null&&previousPhase!==phase.id;

    updateHudContext();
    updateStoryUrl();

    if(changed){
      if(phaseChanged)showChapterTransition(phase);
      else if(runtime.lastSegment!==null)showArrival(seg);
      runtime.lastSegment=id;
      runtime.lastPhase=phase.id;
    }
  }

  function enterStory(){
    runtime.storyActive=true;
    runtime.lastSegment=null;
    runtime.lastPhase=phaseFor(segmentId()).id;
    document.body.classList.add('cinematic-story');
    tuneGlobeForStory(true);
    ensureStoryChrome();
    updateHudContext();
    updateStoryUrl();
  }

  function exitStory(){
    runtime.storyActive=false;
    document.body.classList.remove('cinematic-story');
    $('#arrivalMoment')?.classList.remove('show');
    $('#chapterTransition')?.classList.remove('show');
    tuneGlobeForStory(false);
    updateStoryUrl();
  }

  async function restoreStoryUrl(){
    const p=new URLSearchParams(location.search);
    if(p.get('story')!=='1')return;
    const requested=clamp(Number(p.get('segment')||1),1,194);
    runtime.restoringStory=true;
    let tries=0;
    const start=()=>{
      const btn=$('#journeyBtn');
      if(!btn&&tries++<30){setTimeout(start,80);return}
      if(!btn){runtime.restoringStory=false;return}
      if(!isStory())btn.click();
      setTimeout(()=>{
        const range=$('#routeRange');
        if(range){
          range.value=String(requested);
          range.dispatchEvent(new Event('input',{bubbles:true}));
        }
        setTimeout(()=>{
          runtime.restoringStory=false;
          runtime.lastSegment=requested;
          runtime.lastPhase=phaseFor(requested).id;
          updateHudContext();
          updateStoryUrl();
        },180);
      },220);
    };
    start();
  }

  function wire(){
    ensureStoryChrome();
    const bodyObserver=new MutationObserver(()=>{
      const active=isStory();
      if(active&&!runtime.storyActive)enterStory();
      else if(!active&&runtime.storyActive)exitStory();
    });
    bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});

    $('#routeRange')?.addEventListener('input',()=>setTimeout(onSegmentChanged,0));
    $('#playBtn')?.addEventListener('click',()=>setTimeout(updateHudContext,0));
    $$('.speed-control button').forEach(b=>b.addEventListener('click',()=>setTimeout(updateHudContext,0)));

    const title=$('#timelineTitle');
    if(title)new MutationObserver(()=>setTimeout(onSegmentChanged,0)).observe(title,{childList:true,subtree:true,characterData:true});

    window.addEventListener('resize',()=>{if(isStory())tuneGlobeForStory(true)},{passive:true});
  }

  async function init(){
    ensureStyles();
    await loadData();
    wire();
    restoreStoryUrl();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
