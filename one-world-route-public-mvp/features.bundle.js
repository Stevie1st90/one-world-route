/* ONE WORLD ROUTE feature runtime bundle. */

/* ===== iteration6.js ===== */
(() => {
  'use strict';

  const runtime={data:null,segments:[],selectedId:1,observer:null,renderFrame:null};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const excelDate=v=>v?new Date(Date.UTC(1899,11,30)+Number(v)*86400000):null;
  const euro=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v||0));
  const now=new Date(Date.UTC(2026,8,17));
  const EN=window.ONE_WORLD_EN||{country:s=>s,mode:s=>s,text:s=>s,value:s=>s};
  const routeLabel=s=>`${s.displayFrom||EN.country(s.from)} → ${s.displayTo||EN.country(s.to)}`;

  function ensureStyles(){
    if(document.querySelector('#appBundleCss')||document.querySelector('link[data-iteration6]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='./iteration6.css';link.dataset.iteration6='1';document.head.appendChild(link);
  }

  async function loadData(){
    if(runtime.data)return runtime.data;
    try{
      const [r,c]=await Promise.all([
        fetch('./data/public-route.json',{cache:'force-cache'}),
        fetch('./data/country-centroids.json',{cache:'force-cache'})
      ]);
      runtime.data=await r.json();
      const countries=await c.json();
      EN.registerCountries?.(countries||[]);
      runtime.segments=runtime.data.segments||[];
      return runtime.data;
    }catch(err){console.warn('Iteration 6 operations data unavailable',err);runtime.data={segments:[]};return runtime.data;}
  }

  function score(s){
    let x={A:30,B:20,C:10,D:5,E:4}[s.bookingTier]||5;
    if(s.feasibility==='Kritisch')x+=30;else if(s.feasibility==='Bedingt')x+=15;
    if(s.alertLevel==='RED')x+=35;else if(s.alertLevel==='ORANGE')x+=24;else if(s.alertLevel==='WATCH')x+=9;
    if(s.dataQuality&&!/verifiziert/i.test(s.dataQuality))x+=12;
    if(/Nauru|Tuvalu|Marshall|Mikronesien|Palau|Haiti|Syrien|Jemen|Sudan|Somalia/i.test(`${s.from} ${s.to}`))x+=9;
    return x;
  }

  function freshness(s){
    const d=excelDate(s.lastVerified);
    if(!d)return {key:'unknown',label:'Unverified date',age:null};
    const age=Math.max(0,Math.round((now-d)/86400000));
    if(age<=7)return {key:'fresh',label:`Verified ${age}d ago`,age};
    if(age<=30)return {key:'watch',label:`Verified ${age}d ago`,age};
    return {key:'stale',label:`Verified ${age}d ago`,age};
  }

  function riskReasons(s){
    const reasons=[];
    if(s.feasibility==='Kritisch')reasons.push('Critical feasibility');
    else if(s.feasibility==='Bedingt')reasons.push('Conditional feasibility');
    if(['RED','ORANGE'].includes(s.alertLevel))reasons.push(`${s.alertLevel} alert`);
    if(s.bookingTier==='A'||s.bookingTier==='B')reasons.push(`Booking tier ${s.bookingTier}`);
    if(!/verifiziert/i.test(s.dataQuality||''))reasons.push('Evidence needs review');
    const routeRisk=['Kritisch','Bedingt'].includes(s.feasibility)||['RED','ORANGE'].includes(s.alertLevel)||['A','B'].includes(s.bookingTier);
    if(!s.planB&&routeRisk)reasons.push('No specific fallback');
    if(/pending|block/i.test(s.visaStatusTarget||''))reasons.push('Visa dependency');
    if(Number(s.healthPriorityTarget)>=4)reasons.push('Health dependency');
    if(Number(s.transportBudgetEur||0)>=600)reasons.push('High-cost leg');
    const f=freshness(s);if(f.key==='stale'||f.key==='unknown')reasons.push(f.label);
    return reasons;
  }

  function topCritical(){return [...runtime.segments].sort((a,b)=>score(b)-score(a)).slice(0,20)}
  function selected(){return runtime.segments.find(s=>Number(s.id)===runtime.selectedId)||runtime.segments[0]}
  function cumulativeBudget(id){return runtime.segments.filter(s=>Number(s.id)<=id).reduce((a,s)=>a+Number(s.transportBudgetEur||0),0)}
  function transportBudget(){return runtime.segments.reduce((a,s)=>a+Number(s.transportBudgetEur||0),0)}

  function dependencyWindow(id){
    return runtime.segments.filter(s=>Math.abs(Number(s.id)-id)<=2).map(s=>({s,reasons:riskReasons(s)})).filter(x=>x.reasons.length);
  }

  function breakCategories(){
    const cats={Border:0,Visa:0,Booking:0,Evidence:0,Fallback:0,Health:0,Cost:0};
    runtime.segments.forEach(s=>{
      const operationalRisk=['Kritisch','Bedingt'].includes(s.feasibility)||['RED','ORANGE'].includes(s.alertLevel)||['A','B'].includes(s.bookingTier);
      if(['Kritisch','Bedingt'].includes(s.feasibility)||['RED','ORANGE'].includes(s.alertLevel))cats.Border++;
      if(/pending|block/i.test(s.visaStatusTarget||''))cats.Visa++;
      if(['A','B'].includes(s.bookingTier))cats.Booking++;
      if(!/verifiziert/i.test(s.dataQuality||'')&&operationalRisk)cats.Evidence++;
      if(!s.planB&&operationalRisk)cats.Fallback++;
      if(Number(s.healthPriorityTarget)>=4)cats.Health++;
      if(Number(s.transportBudgetEur||0)>=600)cats.Cost++;
    });
    return Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  }

  function freshnessSummary(){
    const out={fresh:0,watch:0,stale:0,unknown:0};runtime.segments.forEach(s=>out[freshness(s).key]++);return out;
  }

  function sparkline(){
    const total=transportBudget()||1;let running=0;
    const pts=runtime.segments.map((s,i)=>{running+=Number(s.transportBudgetEur||0);return `${(i/(Math.max(1,runtime.segments.length-1))*100).toFixed(2)},${(30-(running/total)*26).toFixed(2)}`}).join(' ');
    return `<svg class="ops-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-label="Cumulative transport budget"><polyline points="0,30 ${pts}" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function ensureBoard(){
    const left=$('#leftPanel');if(!left)return null;
    let board=$('#opsIntelligence',left);
    if(!board){
      board=document.createElement('section');board.id='opsIntelligence';board.className='ops-intelligence panel-section';
      const switcher=$('.mode-switch',left);switcher?.insertAdjacentElement('afterend',board);
    }
    return board;
  }

  function renderBoard(){
    const board=ensureBoard();if(!board)return;
    const ops=$('.mode-switch button[data-mode="operations"]')?.classList.contains('active');
    board.classList.toggle('is-visible',Boolean(ops));
    document.body.classList.toggle('operations-intelligence',Boolean(ops));
    if(!ops)return;

    const top=topCritical();const fresh=freshnessSummary();const cats=breakCategories();const tb=transportBudget();const high=top[0];
    board.innerHTML=`
      <div class="ops-head"><span>OPERATIONS INTELLIGENCE</span><b>Mission control</b></div>
      <div class="ops-score-row">
        <button class="ops-score" data-action="critical"><strong>${top.length}</strong><span>critical path</span></button>
        <div class="ops-score"><strong>${fresh.fresh}</strong><span>fresh ≤7d</span></div>
        <div class="ops-score"><strong>${fresh.unknown+fresh.stale}</strong><span>needs review</span></div>
      </div>
      <button class="ops-primary" data-action="critical">View global critical path <span>›</span></button>
      <div class="ops-mini-title">Flagged route conditions</div>
      <div class="ops-break-grid">${cats.slice(0,4).map(([k,v])=>`<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>
      <div class="ops-budget"><div><span>TRANSPORT MODEL</span><b>${euro(tb)}</b></div>${sparkline()}</div>
      ${high?`<button class="ops-hotspot" data-segment="${high.id}"><span>HIGHEST ROUTE CONSTRAINT</span><b>#${high.id} ${esc(routeLabel(high))}</b><small>${esc(riskReasons(high).slice(0,2).join(' · ')||'Review route')}</small></button>`:''}
    `;
    bindBoardActions(board);
  }

  function appendSelectedIntelligence(){
    const ops=$('.mode-switch button[data-mode="operations"]')?.classList.contains('active');if(!ops)return;
    if(new URLSearchParams(location.search).has('country')){ $('#selectedOpsIntel')?.remove(); return; }
    const box=$('#detailContent');if(!box||$('#selectedOpsIntel',box))return;
    const s=selected();if(!s)return;
    const f=freshness(s),reasons=riskReasons(s),deps=dependencyWindow(s.id),cum=cumulativeBudget(s.id),total=transportBudget()||1;
    const panel=document.createElement('section');panel.id='selectedOpsIntel';panel.className='selected-ops-intel';
    panel.innerHTML=`
      <div class="ops-mini-title">Operational intelligence</div>
      <div class="ops-selected-kpis">
        <div><span>Constraint score</span><b>${score(s)}</b></div>
        <div class="fresh-${f.key}"><span>Data freshness</span><b>${esc(f.label)}</b></div>
        <div><span>Budget progression</span><b>${Math.round(cum/total*100)}%</b></div>
      </div>
      <div class="ops-progress"><i style="width:${Math.min(100,cum/total*100)}%"></i></div>
      <div class="ops-reasons">${reasons.length?reasons.slice(0,5).map(r=>`<span>${esc(r)}</span>`).join(''):'<span class="positive">No major public constraint flag</span>'}</div>
      <div class="ops-mini-title">Dependency window · ±2 legs</div>
      <div class="ops-dependencies">${deps.length?deps.map(({s:x,reasons:r})=>`<button data-segment="${x.id}"><b>#${x.id} ${esc(routeLabel(x))}</b><small>${esc(r.slice(0,2).join(' · '))}</small></button>`).join(''):'<div class="ops-empty">No adjacent flagged dependency in this window.</div>'}</div>
    `;
    box.appendChild(panel);
    $$('[data-segment]',panel).forEach(b=>b.onclick=()=>jump(Number(b.dataset.segment)));
  }

  function showGlobalCriticalPath(){
    const reset=$('#clearFilters');
    const critical=$('#layerGrid button[data-layer="critical"]');
    if(reset)reset.click();
    setTimeout(()=>{
      critical?.click();
      if(window.innerWidth<=820)$('#leftPanel')?.classList.remove('mobile-open');
    },0);
  }

  function bindBoardActions(board){
    $$('[data-action="critical"]',board).forEach(b=>b.onclick=showGlobalCriticalPath);
    $$('[data-segment]',board).forEach(b=>b.onclick=()=>jump(Number(b.dataset.segment)));
  }

  function jump(id){
    const range=$('#routeRange');if(!range)return;range.value=String(id);range.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(()=>$('#rightPanel')?.classList.add('mobile-open'),40);
  }

  function sync(){
    cancelAnimationFrame(runtime.renderFrame);
    runtime.renderFrame=requestAnimationFrame(()=>{
      runtime.selectedId=Math.max(1,Math.min(194,Number($('#routeRange')?.value||1)));
      renderBoard();appendSelectedIntelligence();
    });
  }

  function wire(){
    $('.mode-switch')?.addEventListener('click',()=>setTimeout(sync,0));
    $('#routeRange')?.addEventListener('input',()=>setTimeout(sync,0));
    $('#layerGrid')?.addEventListener('click',()=>setTimeout(sync,0));
    const detail=$('#detailContent');if(detail){runtime.observer=new MutationObserver(()=>setTimeout(appendSelectedIntelligence,0));runtime.observer.observe(detail,{childList:true});}
    sync();
  }

  async function init(){ensureStyles();await loadData();wire();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== iteration7.js ===== */
(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const runtime={launchSegment:null,launchTimer:null,exiting:false,cameraTimer:null};

  function phaseFor(id){
    const ranges=[[1,29],[30,39],[40,52],[53,64],[65,78],[79,95],[96,112],[113,120],[121,145],[146,169],[170,181],[182,194]];
    const i=ranges.findIndex(([a,b])=>id>=a&&id<=b);
    return i<0?1:i+1;
  }

  function finishLaunch(){
    const id=runtime.launchSegment;
    runtime.launchSegment=null;
    document.body.classList.remove('story-launching');
    clearTimeout(runtime.launchTimer);
    if(!id)return;
    const range=$('#routeRange');
    if(range&&Number(range.value)!==id){
      range.value=String(id);
      range.dispatchEvent(new Event('input',{bubbles:true}));
    }
    const phaseId=phaseFor(id);
    if(window.__ONE_WORLD_ROUTE_APP__?.setPhase)window.__ONE_WORLD_ROUTE_APP__.setPhase(phaseId,{jump:false,focus:false});
    else{
      const phase=$(`#phaseRail button[data-phase="${phaseId}"]`);
      if(phase&&!phase.classList.contains('active'))phase.click();
    }
  }

  function launchStoryFromCurrent(e){
    const play=e.target.closest?.('#playBtn');
    if(!play||document.body.classList.contains('story-mode')||runtime.exiting)return;
    const journey=$('#journeyBtn');
    const range=$('#routeRange');
    if(!journey||!range)return;

    e.preventDefault();
    e.stopImmediatePropagation();
    runtime.launchSegment=Math.max(1,Math.min(194,Number(range.value)||1));
    document.body.classList.add('story-launching');
    journey.click();
    clearTimeout(runtime.launchTimer);
    runtime.launchTimer=setTimeout(finishLaunch,180);
  }

  function preserveLaunchPosition(e){
    if(!runtime.launchSegment)return;
    const range=e.target.closest?.('#routeRange');
    if(!range)return;
    if(Number(range.value)!==runtime.launchSegment)range.value=String(runtime.launchSegment);
  }

  function stopPlaybackBeforeExit(e){
    const exit=e.target.closest?.('#storyExit');
    if(!exit||!document.body.classList.contains('story-mode'))return;
    const play=$('#playBtn');
    runtime.exiting=true;
    if(play&&play.textContent.trim()!=='▶')play.click();
    setTimeout(()=>{runtime.exiting=false;},220);
  }

  function tunePlaybackControls(){
    const one=$('.speed-control button[data-speed="1400"], .speed-control button:nth-of-type(1)');
    if(one){
      one.dataset.speed='3000';
      one.title='Cinematic · 3.0 s per segment';
    }
    const auto=$('#autoRotate');
    if(auto)auto.checked=false;
  }

  function installCameraPacing(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    if(!globe||typeof globe.pointOfView!=='function'){
      clearTimeout(runtime.cameraTimer);
      runtime.cameraTimer=setTimeout(installCameraPacing,120);
      return;
    }
    if(globe.__oneWorldIteration7Pacing)return;
    const native=globe.pointOfView.bind(globe);
    globe.pointOfView=function(view,duration,...rest){
      if(arguments.length===0)return native();
      if(document.body.classList.contains('story-mode')){
        const reduced=$('#reducedMotion')?.checked||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(reduced)duration=0;
        else{
          const speed=Number($('.speed-control button.active')?.dataset.speed||700);
          if(speed>=2800)duration=1900;
          else if(speed>=2000)duration=1500;
          else if(speed>=600)duration=Math.max(Number(duration)||0,520);
        }
      }
      return native(view,duration,...rest);
    };
    globe.__oneWorldIteration7Pacing=true;
  }

  function syncPlayMeaning(){
    const play=$('#playBtn');
    if(!play)return;
    const inStory=document.body.classList.contains('story-mode');
    play.setAttribute('aria-label',inStory?'Play or pause journey':'Enter Story mode and play from current position');
    play.title=inStory?'Play / pause journey':'Play journey from here';
  }

  function wire(){
    tunePlaybackControls();
    installCameraPacing();
    document.addEventListener('click',stopPlaybackBeforeExit,true);
    document.addEventListener('click',launchStoryFromCurrent,true);
    document.addEventListener('input',preserveLaunchPosition,true);
    new MutationObserver(syncPlayMeaning).observe(document.body,{attributes:true,attributeFilter:['class']});
    syncPlayMeaning();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

/* ===== iteration8.js ===== */
(() => {
  'use strict';

  const NASA_BMNG = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg';
  const STANDARD_EARTH = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';
  const runtime = { applied:false, retries:0, highDetail:true, preload:null };

  const $=(s,r=document)=>r.querySelector(s);

  function deviceSupportsHighDetail(){
    const saveData = navigator.connection?.saveData === true;
    const memory = Number(navigator.deviceMemory || 8);
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    return !saveData && memory >= (mobile ? 6 : 4);
  }

  function highDetailEnabled(){
    const toggle=$('#highDetailGlobe');
    return Boolean(toggle?.checked && deviceSupportsHighDetail());
  }

  function tuneMaterial(globe){
    try{
      const material = globe.globeMaterial?.();
      if(!material) return;
      if('bumpMap' in material) material.bumpMap = null;
      if('bumpScale' in material) material.bumpScale = 0;

      // Keep texture colours neutral. The previous #8290a0 tint multiplied the NASA
      // texture down and made continents look almost black at close zoom.
      material.color?.set?.('#ffffff');
      material.specular?.set?.('#182532');
      if('shininess' in material) material.shininess = highDetailEnabled() ? 1 : 3;
      material.needsUpdate = true;

      globe.atmosphereColor?.(highDetailEnabled() ? '#78b7ff' : '#5f9cff');
      globe.atmosphereAltitude?.(highDetailEnabled() ? .15 : .13);
    }catch(err){
      console.warn('Globe material tuning unavailable', err);
    }
  }

  function tuneControls(globe){
    try{
      const controls = globe.controls?.();
      if(!controls) return;
      controls.minDistance = highDetailEnabled() ? 132 : 170;
      controls.maxDistance = 520;
      controls.enableDamping = true;
      controls.dampingFactor = .075;
    }catch{}
  }

  function tuneRenderer(globe){
    try{
      const renderer = globe.renderer?.();
      if(!renderer) return;
      const mobile=window.matchMedia('(max-width: 820px)').matches;
      const cap = highDetailEnabled() ? (mobile ? 1.5 : 2) : 1.35;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    }catch{}
  }

  function applyTexture(globe){
    const useHigh=highDetailEnabled();
    runtime.highDetail=useHigh;
    tuneControls(globe);
    tuneRenderer(globe);
    tuneMaterial(globe);

    if(!useHigh){
      try{ globe.globeImageUrl?.(STANDARD_EARTH); }catch{}
      setTimeout(()=>tuneMaterial(globe),120);
      return;
    }

    const img = new Image();
    runtime.preload=img;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if(!highDetailEnabled()) return;
      try{
        globe.globeImageUrl?.(NASA_BMNG);
        setTimeout(() => tuneMaterial(globe), 120);
        setTimeout(() => tuneMaterial(globe), 700);
      }catch(err){
        console.warn('High-detail NASA globe texture could not be applied', err);
      }
    };
    img.onerror = () => console.warn('High-detail NASA globe texture unavailable; keeping standard globe texture.');
    img.src = NASA_BMNG;
  }

  function wireToggle(globe){
    const toggle=$('#highDetailGlobe');
    if(!toggle || toggle.dataset.iteration8Wired) return;
    toggle.dataset.iteration8Wired='1';
    const label=toggle.closest('label')?.querySelector('span');
    if(!deviceSupportsHighDetail()){
      toggle.checked=false;
      toggle.disabled=true;
      toggle.title='High detail is unavailable on this device or connection';
      if(label)label.textContent='High detail globe · unavailable';
    }else{
      toggle.disabled=false;
      if(label)label.textContent='High detail globe';
    }
    toggle.addEventListener('change',()=>applyTexture(globe));
  }

  function applyHighDetail(globe){
    if(!globe) return;
    runtime.applied = true;
    wireToggle(globe);
    applyTexture(globe);
  }

  function findGlobe(){
    const globe = window.__ONE_WORLD_ROUTE_GLOBE__;
    if(globe){
      applyHighDetail(globe);
      return;
    }
    if(runtime.retries++ < 80) setTimeout(findGlobe, 100);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(findGlobe, 0));
  } else {
    setTimeout(findGlobe, 0);
  }
})();


/* ===== iteration9.js ===== */
(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const runtime={
    globe:null,outlineReady:false,terrainMap:null,terrainReady:false,terrainBaseReady:false,
    terrainActive:false,terrainRequested:false,routeData:null,centroids:null,routeWaypoints:new Map(),loadPromise:null,
    selectedId:1,terrainFailTimer:null,criticalIds:new Set(),highDetailWasDisabled:null,
    phaseFocusTimer:null,pendingPhaseFocus:null
  };

  const PHASE_COLORS={1:'#149fc4',2:'#315eea',3:'#12a887',4:'#2f9f5e',5:'#6743d9',6:'#b84ad8',7:'#d39418',8:'#dc6d22',9:'#de4f37',10:'#d9324d',11:'#cf4c98',12:'#3e78db'};
  const COLORS={cyan:'#59ddff',blue:'#4f7cff',violet:'#9276ff',amber:'#ffbf5a',orange:'#ff7a45',red:'#ff4d67',green:'#65e5a7',muted:'#526277'};

  function ensureStyles(){
    if($('#iteration9Styles'))return;
    const style=document.createElement('style');
    style.id='iteration9Styles';
    style.textContent=`
      #terrainMap{display:none;position:absolute;inset:0;z-index:3;background:#071019}
      body.terrain-loading #terrainMap{display:block;opacity:0;pointer-events:none}
      body.terrain-view #terrainMap{display:block;opacity:1}
      body.terrain-view #globe{visibility:hidden}
      body.terrain-view .globe-stage:before,body.terrain-view .globe-stage:after{display:none!important}
      body.terrain-view .journey-btn,body.terrain-view .floating-stats{opacity:0;pointer-events:none}
      body.terrain-view .left-panel,body.terrain-view .right-panel{background:rgba(7,14,24,.88);border-color:rgba(145,179,211,.18);backdrop-filter:blur(22px)}
      body.terrain-view .settings-popover{background:rgba(7,14,24,.94);border-color:rgba(145,179,211,.18)}
      .terrain-badge{display:none;position:absolute;z-index:24;left:50%;bottom:24px;transform:translateX(-50%);padding:8px 12px;border:1px solid rgba(89,221,255,.22);border-radius:12px;background:rgba(7,14,24,.9);backdrop-filter:blur(14px);font-size:8px;letter-spacing:.06em;color:#92a8bd;white-space:nowrap;pointer-events:none;box-shadow:0 8px 28px rgba(0,0,0,.2)}
      body.terrain-loading .terrain-badge,body.terrain-view .terrain-badge{display:block}
      .terrain-badge b{color:#dff8ff;margin-right:7px;letter-spacing:.12em}
      body.terrain-view .maplibregl-ctrl-group{background:rgba(248,250,251,.97);border:1px solid rgba(25,55,75,.14);box-shadow:0 4px 18px rgba(0,0,0,.12)}
      body.terrain-view .maplibregl-ctrl button{filter:none}
      body.terrain-view .maplibregl-ctrl-attrib{background:rgba(7,14,24,.82);color:#91a6ba;font-size:9px}
      body.terrain-view .maplibregl-ctrl-attrib a{color:#b7d0e4}
      body.terrain-view .phase-rail{background:rgba(7,14,24,.82);border-color:rgba(145,179,211,.16);box-shadow:0 8px 24px rgba(0,0,0,.16)}
      body.terrain-view .phase-rail button{color:#8499af}
      body.terrain-view .phase-rail button.active{background:rgba(255,255,255,.08);color:#eef8ff}
      @media(max-width:820px){
        body.terrain-loading .terrain-badge,body.terrain-view .terrain-badge{display:none!important}
        body.terrain-view .maplibregl-ctrl-top-right{display:none!important}
        body.terrain-view .maplibregl-ctrl-bottom-right{bottom:4px}
      }
    `;
    document.head.appendChild(style);
  }

  function setToggleState(active){const t=$('#terrainView');if(t)t.checked=Boolean(active)}
  function setTerrainLabel(text){const t=$('#terrainView');const span=t?.closest('label')?.querySelector('span');if(span)span.textContent=text}

  function notify(message){
    const toast=$('#toast');if(!toast)return;
    toast.textContent=message;toast.classList.add('show');clearTimeout(toast._terrainTimer);
    toast._terrainTimer=setTimeout(()=>toast.classList.remove('show'),3200);
  }

  function updateViewUrl(active){
    const p=new URLSearchParams(location.search);
    if(active)p.set('view','terrain');else p.delete('view');
    history.replaceState(null,'',`${location.pathname}${p.toString()?`?${p}`:''}`);
  }

  function urlSegmentId(){
    const raw=new URLSearchParams(location.search).get('segment');
    if(raw===null)return null;
    const n=Number(raw);return Number.isFinite(n)?clamp(Math.round(n),1,194):null;
  }

  function currentSegmentId(){
    const range=$('#routeRange');
    if(range&&range.value!=='')return clamp(Number(range.value)||1,1,194);
    const fromUrl=urlSegmentId();
    return fromUrl!==null?fromUrl:1;
  }

  function syncSliderFromUrl(){
    const id=urlSegmentId(),range=$('#routeRange');
    if(id===null||!range||Number(range.value)===id)return;
    range.value=String(id);range.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function ensureTerrainUi(){
    const stage=$('.globe-stage');
    if(stage&&!$('#terrainMap')){
      const map=document.createElement('div');map.id='terrainMap';stage.appendChild(map);
      const badge=document.createElement('div');badge.className='terrain-badge';badge.innerHTML='<b>3D GLOBE TERRAIN</b><span>Loading terrain…</span>';stage.appendChild(badge);
    }
    const settings=$('#settingsPopover');
    if(settings&&!$('#terrainView')){
      const label=document.createElement('label');
      label.innerHTML='<span>Real 3D globe terrain</span><input id="terrainView" type="checkbox" title="Switch to a spherical globe with real elevation terrain">';
      const high=$('#highDetailGlobe')?.closest('label');
      if(high)high.insertAdjacentElement('afterend',label);else settings.appendChild(label);
    }
    const toggle=$('#terrainView');
    if(toggle&&!toggle.dataset.terrainWired){
      toggle.dataset.terrainWired='1';toggle.checked=false;
      toggle.addEventListener('change',()=>setTerrainMode(toggle.checked));
    }
  }

  function geometryToPaths(feature){
    const geometry=feature?.geometry;if(!geometry)return[];
    const out=[];
    const pushRing=ring=>{
      if(!Array.isArray(ring)||ring.length<2)return;
      out.push({name:feature.properties?.name||'',points:ring.map(c=>({lng:Number(c[0]),lat:Number(c[1])})).filter(p=>Number.isFinite(p.lng)&&Number.isFinite(p.lat))});
    };
    if(geometry.type==='Polygon')geometry.coordinates.forEach(pushRing);
    else if(geometry.type==='MultiPolygon')geometry.coordinates.forEach(poly=>poly.forEach(pushRing));
    return out;
  }

  async function installArtifactFreeBorders(globe){
    if(runtime.outlineReady||!globe)return;
    runtime.outlineReady=true;
    globe.__oneWorldArtifactFreeBorders=true;
    try{
      const response=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',{cache:'force-cache'});
      if(!response.ok)throw new Error(String(response.status));
      const geo=await response.json();
      const paths=(geo.features||[]).flatMap(geometryToPaths).filter(p=>p.points.length>1);
      globe.pathsData(paths).pathPoints('points').pathPointLat('lat').pathPointLng('lng')
        .pathColor(()=>document.body.classList.contains('story-mode')?'rgba(166,192,221,.24)':'rgba(151,184,218,.62)')
        .pathStroke(.24).pathAltitude(.0018).pathResolution(1.25).pathTransitionDuration(0);
    }catch(err){console.warn('Artifact-free country outlines unavailable',err);}
  }

  function loadStyle(url){
    return new Promise((resolve,reject)=>{
      if(document.querySelector(`link[href="${url}"]`))return resolve();
      const el=document.createElement('link');el.rel='stylesheet';el.href=url;el.onload=resolve;
      el.onerror=()=>reject(new Error('MapLibre stylesheet failed to load'));document.head.appendChild(el);
    });
  }

  async function loadMapLibre(){
    if(runtime.loadPromise)return runtime.loadPromise;
    runtime.loadPromise=(async()=>{
      await loadStyle('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css');
      const module=await import('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs');
      if(typeof module?.Map!=='function')throw new Error('MapLibre ES module did not expose Map');
      return module;
    })();
    return runtime.loadPromise;
  }

  async function loadRouteContext(){
    if(runtime.routeData&&runtime.centroids)return;
    const [routeRes,centroidRes,waypointRes]=await Promise.all([
      fetch('./data/public-route.json',{cache:'force-cache'}),
      fetch('./data/country-centroids.json',{cache:'force-cache'}),
      fetch('./data/route-waypoints.json',{cache:'force-cache'}).catch(()=>null)
    ]);
    runtime.routeData=await routeRes.json();
    const centroids=await centroidRes.json();
    if(waypointRes?.ok){
      const rows=await waypointRes.json();
      runtime.routeWaypoints=new Map(Object.entries(rows||{}).map(([id,points])=>[Number(id),points]));
    }
    runtime.centroids=new Map((centroids||[]).map(c=>[normalize(c.name),c]));
    runtime.criticalIds=new Set([...(runtime.routeData.segments||[])].sort((a,b)=>criticalScore(b)-criticalScore(a)).slice(0,20).map(s=>Number(s.id)));
  }

  function phaseIdFor(id){
    const ranges=[[1,29],[30,39],[40,52],[53,64],[65,78],[79,95],[96,112],[113,120],[121,145],[146,169],[170,181],[182,194]];
    const i=ranges.findIndex(([a,b])=>id>=a&&id<=b);return i<0?1:i+1;
  }

  function criticalScore(s){
    let x={A:30,B:20,C:10,D:5,E:4}[s.bookingTier]||5;
    if(s.feasibility==='Kritisch')x+=30;else if(s.feasibility==='Bedingt')x+=15;
    if(s.alertLevel==='RED')x+=35;else if(s.alertLevel==='ORANGE')x+=24;else if(s.alertLevel==='WATCH')x+=9;
    if(s.dataQuality&&!/verifiziert/i.test(s.dataQuality))x+=12;
    if(/Nauru|Tuvalu|Marshall|Mikronesien|Palau|Haiti|Syrien|Jemen|Sudan|Somalia/i.test(`${s.from} ${s.to}`))x+=9;
    return x;
  }

  function activeTerrainLayer(){
    return $('#layerGrid button.active')?.dataset.layer || new URLSearchParams(location.search).get('layer') || 'route';
  }

  function terrainSegmentVisible(s){
    const layer=activeTerrainLayer();
    const mode=$('#modeFilter')?.value||'all',tier=$('#tierFilter')?.value||'all',feasibility=$('#feasibilityFilter')?.value||'all',alert=$('#alertFilter')?.value||'all';
    if(mode!=='all'&&s.mode!==mode)return false;
    if(tier!=='all'&&s.bookingTier!==tier)return false;
    if(feasibility!=='all'&&s.feasibility!==feasibility)return false;
    if(alert!=='all'&&s.alertLevel!==alert)return false;
    if(layer==='critical'&&!runtime.criticalIds.has(Number(s.id)))return false;
    return true;
  }

  function terrainVisibleSegments(){
    return (runtime.routeData?.segments||[]).filter(terrainSegmentVisible);
  }

  function terrainColor(s){
    const layer=activeTerrainLayer();
    if(layer==='status')return ({RED:COLORS.red,ORANGE:COLORS.orange,WATCH:COLORS.amber,GREEN:COLORS.green}[s.alertLevel]||COLORS.muted);
    if(layer==='visa'){
      if(/block/i.test(s.visaStatusTarget||''))return COLORS.red;
      if(/pending/i.test(s.visaStatusTarget||''))return COLORS.orange;
      if(/N\/A|Approved|Completed/i.test(s.visaStatusTarget||''))return COLORS.green;
      return COLORS.amber;
    }
    if(layer==='health')return Number(s.healthPriorityTarget)>=4?COLORS.red:Number(s.healthPriorityTarget)>=2?COLORS.amber:COLORS.green;
    if(layer==='cost'){const v=Number(s.transportBudgetEur||0);return v>600?COLORS.red:v>350?COLORS.violet:v>150?COLORS.blue:COLORS.cyan;}
    if(layer==='risk')return s.feasibility==='Kritisch'?COLORS.red:s.feasibility==='Bedingt'?COLORS.orange:/verifiziert/i.test(s.dataQuality||'')?COLORS.green:COLORS.amber;
    if(layer==='progress')return COLORS.blue;
    if(layer==='critical')return COLORS.red;
    return PHASE_COLORS[phaseIdFor(Number(s.id))]||COLORS.cyan;
  }

  function activeTerrainPhase(){
    const raw=new URLSearchParams(location.search).get('phase');
    if(raw&&raw!=='all'&&Number.isFinite(Number(raw)))return Number(raw);
    return phaseIdFor(runtime.selectedId||currentSegmentId());
  }

  function greatCirclePoints(a,b,steps=72){
    const d2r=Math.PI/180,r2d=180/Math.PI;
    const lat1=Number(a.lat)*d2r,lon1=Number(a.lng)*d2r,lat2=Number(b.lat)*d2r,lon2=Number(b.lng)*d2r;
    const v1=[Math.cos(lat1)*Math.cos(lon1),Math.cos(lat1)*Math.sin(lon1),Math.sin(lat1)];
    const v2=[Math.cos(lat2)*Math.cos(lon2),Math.cos(lat2)*Math.sin(lon2),Math.sin(lat2)];
    const dot=clamp(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2],-1,1);
    const omega=Math.acos(dot),sinOmega=Math.sin(omega);
    if(omega<1e-6||Math.abs(sinOmega)<1e-6)return [[Number(a.lng),Number(a.lat)],[Number(b.lng),Number(b.lat)]];
    const points=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps,A=Math.sin((1-t)*omega)/sinOmega,B=Math.sin(t*omega)/sinOmega;
      const x=A*v1[0]+B*v2[0],y=A*v1[1]+B*v2[1],z=A*v1[2]+B*v2[2];
      const lat=Math.atan2(z,Math.hypot(x,y))*r2d,lng=Math.atan2(y,x)*r2d;
      points.push([lng,lat]);
    }
    return points;
  }

  function splitDateline(points){
    if(points.length<2)return [points];
    const parts=[[points[0]]];
    for(let i=1;i<points.length;i++){
      const prev=points[i-1],cur=points[i];
      if(Math.abs(cur[0]-prev[0])>180){
        if(parts[parts.length-1].length<2)parts[parts.length-1].push(prev);
        parts.push([cur]);
      }else parts[parts.length-1].push(cur);
    }
    return parts.filter(p=>p.length>1);
  }

  function segmentPathPoints(s){
    const id=Number(s.id),curated=runtime.routeWaypoints.get(id);
    if(Array.isArray(curated)&&curated.length>=2){
      const stitched=[];
      for(let i=1;i<curated.length;i++){
        const a={lng:Number(curated[i-1][0]),lat:Number(curated[i-1][1])};
        const b={lng:Number(curated[i][0]),lat:Number(curated[i][1])};
        const leg=greatCirclePoints(a,b,Math.max(10,Math.round(24/(curated.length-1))));
        if(stitched.length)leg.shift();
        stitched.push(...leg);
      }
      return stitched;
    }
    const a=runtime.centroids.get(normalize(s.from)),b=runtime.centroids.get(normalize(s.to));
    if(!a||!b)return[];
    return greatCirclePoints(a,b);
  }

  function segmentFeature(s){
    const points=segmentPathPoints(s);if(points.length<2)return null;
    const parts=splitDateline(points);
    const id=Number(s.id),visible=terrainSegmentVisible(s)||id===Number(runtime.selectedId);
    return {
      type:'Feature',properties:{id,phaseId:phaseIdFor(id),color:terrainColor(s),visible:visible?1:0},
      geometry:parts.length>1?{type:'MultiLineString',coordinates:parts}:{type:'LineString',coordinates:parts[0]||[]}
    };
  }

  function routeGeoJson(){
    const rows=runtime.routeData?.segments||[];
    return {type:'FeatureCollection',features:rows.map(segmentFeature).filter(Boolean)};
  }

  function countryGeoJson(){
    const meta=new Map((runtime.routeData?.countries||[]).map(c=>[normalize(c.name),c]));
    return {type:'FeatureCollection',features:[...runtime.centroids.values()].map(c=>{
      const m=meta.get(normalize(c.name))||{};
      return {type:'Feature',properties:{name:c.name,number:Number(c.number||m.number||0),cca2:c.cca2||'',readiness:m.readiness||''},geometry:{type:'Point',coordinates:[Number(c.lng),Number(c.lat)]}};
    }).filter(f=>Number.isFinite(f.geometry.coordinates[0])&&Number.isFinite(f.geometry.coordinates[1]))};
  }

  function selectedPosition(){
    const p=new URLSearchParams(location.search),country=p.get('country');
    if(country){const c=runtime.centroids.get(normalize(country));if(c)return [Number(c.lng),Number(c.lat)];}
    const id=currentSegmentId();
    const s=runtime.routeData?.segments?.find(x=>Number(x.id)===id),b=s&&runtime.centroids.get(normalize(s.to));
    return b?[Number(b.lng),Number(b.lat)]:[12,20];
  }

  function colorExpression(){return ['get','color'];}
  function widthExpr(a,b,c0){const scale=clamp(Number($('#arcWidth')?.value||.55)/.55,.35,2.4);return ['interpolate',['linear'],['zoom'],2,a*scale,6,b*scale,12,c0*scale];}

  function terrainStyle(){
    const phase=activeTerrainPhase();
    return {
      version:8,projection:{type:'globe'},
      sources:{
        osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'},
        terrainSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
        hillshadeSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
        routeSource:{type:'geojson',data:routeGeoJson()},
        countrySource:{type:'geojson',data:countryGeoJson()}
      },
      terrain:{source:'terrainSource',exaggeration:1.42},
      sky:{'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.52,3.5,.16,7,0]},
      layers:[
        {id:'background',type:'background',paint:{'background-color':'#071019'}},
        {id:'osm',type:'raster',source:'osm',paint:{'raster-opacity':1,'raster-saturation':-.06,'raster-contrast':.08,'raster-brightness-min':.01,'raster-brightness-max':.76}},
        {id:'hills',type:'hillshade',source:'hillshadeSource',paint:{'hillshade-method':'multidirectional','hillshade-exaggeration':.42,'hillshade-shadow-color':'#6a7780','hillshade-highlight-color':'#f5f8fa','hillshade-accent-color':'#8c9ca6'}},
        {id:'route-hit',type:'line',source:'routeSource',filter:['==',['get','visible'],1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(0,0,0,.001)','line-opacity':.001,'line-width':['interpolate',['linear'],['zoom'],2,12,7,16,12,20]}},
        {id:'route-world-shadow',type:'line',source:'routeSource',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(3,10,18,.72)','line-opacity':.30,'line-width':widthExpr(2.1,3.2,4.6)}},
        {id:'route-world',type:'line',source:'routeSource',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['case',['==',['get','visible'],1],colorExpression(),'#6f8295'],'line-opacity':['case',['==',['get','visible'],1],.72,.18],'line-width':widthExpr(1.05,1.65,2.45)}},
        {id:'route-phase-shadow',type:'line',source:'routeSource',filter:['all',['==',['get','phaseId'],phase],['==',['get','visible'],1]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(4,10,16,.66)','line-opacity':$('#routeGlow')?.checked===false?.28:.72,'line-width':widthExpr(2.5,4.0,6.0)}},
        {id:'route-phase',type:'line',source:'routeSource',filter:['all',['==',['get','phaseId'],phase],['==',['get','visible'],1]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':.96,'line-width':widthExpr(1.55,2.65,4.1)}},
        {id:'selected-route-shadow',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(2,9,15,.82)','line-opacity':$('#routeGlow')?.checked===false?.38:.92,'line-width':widthExpr(4.0,6.4,9.0)}},
        {id:'selected-route',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#00d8ff','line-opacity':1,'line-width':widthExpr(2.7,4.7,6.8)}},
        {id:'country-hit',type:'circle',source:'countrySource',layout:{visibility:$('#showPoints')?.checked===false?'none':'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,8,7,10,11,12],'circle-color':'rgba(0,0,0,.001)','circle-opacity':.001}},
        {id:'country-points',type:'circle',source:'countrySource',layout:{visibility:$('#showPoints')?.checked===false?'none':'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,1.55,7,2.7,11,4.1],'circle-color':'rgba(207,232,247,.76)','circle-stroke-color':'rgba(4,12,20,.82)','circle-stroke-width':1,'circle-opacity':['interpolate',['linear'],['zoom'],2,.46,5,.62,8,.82]}},
        {id:'country-selected',type:'circle',source:'countrySource',filter:['==',['get','name'],new URLSearchParams(location.search).get('country')||''],paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,4.8,7,6.6,11,8.4],'circle-color':'#59ddff','circle-stroke-color':'#ffffff','circle-stroke-width':1.4,'circle-opacity':1}}
      ]
    };
  }

  function deactivateTerrain({updateUrl=true}={}){
    runtime.terrainRequested=false;runtime.terrainActive=false;
    document.body.classList.remove('terrain-loading','terrain-view');setToggleState(false);setTerrainLabel('Real 3D globe terrain');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Drag to rotate · scroll to zoom · relief appears as you move closer';
    const high=$('#highDetailGlobe');if(high&&runtime.highDetailWasDisabled!==null){high.disabled=runtime.highDetailWasDisabled;runtime.highDetailWasDisabled=null;}const auto=$('#autoRotate');if(auto)auto.disabled=false;if(updateUrl)updateViewUrl(false);
  }

  function activateTerrain(){
    runtime.terrainRequested=false;runtime.terrainActive=true;
    document.body.classList.remove('terrain-loading');document.body.classList.add('terrain-view');setToggleState(true);setTerrainLabel('Real 3D globe terrain');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Drag to rotate · scroll to zoom · relief appears as you move closer';
    const high=$('#highDetailGlobe');if(high){if(runtime.highDetailWasDisabled===null)runtime.highDetailWasDisabled=high.disabled;high.disabled=true;}const auto=$('#autoRotate');if(auto)auto.disabled=true;updateViewUrl(true);syncTerrainSettings();
  }

  function failTerrain(message){console.warn(message);deactivateTerrain({updateUrl:true});notify(message)}

  async function initTerrainMap(){
    if(runtime.terrainReady)return;
    await loadRouteContext();
    runtime.selectedId=currentSegmentId();
    const maplibregl=await loadMapLibre(),center=selectedPosition();
    const map=new maplibregl.Map({
      container:'terrainMap',style:terrainStyle(),center,zoom:3.9,pitch:32,bearing:-6,
      minZoom:2.9,maxZoom:18,maxPitch:65,renderWorldCopies:false,attributionControl:true,
      canvasContextAttributes:{antialias:true}
    });

    clearTimeout(runtime.terrainFailTimer);
    runtime.terrainFailTimer=setTimeout(()=>{
      if(runtime.terrainRequested&&!runtime.terrainBaseReady)failTerrain('3D globe terrain could not be loaded. Standard globe restored.');
    },10000);

    map.on('style.load',()=>{
      try{map.setProjection({type:'globe'});}catch(err){console.warn('Globe projection unavailable',err)}
      try{map.setTerrain({source:'terrainSource',exaggeration:1.42});}catch(err){console.warn('Terrain could not be attached to globe projection',err)}
    });

    map.on('load',()=>{
      runtime.terrainBaseReady=true;clearTimeout(runtime.terrainFailTimer);
      syncTerrainSelection({fly:false});syncTerrainSettings();if(runtime.terrainRequested)activateTerrain();

      const routeLayers=['route-hit','selected-route','route-phase','route-world'];
      map.on('click',e=>{
        const hit=map.queryRenderedFeatures(e.point,{layers:routeLayers}).find(f=>Number.isFinite(Number(f.properties?.id)));
        if(!hit)return;
        const id=Number(hit.properties.id);
        window.__ONE_WORLD_ROUTE_APP__?.selectSegment?.(id,false);
        runtime.selectedId=id;syncTerrainData();syncTerrainSelection({fly:true});
      });
      map.on('click','country-hit',e=>{
        const name=e.features?.[0]?.properties?.name;if(!name)return;
        window.__ONE_WORLD_ROUTE_APP__?.selectCountry?.(name,false);
        window.__ONE_WORLD_ROUTE_APP__?.openDetails?.();
        runtime.selectedId=currentSegmentId();syncTerrainSelection({fly:true});
      });
      map.on('mouseenter','country-hit',()=>{map.getCanvas().style.cursor='pointer'});
      map.on('mouseleave','country-hit',()=>{map.getCanvas().style.cursor=''});
    });

    map.on('error',e=>{
      const msg=String(e?.error?.message||'');
      if(/style|source|tile|terrain|projection/i.test(msg))console.warn('Globe terrain resource error',e.error);
    });

    if(!window.matchMedia('(max-width: 820px)').matches){
      map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
      if(maplibregl.TerrainControl)map.addControl(new maplibregl.TerrainControl({source:'terrainSource',exaggeration:1.42}),'top-right');
      if(maplibregl.GlobeControl)map.addControl(new maplibregl.GlobeControl(),'top-right');
    }
    runtime.terrainMap=map;runtime.terrainReady=true;window.__ONE_WORLD_TERRAIN__=map;
  }

  function syncTerrainData(){
    const map=runtime.terrainMap;if(!map)return;
    const source=map.getSource?.('routeSource');if(source?.setData)source.setData(routeGeoJson());
  }

  function syncTerrainCountry(){
    const map=runtime.terrainMap;if(!map)return;
    const name=new URLSearchParams(location.search).get('country')||'';
    if(map.getLayer?.('country-selected'))map.setFilter('country-selected',['==',['get','name'],name]);
  }

  function syncTerrainSettings(){
    const map=runtime.terrainMap;if(!map)return;
    const points=$('#showPoints')?.checked===false?'none':'visible';
    if(map.getLayer?.('country-points'))map.setLayoutProperty('country-points','visibility',points);
    if(map.getLayer?.('country-hit'))map.setLayoutProperty('country-hit','visibility',points);
    const glow=$('#routeGlow')?.checked!==false;
    if(map.getLayer?.('route-phase-shadow'))map.setPaintProperty('route-phase-shadow','line-opacity',glow?.58:.18);
    if(map.getLayer?.('selected-route-shadow'))map.setPaintProperty('selected-route-shadow','line-opacity',glow?.88:.22);
    const widths={'route-world-shadow':widthExpr(2.1,3.2,4.6),'route-world':widthExpr(1.05,1.65,2.45),'route-phase-shadow':widthExpr(2.5,4.0,6.0),'route-phase':widthExpr(1.55,2.65,4.1),'selected-route-shadow':widthExpr(4.0,6.4,9.0),'selected-route':widthExpr(2.7,4.7,6.8)};
    Object.entries(widths).forEach(([id,value])=>{if(map.getLayer?.(id))map.setPaintProperty(id,'line-width',value)});
    const auto=$('#autoRotate');if(auto)auto.disabled=runtime.terrainActive||runtime.terrainRequested;
  }

  function syncTerrainHierarchy(){
    const map=runtime.terrainMap;if(!map)return;
    const phase=activeTerrainPhase();
    if(map.getLayer?.('route-hit'))map.setFilter('route-hit',['==',['get','visible'],1]);
    if(map.getLayer?.('route-phase'))map.setFilter('route-phase',['all',['==',['get','phaseId'],phase],['==',['get','visible'],1]]);
    if(map.getLayer?.('route-phase-shadow'))map.setFilter('route-phase-shadow',['all',['==',['get','phaseId'],phase],['==',['get','visible'],1]]);
    if(map.getLayer?.('selected-route'))map.setFilter('selected-route',['==',['get','id'],runtime.selectedId]);
    if(map.getLayer?.('selected-route-shadow'))map.setFilter('selected-route-shadow',['==',['get','id'],runtime.selectedId]);
  }

  function sphericalCenter(points){
    if(!points.length)return [12,20];
    let x=0,y=0,z=0;
    for(const [lng,lat] of points){
      const la=Number(lat)*Math.PI/180,lo=Number(lng)*Math.PI/180;
      x+=Math.cos(la)*Math.cos(lo);y+=Math.cos(la)*Math.sin(lo);z+=Math.sin(la);
    }
    const lng=Math.atan2(y,x)*180/Math.PI,lat=Math.atan2(z,Math.hypot(x,y))*180/Math.PI;
    return [lng,lat];
  }

  function angularDistance(a,b){
    const d2r=Math.PI/180;
    const la1=a[1]*d2r,la2=b[1]*d2r,dla=(b[1]-a[1])*d2r,dlo=(b[0]-a[0])*d2r;
    const h=Math.sin(dla/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlo/2)**2;
    return 2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))*180/Math.PI;
  }

  function focusTerrainPhase(raw){
    const map=runtime.terrainMap;if(!map||!runtime.terrainActive)return;
    if(String(raw)==='all'){
      map.easeTo({center:[12,18],zoom:2.35,pitch:8,bearing:0,duration:$('#reducedMotion')?.checked?0:950,essential:true});
      return;
    }
    const phase=Number(raw);if(!Number.isFinite(phase))return;
    const segments=(runtime.routeData?.segments||[]).filter(s=>phaseIdFor(Number(s.id))===phase);
    const points=[];
    for(const s of segments){
      const curated=runtime.routeWaypoints.get(Number(s.id));
      if(Array.isArray(curated))curated.forEach(p=>points.push([Number(p[0]),Number(p[1])]));
      else{
        const a=runtime.centroids.get(normalize(s.from)),b=runtime.centroids.get(normalize(s.to));
        if(a)points.push([Number(a.lng),Number(a.lat)]);if(b)points.push([Number(b.lng),Number(b.lat)]);
      }
    }
    if(!points.length)return;
    const center=sphericalCenter(points);
    const spread=Math.max(...points.map(p=>angularDistance(center,p)));
    let zoom=spread>100?2.25:spread>65?2.55:spread>40?2.9:spread>25?3.25:spread>14?3.7:4.15;
    if(window.innerWidth<=820)zoom-=.12;
    map.easeTo({center,zoom,pitch:spread>55?8:24,bearing:0,duration:$('#reducedMotion')?.checked?0:1050,essential:true});
  }

  function syncTerrainSelection({fly=false}={}){
    const map=runtime.terrainMap;if(!map)return;
    runtime.selectedId=currentSegmentId();
    syncTerrainData();syncTerrainHierarchy();syncTerrainCountry();syncTerrainSettings();
    if(!fly)return;
    const p=selectedPosition();
    map.easeTo({center:p,zoom:Math.max(map.getZoom(),4.5),pitch:Math.min(Math.max(map.getPitch(),32),55),bearing:-6,duration:$('#reducedMotion')?.checked?0:900,essential:true});
  }

  async function setTerrainMode(active){
    if(active&&document.body.classList.contains('story-mode')){setToggleState(false);notify('Exit Story before opening 3D globe terrain.');return;}
    if(!active){deactivateTerrain({updateUrl:true});return;}
    if(runtime.terrainActive){setToggleState(true);return;}
    runtime.terrainRequested=true;document.body.classList.add('terrain-loading');setToggleState(true);setTerrainLabel('Loading 3D globe terrain…');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Loading globe, map and elevation data…';
    try{
      await initTerrainMap();runtime.terrainMap.resize();
      if(runtime.terrainBaseReady){activateTerrain();syncTerrainSelection({fly:false});}
    }catch(err){console.error('3D globe terrain mode unavailable',err);failTerrain('3D globe terrain could not be initialized. Standard globe restored.');}
  }

  function findGlobe(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;if(!globe)return setTimeout(findGlobe,100);
    runtime.globe=globe;installArtifactFreeBorders(globe);
  }

  async function restoreViewState(){
    const wantsTerrain=new URLSearchParams(location.search).get('view')==='terrain';setToggleState(false);
    if(wantsTerrain)await setTerrainMode(true);
  }

  function wire(){
    ensureStyles();ensureTerrainUi();syncSliderFromUrl();findGlobe();
    $('#routeRange')?.addEventListener('input',()=>{
      if(runtime.terrainActive)setTimeout(()=>syncTerrainSelection({fly:!runtime.pendingPhaseFocus}),0);
    });
    $('#phaseRail')?.addEventListener('click',e=>{
      const btn=e.target.closest?.('button[data-phase]');if(!btn||!runtime.terrainActive)return;
      runtime.pendingPhaseFocus=btn.dataset.phase;
      clearTimeout(runtime.phaseFocusTimer);
      runtime.phaseFocusTimer=setTimeout(()=>{
        syncTerrainData();syncTerrainHierarchy();
        const phase=runtime.pendingPhaseFocus;runtime.pendingPhaseFocus=null;
        focusTerrainPhase(phase);
      },260);
    });
    $('#layerGrid')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainData();syncTerrainHierarchy();},80)});
    $('.mode-switch')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainData();syncTerrainHierarchy();},80)});
    ['modeFilter','tierFilter','feasibilityFilter','alertFilter'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainData();syncTerrainHierarchy();},0)}));
    $('#clearFilters')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainData();syncTerrainHierarchy();},80)});
    ['showPoints','routeGlow','arcWidth','reducedMotion'].forEach(id=>$('#'+id)?.addEventListener(id==='arcWidth'?'input':'change',()=>{if(runtime.terrainActive)syncTerrainSettings()}));
    new MutationObserver(()=>{
      if(document.body.classList.contains('story-mode')&&(runtime.terrainActive||runtime.terrainRequested))deactivateTerrain({updateUrl:true});
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',()=>runtime.terrainMap?.resize?.(),{passive:true});restoreViewState();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

/* ===== iteration10.js ===== */
(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);

  function ensureFocusButton(){
    const stage=$('.globe-stage');
    if(!stage||$('#terrainFocusBtn'))return;
    const btn=document.createElement('button');
    btn.id='terrainFocusBtn';
    btn.type='button';
    btn.className='terrain-focus-btn';
    btn.innerHTML='<span>◎</span><b>Focus route</b>';
    btn.addEventListener('click',()=>{
      const range=$('#routeRange');
      if(!range)return;
      range.dispatchEvent(new Event('input',{bubbles:true}));
    });
    stage.appendChild(btn);
  }

  function ensureStyles(){
    if($('#iteration10Styles'))return;
    const style=document.createElement('style');
    style.id='iteration10Styles';
    style.textContent=`
      .terrain-focus-btn{display:none;position:absolute;z-index:25;right:22px;bottom:24px;align-items:center;gap:7px;padding:9px 12px;border:1px solid rgba(89,221,255,.24);border-radius:12px;background:rgba(7,14,24,.88);color:#dff8ff;font:600 9px/1.1 system-ui,sans-serif;letter-spacing:.03em;box-shadow:0 10px 30px rgba(0,0,0,.22);backdrop-filter:blur(14px);cursor:pointer}
      .terrain-focus-btn span{font-size:13px;color:#59ddff}
      .terrain-focus-btn b{font:inherit;font-weight:650;white-space:nowrap}
      .terrain-focus-btn:hover{border-color:rgba(89,221,255,.48);background:rgba(10,22,36,.94)}
      body.terrain-view .terrain-focus-btn{display:flex}
      @media(max-width:820px){
        .terrain-focus-btn{left:50%;right:auto;bottom:12px;transform:translateX(-50%);padding:8px 10px;font-size:8px;min-height:34px}
      }
    `;
    document.head.appendChild(style);
  }

  function wire(){
    ensureStyles();
    ensureFocusButton();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

/* ===== release2.js ===== */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const euro=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v||0));
  const km=v=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(Math.round(v||0))+' km';
  const EN=window.ONE_WORLD_EN||{country:s=>s,mode:s=>s};
  const runtime={route:null,countries:[],centroids:new Map(),waypoints:new Map(),actual:null,media:null,changes:null,installPrompt:null,stats:null};

  const hav=(a,b)=>{
    const r=6371,d2r=Math.PI/180,la1=a[1]*d2r,la2=b[1]*d2r,dla=(b[1]-a[1])*d2r,dlo=(b[0]-a[0])*d2r;
    const h=Math.sin(dla/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlo/2)**2;
    return 2*r*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  };
  const modeGroup=m=>/Flug/i.test(m)?'Flight':/Fähre/i.test(m)?'Ferry':/Zug/i.test(m)?'Rail':/Bus|Auto|Land|4x4|Shuttle|Sammeltaxi/i.test(m)?'Road':'Other';

  async function load(){
    if(runtime.route)return runtime;
    const [r,c,w,a,m,ch]=await Promise.all([
      fetch('./data/public-route.json',{cache:'force-cache'}).then(x=>x.json()),
      fetch('./data/country-centroids.json',{cache:'force-cache'}).then(x=>x.json()),
      fetch('./data/route-waypoints.json',{cache:'force-cache'}).then(x=>x.json()).catch(()=>({})),
      fetch('./data/actual-progress.json',{cache:'no-store'}).then(x=>x.json()).catch(()=>({status:'unavailable'})),
      fetch('./data/media.json',{cache:'no-store'}).then(x=>x.json()).catch(()=>({items:[]})),
      fetch('./data/changelog.json',{cache:'no-store'}).then(x=>x.json()).catch(()=>([]))
    ]);
    runtime.route=r;runtime.countries=c;EN.registerCountries?.(c);
    runtime.centroids=new Map(c.map(x=>[x.name,[Number(x.lng),Number(x.lat)]]));
    runtime.waypoints=new Map(Object.entries(w||{}).map(([id,p])=>[Number(id),p]));
    runtime.actual=a;runtime.media=m;runtime.changes=ch;
    return runtime;
  }

  function segmentDistance(s){
    const pts=runtime.waypoints.get(Number(s.id));
    if(Array.isArray(pts)&&pts.length>1){
      let d=0;for(let i=1;i<pts.length;i++)d+=hav(pts[i-1],pts[i]);return d;
    }
    const a=runtime.centroids.get(s.from),b=runtime.centroids.get(s.to);
    return a&&b?hav(a,b):0;
  }

  function computeStats(){
    if(runtime.stats)return runtime.stats;
    const segments=runtime.route?.segments||[],by={};
    let distance=0,budget=0;
    for(const s of segments){
      const d=segmentDistance(s),g=modeGroup(s.mode);
      distance+=d;budget+=Number(s.transportBudgetEur||0);
      by[g]??={legs:0,distance:0,budget:0};by[g].legs++;by[g].distance+=d;by[g].budget+=Number(s.transportBudgetEur||0);
    }
    const days=Math.max(...segments.map(s=>Number(s.planArrival||0)))-Math.min(...segments.map(s=>Number(s.planDeparture||0)))+1;
    runtime.stats={distance,budget,days,countries:(runtime.route?.countries||[]).length,segments:segments.length,by};
    return runtime.stats;
  }

  function ensureUi(){
    const left=$('#leftPanel');
    if(left&&!$('#journeyTools')){
      const section=document.createElement('section');section.id='journeyTools';section.className='panel-section journey-tools';
      section.innerHTML='<div class="section-title"><span>Journey intelligence</span><button id="pwaInstall" class="text-btn hidden">Install</button></div><div class="journey-tool-grid"><button data-hub="stats"><b>◎</b><span>Stats</span></button><button data-hub="live"><b>◉</b><span>Live</span></button><button data-hub="journal"><b>▣</b><span>Journal</span></button><button data-hub="changes"><b>↻</b><span>Changes</span></button></div>';
      left.appendChild(section);
    }
    if(!$('#journeyHub')){
      const modal=document.createElement('div');modal.id='journeyHub';modal.className='journey-hub hidden';
      modal.innerHTML='<div class="journey-hub-card glass"><header><div><span>ONE WORLD ROUTE</span><h2>Journey intelligence</h2></div><button id="journeyHubClose" aria-label="Close">×</button></header><nav><button data-hubtab="stats" class="active">Stats</button><button data-hubtab="live">Live</button><button data-hubtab="journal">Journal</button><button data-hubtab="changes">Changes</button></nav><main id="journeyHubContent"></main></div>';
      document.body.appendChild(modal);
    }
  }

  function statCard(label,value,sub=''){return '<article class="journey-stat"><span>'+esc(label)+'</span><b>'+esc(value)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</article>'}

  function renderStats(){
    const s=computeStats(),rows=Object.entries(s.by).sort((a,b)=>b[1].distance-a[1].distance);
    $('#journeyHubContent').innerHTML='<section class="journey-stat-grid">'+
      statCard('Countries',s.countries,'sovereign states')+
      statCard('Route legs',s.segments,'executable segments')+
      statCard('Planned duration',s.days+' days','21 Oct 2026 → 2027')+
      statCard('Route distance',km(s.distance),'corridor / geodesic estimate')+
      statCard('Transport model',euro(s.budget),'public segment budget')+
      statCard('Chapters','12','continuous route')+
      '</section><section class="journey-breakdown"><h3>Transport mix</h3>'+rows.map(([k,v])=>'<div><span><b>'+esc(k)+'</b><small>'+v.legs+' legs</small></span><strong>'+km(v.distance)+'</strong><i><em style="width:'+Math.max(3,Math.round(v.distance/s.distance*100))+'%"></em></i></div>').join('')+'</section><p class="journey-note">Distances use curated corridor waypoints where available and geodesic country-to-country estimates elsewhere. They are planning metrics, not odometer readings.</p>';
  }

  function daysUntil(date){
    const target=new Date(date+'T00:00:00Z'),today=new Date();today.setUTCHours(0,0,0,0);
    return Math.ceil((target-today)/86400000);
  }

  function renderLive(){
    const a=runtime.actual||{},d=daysUntil(a.journeyStart||'2026-10-21'),pre=a.status==='pretrip';
    const status=pre?(d>0?'Starts in '+d+' days':'Ready to depart'):(a.status||'Live');
    $('#journeyHubContent').innerHTML='<section class="live-hero"><span>PLAN ↔ ACTUAL</span><h3>'+esc(status)+'</h3><p>'+esc(pre?'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'Actual journey data is being compared with the public plan.')+'</p></section><section class="journey-stat-grid">'+
      statCard('Planned start','21 Oct 2026')+
      statCard('Actual status',String(a.status||'—').toUpperCase())+
      statCard('Visited',String(a.visitedCountries||0)+' / 195')+
      statCard('Current leg',a.currentSegment?String(a.currentSegment)+' / 194':'Not started')+
      statCard('Actual spend',euro(a.actualSpendEur||0))+
      statCard('Last update',a.lastUpdated||'—')+
      '</section><div class="live-events">'+((a.events||[]).length?(a.events||[]).map(e=>'<article><b>'+esc(e.title||e.type||'Update')+'</b><span>'+esc(e.date||'')+'</span><p>'+esc(e.text||'')+'</p></article>').join(''):'<div class="journey-empty">No actual journey events yet.</div>')+'</div>';
  }

  function renderJournal(){
    const items=runtime.media?.items||[];
    $('#journeyHubContent').innerHTML=items.length?'<div class="journal-grid">'+items.map(x=>'<article>'+(x.image?'<img src="'+esc(x.image)+'" alt="">':'')+'<span>'+esc(x.date||'')+'</span><h3>'+esc(x.title||x.country||'Journey story')+'</h3><p>'+esc(x.text||'')+'</p></article>').join('')+'</div>':'<div class="journey-empty"><b>Journal ready for departure</b><p>Photos and short field notes can be attached to countries, route legs and travel days without turning the site into a generic blog.</p><small>Media schema is active; there are no public travel entries before departure.</small></div>';
  }

  function renderChanges(){
    const rows=Array.isArray(runtime.changes)?runtime.changes:[];
    $('#journeyHubContent').innerHTML='<div class="change-list">'+rows.map(x=>'<article><time>'+esc(x.date||'')+'</time><div><h3>'+esc(x.title||'Route update')+'</h3><p>'+esc(x.summary||'')+'</p>'+(x.tags?.length?'<span>'+x.tags.map(t=>'<b>'+esc(t)+'</b>').join('')+'</span>':'')+'</div></article>').join('')+'</div>';
  }

  function open(tab='stats'){
    $('#journeyHub')?.classList.remove('hidden');
    $$('[data-hubtab]').forEach(b=>b.classList.toggle('active',b.dataset.hubtab===tab));
    if(tab==='stats')renderStats();else if(tab==='live')renderLive();else if(tab==='journal')renderJournal();else renderChanges();
  }

  function wire(){
    ensureUi();
    document.addEventListener('click',e=>{
      const t=e.target.closest?.('[data-hub]');if(t){open(t.dataset.hub);if(innerWidth<=820)$('#leftPanel')?.classList.remove('mobile-open');}
      const tab=e.target.closest?.('[data-hubtab]');if(tab)open(tab.dataset.hubtab);
      if(e.target.closest?.('#journeyHubClose')||e.target.id==='journeyHub')$('#journeyHub')?.classList.add('hidden');
    });
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();runtime.installPrompt=e;$('#pwaInstall')?.classList.remove('hidden')});
    $('#pwaInstall')?.addEventListener('click',async()=>{if(!runtime.installPrompt)return;runtime.installPrompt.prompt();await runtime.installPrompt.userChoice;runtime.installPrompt=null;$('#pwaInstall')?.classList.add('hidden')});
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker unavailable',err));
  }

  async function init(){await load();wire();window.ONE_WORLD_RELEASE2={open,stats:computeStats,actual:()=>runtime.actual};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
