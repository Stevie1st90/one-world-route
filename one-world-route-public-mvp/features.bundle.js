/* ONE WORLD ROUTE feature runtime bundle. */

/* ===== operational-movements.js ===== */
(() => {
  'use strict';
  const json=async path=>{const r=await fetch(path);if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json()};
  const ready=Promise.all([json('./data/operational-movements.json'),json('./data/flight-geometries.json')])
    .then(([data,flights])=>{window.ONE_WORLD_MOVEMENTS.data=data;return {...data,flights}})
    .catch(error=>{console.warn('Operational movement data unavailable',error);return {movements:[],flights:{geometries:{}},unavailable:true}});
  window.ONE_WORLD_MOVEMENTS={ready,data:null,active:null,
    clear(){this.active=null;document.querySelector('#storyMovement')?.remove()},
    show(m){
      this.clear();this.active=m;
      const hud=document.querySelector('#storyHud');if(!hud)return;
      const box=document.createElement('div');box.id='storyMovement';box.className='story-movement';
      const title=document.createElement('b');title.textContent=m.mode?`Domestic ${m.mode.toLowerCase()} transfer`:'Transfer · route needs review';
      const route=document.createElement('span');route.textContent=`${m.from} → ${m.to}`;
      const note=document.createElement('small');note.textContent=`${m.reviewStatus==='reviewed'?'':'Plan needs review · '}Between international legs · country count unchanged`;
      box.append(title,route,note);hud.appendChild(box);
    }
  };
})();


/* ===== iteration6.js ===== */
(() => {
  'use strict';

  const runtime={data:null,segments:[],selectedId:1,observer:null,renderFrame:null};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const excelDate=v=>v?new Date(Date.UTC(1899,11,30)+Number(v)*86400000):null;
  const euro=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v||0));
  const now=new Date();
  now.setHours(0,0,0,0);
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
      runtime.operational=await window.ONE_WORLD_MOVEMENTS.ready;
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

  function movementSummary(){
    const data=runtime.operational;
    if(!data||data.unavailable)return '<p class="ops-empty">Operational transfers unavailable. Continuity cannot be confirmed.</p>';
    const items=data.movements;
    return `<div class="ops-mini-title">Operational transfers</div><p class="ops-empty">194 international legs + ${items.length} transfer records · ${items.filter(m=>m.reviewStatus!=='reviewed').length} need review. Unpriced transfers are not included in the base budget.</p>`;
  }

  function movementTimeline(s){
    const items=runtime.operational?.movements||[];
    const card=m=>`<article class="ops-movement" data-movement-id="${esc(m.id)}"><small>TRANSFER · ${esc(m.reviewStatus)}</small><b>${esc(m.from)} → ${esc(m.to)}</b><span>${esc(m.mode||'Mode to confirm')} · ${m.distanceKm===null?'Distance unknown':`${m.distanceBasis==='geodesic-lower-bound'?'≥ ':''}${m.distanceKm} km (${m.distanceBasis==='geodesic-lower-bound'?'straight-line':'route estimate'})`}</span><span>${m.durationBasis==='planning-allowance'?'Time allowance':'Duration'}: ${m.plannedDuration===null?'unknown':m.plannedDuration+' min'} · Estimated cost: ${m.estimatedCost===null?'unpriced':euro(m.estimatedCost)}</span><span>Window: ${esc(m.planningWindow.after||'unknown')} → ${esc(m.planningWindow.before||'unknown')}</span><span>Status: ${esc(m.status)} · Booking: ${esc(m.bookingStatus)}</span><details><summary>Planning evidence and actuals</summary><p>${esc(m.notes)}</p><p>Last verified: ${esc(m.lastVerified||'Not verified')}<br>Actual departure: ${esc(m.actualDeparture||'Not recorded')}<br>Actual arrival: ${esc(m.actualArrival||'Not recorded')}<br>Actual cost: ${m.actualCost===null?'Not recorded':euro(m.actualCost)}</p></details></article>`;
    const before=items.filter(m=>m.parentBeforeLeg===Number(s.id)),after=items.filter(m=>m.parentAfterLeg===Number(s.id));
    return `<div class="ops-mini-title">Operational timeline</div><div class="ops-movements">${before.map(card).join('')}<div class="ops-macro">International leg #${s.id} · ${esc(routeLabel(s))}</div>${after.map(card).join('')}</div>`;
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
      ${movementSummary()}
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
      ${movementTimeline(s)}
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
    try{
      const response=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',{cache:'force-cache'});
      if(!response.ok)throw new Error(String(response.status));
      const geo=await response.json();
      const paths=(geo.features||[]).flatMap(geometryToPaths).filter(p=>p.points.length>1);
      globe.pathsData(paths).pathPoints('points').pathPointLat('lat').pathPointLng('lng')
        .pathColor(()=>document.body.classList.contains('story-mode')?'rgba(166,192,221,.24)':'rgba(151,184,218,.62)')
        .pathStroke(.24).pathPointAlt(.0018).pathResolution(1.25).pathTransitionDuration(0);
      globe.__oneWorldArtifactFreeBorders=true;
    }catch(err){runtime.outlineReady=false;console.warn('Artifact-free country outlines unavailable',err);}
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
      const [,module]=await Promise.all([
        loadStyle('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css'),
        import('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs')
      ]);
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
    const operational=await window.ONE_WORLD_MOVEMENTS.ready;
    runtime.movements=operational.movements;
    runtime.flightEndpoints=operational.flights.endpoints||{};
    const centroids=await centroidRes.json();
    if(waypointRes?.ok){
      const rows=await waypointRes.json();
      runtime.routeWaypoints=new Map(Object.entries(rows||{}).map(([id,points])=>[Number(id),points]));
    }
    for(const [id,g] of Object.entries(operational.flights.geometries))runtime.routeWaypoints.set(Number(id),g.coordinates);
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
    const allButton=$('#phaseRail button.active[data-phase="all"]');
    if(raw==='all'||allButton)return null;
    if(raw&&Number.isFinite(Number(raw)))return Number(raw);
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
    const endpoints=runtime.flightEndpoints?.[id];
    const airportPoint=p=>p?{lng:p.coordinates[0],lat:p.coordinates[1]}:null;
    const a=airportPoint(endpoints?.departure)||runtime.centroids.get(normalize(s.from));
    const b=airportPoint(endpoints?.arrival)||runtime.centroids.get(normalize(s.to));
    if(!a||!b)return[];
    return greatCirclePoints(a,b);
  }

  function segmentFeature(s){
    const points=segmentPathPoints(s);if(points.length<2)return null;
    const parts=splitDateline(points);
    const id=Number(s.id),visible=terrainSegmentVisible(s)||id===Number(runtime.selectedId);
    return {
      type:'Feature',properties:{id,phaseId:phaseIdFor(id),color:terrainColor(s),visible:visible?1:0,mode:String(s.mode||''),isFlight:/Flug/i.test(String(s.mode||''))?1:0,isConnector:0},
      geometry:parts.length>1?{type:'MultiLineString',coordinates:parts}:{type:'LineString',coordinates:parts[0]||[]}
    };
  }

  function connectorFeature(a,b){
    if(!a||!b||normalize(a.to)!==normalize(b.from))return null;
    const ap=segmentPathPoints(a),bp=segmentPathPoints(b);
    if(ap.length<2||bp.length<2)return null;
    const movement=runtime.movements?.find(m=>m.parentAfterLeg===Number(a.id)&&m.parentBeforeLeg===Number(b.id));
    const start=ap[ap.length-1],end=bp[0];
    const gap=angularDistance(start,end);
    if(!Number.isFinite(gap)||gap<.0009)return null;
    const corridor=movement?.coordinates?.length>=2?movement.coordinates:[start,end];
    const points=[];
    for(let i=1;i<corridor.length;i++){
      const from=corridor[i-1],to=corridor[i];
      const piece=greatCirclePoints({lng:from[0],lat:from[1]},{lng:to[0],lat:to[1]},Math.max(10,Math.min(48,Math.round(gap*1.8))));
      if(points.length)piece.shift();points.push(...piece);
    }
    const parts=splitDateline(points);
    const nextId=Number(b.id),visible=terrainSegmentVisible(a)||terrainSegmentVisible(b)||nextId===Number(runtime.selectedId);
    return {
      type:'Feature',
      properties:{
        id:-1000-Number(a.id),
        phaseId:phaseIdFor(nextId),
        color:terrainColor(b),
        visible:visible?1:0,
        mode:movement?.mode||'Unreviewed transfer',
        movementId:movement?.id||null,
        reviewStatus:movement?.reviewStatus||'needs-review',
        isFlight:0,
        isConnector:1,
        connectorFrom:Number(a.id),
        connectorTo:nextId,
        isActive:Number(runtime.selectedId)===Number(a.id)||Number(runtime.selectedId)===nextId?1:0,
        gapDeg:Math.round(gap*1000)/1000
      },
      geometry:parts.length>1?{type:'MultiLineString',coordinates:parts}:{type:'LineString',coordinates:parts[0]||[]}
    };
  }

  function routeGeoJson(){
    const rows=runtime.routeData?.segments||[];
    const features=rows.map(segmentFeature).filter(Boolean);
    for(let i=0;i<rows.length-1;i++){
      const connector=connectorFeature(rows[i],rows[i+1]);
      if(connector)features.push(connector);
    }
    return {type:'FeatureCollection',features};
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

  async function terrainStyle(){
    const phase=activeTerrainPhase();
    const phaseFilter=phase===null?['==',['get','phaseId'],-1]:['==',['get','phaseId'],phase];
    let base;
    try{
      const response=await fetch('https://tiles.openfreemap.org/styles/liberty',{cache:'force-cache'});
      if(!response.ok)throw new Error('OpenFreeMap style '+response.status);
      base=await response.json();
    }catch(err){
      console.warn('OpenFreeMap basemap unavailable; using terrain-only fallback',err);
      base={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#d9e5e8'}}]};
    }

    base.version=8;
    base.projection={type:'globe'};
    base.sources={...(base.sources||{}),
      terrainSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
      hillshadeSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
      routeSource:{type:'geojson',data:routeGeoJson()},
      countrySource:{type:'geojson',data:countryGeoJson()}
    };
    base.terrain={source:'terrainSource',exaggeration:1.34};
    base.sky={'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.42,3.5,.13,7,0]};

    const hill={
      id:'oneworld-hills',type:'hillshade',source:'hillshadeSource',
      paint:{'hillshade-method':'multidirectional','hillshade-exaggeration':.32,'hillshade-shadow-color':'#66757d','hillshade-highlight-color':'#f6f8f7','hillshade-accent-color':'#82939d'}
    };
    const overlays=[
      {id:'route-hit',type:'line',source:'routeSource',filter:['all',['==',['get','visible'],1],['==',['get','isConnector'],0]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(0,0,0,.001)','line-opacity':.001,'line-width':['interpolate',['linear'],['zoom'],2,12,7,16,12,20]}},
      {id:'route-backbone-shadow',type:'line',source:'routeSource',filter:['==',['get','visible'],1],maxzoom:5.8,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(2,8,15,.68)','line-opacity':['interpolate',['linear'],['zoom'],2,.38,4.4,.30,5.3,.12,5.75,0],'line-width':['interpolate',['linear'],['zoom'],2,2.6,4.4,2.25,5.75,1.7]}},
      {id:'route-backbone',type:'line',source:'routeSource',filter:['==',['get','visible'],1],maxzoom:5.8,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':['interpolate',['linear'],['zoom'],2,.62,4.4,.56,5.3,.22,5.75,0],'line-width':['interpolate',['linear'],['zoom'],2,1.25,4.4,1.12,5.75,.82]}},
      {id:'route-world-shadow',type:'line',source:'routeSource',filter:['==',['get','isFlight'],0],maxzoom:5.8,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(3,10,18,.58)','line-opacity':.24,'line-width':widthExpr(2.1,3.2,4.6)}},
      {id:'route-world',type:'line',source:'routeSource',filter:['==',['get','isFlight'],0],maxzoom:5.8,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['case',['==',['get','visible'],1],colorExpression(),'#6f8295'],'line-opacity':['case',['==',['get','visible'],1],.72,.16],'line-width':widthExpr(1.05,1.65,2.45)}},
      {id:'route-flights-shadow',type:'line',source:'routeSource',filter:['all',['==',['get','isFlight'],1],['!=',['get','id'],runtime.selectedId]],maxzoom:5.45,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(3,10,18,.72)','line-opacity':['interpolate',['linear'],['zoom'],2,.28,4,.18,5.15,.07,5.4,0],'line-width':['interpolate',['linear'],['zoom'],2,1.5,4,1.1,5.4,.72]}},
      {id:'route-flights-world',type:'line',source:'routeSource',filter:['all',['==',['get','isFlight'],1],['!=',['get','id'],runtime.selectedId]],maxzoom:5.45,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['case',['==',['get','visible'],1],colorExpression(),'#718399'],'line-opacity':['interpolate',['linear'],['zoom'],2,.52,4,.38,5.15,.15,5.4,0],'line-width':['interpolate',['linear'],['zoom'],2,1.0,4,.84,5.4,.58]}},
      {id:'route-phase-shadow',type:'line',source:'routeSource',filter:['all',phaseFilter,['==',['get','visible'],1],['==',['get','isFlight'],0]],maxzoom:5.8,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(4,10,16,.58)','line-opacity':$('#routeGlow')?.checked===false?.24:.64,'line-width':widthExpr(2.5,4.0,6.0)}},
      {id:'route-phase',type:'line',source:'routeSource',filter:['all',phaseFilter,['==',['get','visible'],1],['==',['get','isFlight'],0],['==',['get','isConnector'],0]],maxzoom:5.8,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':.94,'line-width':widthExpr(1.55,2.65,4.1)}},
      {id:'route-connectors-shadow',type:'line',source:'routeSource',filter:['all',['==',['get','isConnector'],1],['==',['get','visible'],1]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(3,10,18,.55)','line-opacity':['interpolate',['linear'],['zoom'],2,['case',['==',['get','isActive'],1],.4,.28],6,['case',['==',['get','isActive'],1],.4,['>', ['get','gapDeg'],5],.08,.34],10,['case',['==',['get','isActive'],1],.4,['>', ['get','gapDeg'],5],.02,.30]],'line-width':['interpolate',['linear'],['zoom'],2,1.7,6,2.3,10,3.0]}},
      {id:'route-connectors',type:'line',source:'routeSource',filter:['all',['==',['get','isConnector'],1],['==',['get','visible'],1]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':['interpolate',['linear'],['zoom'],2,['case',['==',['get','isActive'],1],.9,.48],6,['case',['==',['get','isActive'],1],.9,['>', ['get','gapDeg'],5],.15,.66],10,['case',['==',['get','isActive'],1],.9,['>', ['get','gapDeg'],5],.03,.62]],'line-width':['interpolate',['linear'],['zoom'],2,.85,6,1.25,10,1.65]}},
      {id:'route-local-shadow',type:'line',source:'routeSource',filter:['==',['get','id'],-1],minzoom:5.35,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(3,10,18,.62)','line-opacity':.48,'line-width':widthExpr(2.35,3.45,5.0)}},
      {id:'route-local',type:'line',source:'routeSource',filter:['==',['get','id'],-1],minzoom:5.35,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':.84,'line-width':widthExpr(1.3,2.05,3.0)}},
      {id:'selected-route-shadow',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(2,9,15,.74)','line-opacity':$('#routeGlow')?.checked===false?.34:.82,'line-width':widthExpr(4.0,6.4,9.0)}},
      {id:'selected-route',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#00ccef','line-opacity':1,'line-width':widthExpr(2.7,4.7,6.8)}},
      {id:'country-hit',type:'circle',source:'countrySource',layout:{visibility:$('#showPoints')?.checked===false?'none':'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,8,7,10,11,12],'circle-color':'rgba(0,0,0,.001)','circle-opacity':.001}},
      {id:'country-points',type:'circle',source:'countrySource',layout:{visibility:$('#showPoints')?.checked===false?'none':'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,1.55,7,2.7,11,4.1],'circle-color':'rgba(19,59,82,.82)','circle-stroke-color':'rgba(255,255,255,.92)','circle-stroke-width':1,'circle-opacity':['interpolate',['linear'],['zoom'],2,.52,5,.68,8,.88]}},
      {id:'country-selected',type:'circle',source:'countrySource',filter:['==',['get','name'],new URLSearchParams(location.search).get('country')||''],paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,4.8,7,6.6,11,8.4],'circle-color':'#17c9ed','circle-stroke-color':'#ffffff','circle-stroke-width':1.6,'circle-opacity':1}}
    ];

    const layers=Array.isArray(base.layers)?base.layers:[];
    const firstSymbol=layers.findIndex(l=>l.type==='symbol');
    if(firstSymbol>=0)layers.splice(firstSymbol,0,hill);else layers.push(hill);
    layers.push(...overlays);
    base.layers=layers;
    return base;
  }
  function deactivateTerrain({updateUrl=true}={}){
    runtime.terrainRequested=false;runtime.terrainActive=false;
    runtime.globe?.resumeAnimation?.();
    runtime.terrainMap?.stop?.();
    document.body.classList.remove('terrain-loading','terrain-view');setToggleState(false);setTerrainLabel('Real 3D globe terrain');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Drag to rotate · scroll to zoom · relief appears as you move closer';
    const high=$('#highDetailGlobe');if(high&&runtime.highDetailWasDisabled!==null){high.disabled=runtime.highDetailWasDisabled;runtime.highDetailWasDisabled=null;}const auto=$('#autoRotate');if(auto)auto.disabled=false;if(updateUrl)updateViewUrl(false);
  }

  function activateTerrain(){
    runtime.terrainRequested=false;runtime.terrainActive=true;
    runtime.globe?.pauseAnimation?.();
    document.body.classList.remove('terrain-loading');document.body.classList.add('terrain-view');setToggleState(true);setTerrainLabel('Real 3D globe terrain');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Drag to rotate · scroll to zoom · relief appears as you move closer';
    const high=$('#highDetailGlobe');if(high){if(runtime.highDetailWasDisabled===null)runtime.highDetailWasDisabled=high.disabled;high.disabled=true;}const auto=$('#autoRotate');if(auto)auto.disabled=true;updateViewUrl(true);syncTerrainSettings();
  }

  function failTerrain(message){console.warn(message);deactivateTerrain({updateUrl:true});notify(message)}

  async function initTerrainMap(){
    if(runtime.terrainReady)return;
    if(!runtime.initPromise)runtime.initPromise=createTerrainMap().finally(()=>{runtime.initPromise=null});
    return runtime.initPromise;
  }

  async function createTerrainMap(){
    runtime.selectedId=currentSegmentId();
    const [maplibregl,style]=await Promise.all([loadMapLibre(),loadRouteContext().then(terrainStyle)]);
    const center=selectedPosition();
    const map=new maplibregl.Map({
      container:'terrainMap',style,center,zoom:3.9,pitch:32,bearing:-6,
      minZoom:2.9,maxZoom:18,maxPitch:65,renderWorldCopies:false,attributionControl:true,
      canvasContextAttributes:{antialias:true}
    });

    clearTimeout(runtime.terrainFailTimer);
    runtime.terrainFailTimer=setTimeout(()=>{
      if(runtime.terrainRequested&&!runtime.terrainBaseReady)failTerrain('3D globe terrain could not be loaded. Standard globe restored.');
    },10000);

    map.on('style.load',()=>{
      try{map.setProjection({type:'globe'});}catch(err){console.warn('Globe projection unavailable',err)}
      try{map.setTerrain({source:'terrainSource',exaggeration:1.34});}catch(err){console.warn('Terrain could not be attached to globe projection',err)}
    });

    map.on('load',()=>{
      runtime.terrainBaseReady=true;clearTimeout(runtime.terrainFailTimer);
      syncTerrainSelection({fly:true});syncTerrainSettings();if(runtime.terrainRequested)activateTerrain();

      const routeLayers=['route-hit','selected-route','route-local','route-phase','route-world'];
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
      map.on('moveend',updateTerrainLocalContext);
      map.on('zoomend',updateTerrainLocalContext);
      updateTerrainLocalContext();
    });

    map.on('error',e=>{
      const msg=String(e?.error?.message||'');
      if(/style|source|tile|terrain|projection/i.test(msg))console.warn('Globe terrain resource error',e.error);
    });

    if(!window.matchMedia('(max-width: 820px)').matches){
      map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
      if(maplibregl.TerrainControl)map.addControl(new maplibregl.TerrainControl({source:'terrainSource',exaggeration:1.34}),'top-right');
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
    const widths={'route-world-shadow':widthExpr(2.1,3.2,4.6),'route-world':widthExpr(1.05,1.65,2.45),'route-phase-shadow':widthExpr(2.5,4.0,6.0),'route-phase':widthExpr(1.55,2.65,4.1),'route-local-shadow':widthExpr(2.35,3.45,5.0),'route-local':widthExpr(1.3,2.05,3.0),'selected-route-shadow':widthExpr(4.0,6.4,9.0),'selected-route':widthExpr(2.7,4.7,6.8)};
    Object.entries(widths).forEach(([id,value])=>{if(map.getLayer?.(id))map.setPaintProperty(id,'line-width',value)});
    const auto=$('#autoRotate');if(auto)auto.disabled=runtime.terrainActive||runtime.terrainRequested;
  }

  function syncTerrainHierarchy(){
    const map=runtime.terrainMap;if(!map)return;
    const phase=activeTerrainPhase();
    const phaseFilter=phase===null?['==',['get','phaseId'],-1]:['==',['get','phaseId'],phase];
    if(map.getLayer?.('route-hit'))map.setFilter('route-hit',['==',['get','visible'],1]);
    if(map.getLayer?.('route-phase'))map.setFilter('route-phase',['all',phaseFilter,['==',['get','visible'],1],['==',['get','isFlight'],0],['==',['get','isConnector'],0]]);
    if(map.getLayer?.('route-phase-shadow'))map.setFilter('route-phase-shadow',['all',phaseFilter,['==',['get','visible'],1],['==',['get','isFlight'],0],['==',['get','isConnector'],0]]);
    if(map.getLayer?.('route-flights-world'))map.setFilter('route-flights-world',['all',['==',['get','isFlight'],1],['==',['get','isConnector'],0],['!=',['get','id'],runtime.selectedId]]);
    if(map.getLayer?.('route-connectors'))map.setFilter('route-connectors',['all',['==',['get','isConnector'],1],['==',['get','visible'],1]]);
    if(map.getLayer?.('route-connectors-shadow'))map.setFilter('route-connectors-shadow',['all',['==',['get','isConnector'],1],['==',['get','visible'],1]]);
    updateTerrainLocalContext();
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
        const endpoints=runtime.flightEndpoints?.[Number(s.id)];
        const airportPoint=p=>p?{lng:p.coordinates[0],lat:p.coordinates[1]}:null;
        const a=airportPoint(endpoints?.departure)||runtime.centroids.get(normalize(s.from));
        const b=airportPoint(endpoints?.arrival)||runtime.centroids.get(normalize(s.to));
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

  function terrainLocalIds(){
    const map=runtime.terrainMap;
    if(!map||map.getZoom()<5.25)return[];
    const bounds=map.getBounds?.();if(!bounds)return[];
    const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
    const padLng=Math.max(1,(east-west)*.22),padLat=Math.max(.8,(north-south)*.22);
    const w=west-padLng,e=east+padLng,s=south-padLat,n=north+padLat;
    const inBox=([lng,lat])=>Number.isFinite(lng)&&Number.isFinite(lat)&&lat>=s&&lat<=n&&(w<=-180||e>=180?true:lng>=w&&lng<=e);
    const rows=runtime.routeData?.segments||[],ids=[];
    for(const seg of rows){
      if(/Flug/i.test(String(seg.mode||'')))continue;
      const points=segmentPathPoints(seg);
      if(points.some(inBox))ids.push(Number(seg.id));
      if(ids.length>=36)break;
    }
    return ids;
  }

  function updateTerrainLocalContext(){
    const map=runtime.terrainMap;if(!map)return;
    const ids=terrainLocalIds();
    const filter=ids.length?['in',['get','id'],['literal',ids]]:['==',['get','id'],-1];
    if(map.getLayer?.('route-local'))map.setFilter('route-local',filter);
    if(map.getLayer?.('route-local-shadow'))map.setFilter('route-local-shadow',filter);
  }

  function focusTerrainSegment(id,{duration=900}={}){
    const map=runtime.terrainMap;if(!map)return;
    const seg=runtime.routeData?.segments?.find(s=>Number(s.id)===Number(id));if(!seg)return;
    const points=segmentPathPoints(seg);if(points.length<2)return;
    const center=sphericalCenter(points);
    const spread=Math.max(...points.map(p=>angularDistance(center,p)));
    let zoom=spread<.35?8.0:spread<.8?7.25:spread<1.8?6.55:spread<4?5.8:spread<8?5.05:spread<18?4.25:spread<40?3.35:2.65;
    if(window.innerWidth<=820)zoom-=.18;
    const pitch=spread<4?42:spread<12?32:spread<35?20:8;
    map.easeTo({center,zoom,pitch,bearing:0,duration:$('#reducedMotion')?.checked?0:duration,essential:true});
    clearTimeout(runtime.localContextTimer);
    runtime.localContextTimer=setTimeout(updateTerrainLocalContext,duration+80);
  }

  function syncTerrainSelection({fly=false}={}){
    const map=runtime.terrainMap;if(!map)return;
    runtime.selectedId=currentSegmentId();
    syncTerrainData();syncTerrainHierarchy();syncTerrainCountry();syncTerrainSettings();updateTerrainLocalContext();
    if(!fly)return;
    focusTerrainSegment(runtime.selectedId,{duration:900});
  }

  async function setTerrainMode(active){
    if(active&&document.body.classList.contains('story-mode')){setToggleState(false);notify('Exit Story before opening 3D globe terrain.');return;}
    if(!active){deactivateTerrain({updateUrl:true});return;}
    if(runtime.terrainActive){setToggleState(true);return;}
    runtime.terrainRequested=true;document.body.classList.add('terrain-loading');setToggleState(true);setTerrainLabel('Loading 3D globe terrain…');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Loading globe, map and elevation data…';
    try{
      await initTerrainMap();runtime.terrainMap.resize();
      if(runtime.terrainBaseReady){activateTerrain();syncTerrainSelection({fly:true});}
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
  const EN=window.ONE_WORLD_EN||{locale:'en',country:s=>s,mode:s=>s};
  const UI_LOCALE=EN.locale||'en';
  const euro=v=>new Intl.NumberFormat(UI_LOCALE,{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v||0));
  const km=v=>new Intl.NumberFormat(UI_LOCALE,{maximumFractionDigits:0}).format(Math.round(v||0))+' km';
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
    const operational=await window.ONE_WORLD_MOVEMENTS.ready;
    for(const [id,g] of Object.entries(operational.flights.geometries))runtime.waypoints.set(Number(id),g.coordinates);
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
    if('serviceWorker'in navigator){
      const localPreview=['127.0.0.1','localhost','::1'].includes(location.hostname);
      if(localPreview){
        navigator.serviceWorker.getRegistrations?.().then(rows=>Promise.all(rows.map(r=>r.unregister()))).catch(()=>{});
        if('caches'in window)caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).catch(()=>{});
      }else navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker unavailable',err));
    }
  }

  async function init(){await load();wire();window.ONE_WORLD_RELEASE2={open,stats:computeStats,actual:()=>runtime.actual};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== platform.js ===== */
(() => {
  'use strict';

  const CATALOG_URL = './data/platform/trips.json';
  const PROFILE_KEY = 'one-world-route:traveller-context:v1';
  const SUPPORTED_LOCALES = ['en','de','it','es','fr','pt'];
  const I18N = {
    en:{routes:'Routes',traveller:'Traveller',flagship:'Flagship',template:'Template',open:'Open route',days:'days',stops:'stops',segments:'segments',global:'Global perspective',contextTitle:'Traveller context',contextLead:'Used to adapt entry rules, language, currency and departure assumptions. Stored only on this device.',passports:'Passport country',secondPassport:'Second passport (optional)',residence:'Residence',language:'Language',currency:'Currency',origin:'Starting city / airport',adults:'Adults',children:'Children',mobility:'Reduced mobility',save:'Save context',clear:'Clear',notSet:'Not set',currentCheck:'Current check required',routeLibrary:'Explore routes',routeLibraryLead:'One platform for world journeys, round trips, road trips, rail, cruises and more.',editorial:'Editorial template — verify transport, prices and entry requirements for your dates.',overview:'Route overview',day:'Day',nights:'nights',transport:'Transport',verification:'Verification',backWorld:'World route',private:'Private on this device. Passport numbers, booking references and payment details are never requested.',sourcedBeta:'Sourced beta',sources:'Sources',lastChecked:'Last checked',publishedFrom:'from',verified:'Verified',routeEvidence:'Route evidence',entryGuidance:'Entry guidance',officialCheck:'Official check',connectionRequired:'connection required',minimumTravel:'minimum travel',cruiseTemplate:'Cruise template',onboardNights:'onboard nights',seaDays:'sea days',portCall:'Port call',embarkation:'Embarkation',disembarkation:'Disembarkation',border:'Border context',schengenExit:'Schengen exit',schengenEntry:'Schengen re-entry',sailingNeeded:'Select a real sailing for ship, operator, times, berth and price.',illustrative:'Illustrative',searchRoutes:'Search routes',filterType:'Travel type',filterRegion:'Region',filterDuration:'Duration',all:'All',noRoutes:'No routes match these filters.',vehicleSection:'Vehicle context (optional)',vehicleType:'Vehicle',registrationCountry:'Registration country',fuelType:'Fuel / powertrain',euroClass:'Euro emissions class',rentalCrossBorder:'Rental approved for cross-border travel',privateCar:'Private car',rentalCar:'Rental car',camper:'Camper',motorcycle:'Motorcycle',otherVehicle:'Other',petrol:'Petrol',diesel:'Diesel',hybrid:'Hybrid',pluginHybrid:'Plug-in hybrid',electric:'Electric',hydrogen:'Hydrogen',unknown:'Unknown',roadRules:'Road context',crossBorder:'Cross-border',urbanAccess:'Urban access checks',vehicleNeeded:'Vehicle context required for toll, LEZ and access checks.',facet_world:'World',facet_round_trip:'Round trip',facet_road_trip:'Road trip',facet_cruise:'Cruise',facet_global:'Global',facet_europe:'Europe',facet_southern_europe:'Southern Europe',facet_italy:'Italy',facet_mediterranean:'Mediterranean',facet_north_africa:'North Africa',filterMode:'Transport',filterTheme:'Theme',results:'routes found',resetFilters:'Reset',details:'Details',start:'Start',finish:'Finish',previous:'Previous',next:'Next',type:'Type',country:'Country',duration:'Duration',cost:'Cost',segment:'Segment',stop:'Stop',currency:'Currency',facet_rail:'Rail',facet_bus:'Bus',facet_car:'Car',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Road',facet_coach:'Coach',facet_ground_transfer:'Ground transfer'},
    de:{routes:'Routen',traveller:'Traveller',flagship:'Flagship',template:'Vorlage',open:'Route öffnen',days:'Tage',stops:'Stopps',segments:'Segmente',global:'Globale Perspektive',contextTitle:'Traveller Context',contextLead:'Passt Einreisehinweise, Sprache, Währung und Startannahmen an. Wird nur auf diesem Gerät gespeichert.',passports:'Passland',secondPassport:'Zweiter Pass (optional)',residence:'Wohnsitz',language:'Sprache',currency:'Währung',origin:'Startstadt / Flughafen',adults:'Erwachsene',children:'Kinder',mobility:'Eingeschränkte Mobilität',save:'Kontext speichern',clear:'Zurücksetzen',notSet:'Nicht gesetzt',currentCheck:'Aktuelle Prüfung erforderlich',routeLibrary:'Routen entdecken',routeLibraryLead:'Eine Plattform für Weltreisen, Rundreisen, Roadtrips, Bahnreisen, Kreuzfahrten und mehr.',editorial:'Redaktionelle Vorlage — Verkehr, Preise und Einreisebedingungen für die eigenen Daten prüfen.',overview:'Routenübersicht',day:'Tag',nights:'Nächte',transport:'Verkehr',verification:'Prüfstatus',backWorld:'Weltreise',private:'Privat auf diesem Gerät. Passnummern, Buchungsreferenzen und Zahlungsdaten werden niemals abgefragt.',sourcedBeta:'Quellen-Beta',sources:'Quellen',lastChecked:'Zuletzt geprüft',publishedFrom:'ab',verified:'Verifiziert',routeEvidence:'Routenbelege',entryGuidance:'Einreisehinweise',officialCheck:'Offiziell prüfen',connectionRequired:'Umstieg einplanen',minimumTravel:'Mindestfahrzeit',cruiseTemplate:'Kreuzfahrt-Vorlage',onboardNights:'Nächte an Bord',seaDays:'Seetage',portCall:'Hafenstopp',embarkation:'Einschiffung',disembarkation:'Ausschiffung',border:'Grenzkontext',schengenExit:'Schengen-Ausreise',schengenEntry:'Schengen-Wiedereinreise',sailingNeeded:'Für Schiff, Reederei, Zeiten, Liegeplatz und Preis muss eine konkrete Abfahrt gewählt werden.',illustrative:'Illustrativ',searchRoutes:'Routen suchen',filterType:'Reiseart',filterRegion:'Region',filterDuration:'Dauer',all:'Alle',noRoutes:'Keine Route passt zu diesen Filtern.',vehicleSection:'Vehicle Context (optional)',vehicleType:'Fahrzeug',registrationCountry:'Zulassungsland',fuelType:'Kraftstoff / Antrieb',euroClass:'Euro-Abgasnorm',rentalCrossBorder:'Mietwagen für Grenzübertritte freigegeben',privateCar:'Privatwagen',rentalCar:'Mietwagen',camper:'Camper',motorcycle:'Motorrad',otherVehicle:'Anderes',petrol:'Benzin',diesel:'Diesel',hybrid:'Hybrid',pluginHybrid:'Plug-in-Hybrid',electric:'Elektro',hydrogen:'Wasserstoff',unknown:'Unbekannt',roadRules:'Straßenkontext',crossBorder:'Grenzübertritt',urbanAccess:'Stadtzufahrt prüfen',vehicleNeeded:'Für Maut-, Umweltzonen- und Zufahrtsprüfungen wird Vehicle Context benötigt.',facet_world:'Weltreise',facet_round_trip:'Rundreise',facet_road_trip:'Roadtrip',facet_cruise:'Kreuzfahrt',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Südeuropa',facet_italy:'Italien',facet_mediterranean:'Mittelmeer',facet_north_africa:'Nordafrika',filterMode:'Verkehrsmittel',filterTheme:'Reisethema',results:'Routen gefunden',resetFilters:'Filter zurücksetzen',details:'Details',start:'Start',finish:'Ziel',previous:'Zurück',next:'Weiter',type:'Typ',country:'Land',duration:'Dauer',cost:'Kosten',segment:'Segment',stop:'Stopp',currency:'Währung',facet_rail:'Bahn',facet_bus:'Bus',facet_car:'Auto',facet_ferry:'Fähre',facet_multimodal:'Multimodal',facet_road:'Straße',facet_coach:'Fernbus',facet_ground_transfer:'Bodentransfer'},
    it:{routes:'Itinerari',traveller:'Viaggiatore',flagship:'Flagship',template:'Modello',open:'Apri itinerario',days:'giorni',stops:'tappe',segments:'tratte',global:'Prospettiva globale',contextTitle:'Profilo viaggiatore',contextLead:'Adatta requisiti d’ingresso, lingua, valuta e partenza. Salvato solo su questo dispositivo.',passports:'Paese del passaporto',secondPassport:'Secondo passaporto (opzionale)',residence:'Residenza',language:'Lingua',currency:'Valuta',origin:'Città / aeroporto di partenza',adults:'Adulti',children:'Bambini',mobility:'Mobilità ridotta',save:'Salva',clear:'Cancella',notSet:'Non impostato',currentCheck:'Verifica attuale richiesta',routeLibrary:'Esplora itinerari',routeLibraryLead:'Una piattaforma per giri del mondo, road trip, treni, crociere e altro.',editorial:'Modello editoriale — verifica trasporti, prezzi e requisiti per le tue date.',overview:'Panoramica',day:'Giorno',nights:'notti',transport:'Trasporto',verification:'Verifica',backWorld:'Giro del mondo',private:'Privato su questo dispositivo. Non chiediamo numeri di passaporto, prenotazioni o dati di pagamento.',sourcedBeta:'Beta con fonti',sources:'Fonti',lastChecked:'Ultima verifica',publishedFrom:'da',verified:'Verificato',routeEvidence:'Fonti del percorso',entryGuidance:'Ingresso',officialCheck:'Verifica ufficiale',connectionRequired:'coincidenza necessaria',minimumTravel:'tempo minimo',cruiseTemplate:'Modello crociera',onboardNights:'notti a bordo',seaDays:'giorni in mare',portCall:'Scalo',embarkation:'Imbarco',disembarkation:'Sbarco',border:'Contesto di frontiera',schengenExit:'Uscita Schengen',schengenEntry:'Rientro Schengen',sailingNeeded:'Seleziona una partenza reale per nave, operatore, orari, ormeggio e prezzo.',illustrative:'Illustrativo',searchRoutes:'Cerca itinerari',filterType:'Tipo di viaggio',filterRegion:'Regione',filterDuration:'Durata',all:'Tutti',noRoutes:'Nessun itinerario corrisponde ai filtri.',vehicleSection:'Profilo veicolo (opzionale)',vehicleType:'Veicolo',registrationCountry:'Paese di immatricolazione',fuelType:'Carburante / propulsione',euroClass:'Classe Euro',rentalCrossBorder:'Noleggio autorizzato oltre confine',privateCar:'Auto privata',rentalCar:'Auto a noleggio',camper:'Camper',motorcycle:'Moto',otherVehicle:'Altro',petrol:'Benzina',diesel:'Diesel',hybrid:'Ibrido',pluginHybrid:'Ibrido plug-in',electric:'Elettrico',hydrogen:'Idrogeno',unknown:'Sconosciuto',roadRules:'Contesto stradale',crossBorder:'Transfrontaliero',urbanAccess:'Verifica accesso urbano',vehicleNeeded:'Il profilo veicolo è necessario per pedaggi, ZFE e accessi.',facet_world:'Giro del mondo',facet_round_trip:'Tour',facet_road_trip:'Road trip',facet_cruise:'Crociera',facet_global:'Globale',facet_europe:'Europa',facet_southern_europe:'Europa meridionale',facet_italy:'Italia',facet_mediterranean:'Mediterraneo',facet_north_africa:'Nord Africa',filterMode:'Trasporto',filterTheme:'Tema',results:'itinerari trovati',resetFilters:'Reimposta',details:'Dettagli',start:'Partenza',finish:'Arrivo',previous:'Indietro',next:'Avanti',type:'Tipo',country:'Paese',duration:'Durata',cost:'Costo',segment:'Tratta',stop:'Tappa',currency:'Valuta',facet_rail:'Treno',facet_bus:'Bus',facet_car:'Auto',facet_ferry:'Traghetto',facet_multimodal:'Multimodale',facet_road:'Strada',facet_coach:'Pullman',facet_ground_transfer:'Trasferimento terrestre'},
    es:{routes:'Rutas',traveller:'Viajero',flagship:'Flagship',template:'Plantilla',open:'Abrir ruta',days:'días',stops:'paradas',segments:'tramos',global:'Perspectiva global',contextTitle:'Contexto del viajero',contextLead:'Adapta requisitos de entrada, idioma, moneda y origen. Solo se guarda en este dispositivo.',passports:'País del pasaporte',secondPassport:'Segundo pasaporte (opcional)',residence:'Residencia',language:'Idioma',currency:'Moneda',origin:'Ciudad / aeropuerto de salida',adults:'Adultos',children:'Niños',mobility:'Movilidad reducida',save:'Guardar',clear:'Borrar',notSet:'Sin definir',currentCheck:'Revisión actual necesaria',routeLibrary:'Explorar rutas',routeLibraryLead:'Una plataforma para vueltas al mundo, road trips, trenes, cruceros y más.',editorial:'Plantilla editorial — verifica transporte, precios y requisitos para tus fechas.',overview:'Resumen de ruta',day:'Día',nights:'noches',transport:'Transporte',verification:'Verificación',backWorld:'Ruta mundial',private:'Privado en este dispositivo. Nunca pedimos números de pasaporte, reservas ni pagos.',sourcedBeta:'Beta con fuentes',sources:'Fuentes',lastChecked:'Última revisión',publishedFrom:'desde',verified:'Verificado',routeEvidence:'Fuentes de ruta',entryGuidance:'Entrada',officialCheck:'Comprobación oficial',connectionRequired:'conexión necesaria',minimumTravel:'tiempo mínimo',cruiseTemplate:'Plantilla de crucero',onboardNights:'noches a bordo',seaDays:'días de navegación',portCall:'Escala',embarkation:'Embarque',disembarkation:'Desembarque',border:'Contexto fronterizo',schengenExit:'Salida de Schengen',schengenEntry:'Reentrada a Schengen',sailingNeeded:'Selecciona una salida real para barco, operador, horarios, atraque y precio.',illustrative:'Ilustrativo',searchRoutes:'Buscar rutas',filterType:'Tipo de viaje',filterRegion:'Región',filterDuration:'Duración',all:'Todas',noRoutes:'Ninguna ruta coincide con los filtros.',vehicleSection:'Contexto del vehículo (opcional)',vehicleType:'Vehículo',registrationCountry:'País de matriculación',fuelType:'Combustible / propulsión',euroClass:'Clase Euro',rentalCrossBorder:'Alquiler autorizado para cruzar fronteras',privateCar:'Coche privado',rentalCar:'Coche de alquiler',camper:'Camper',motorcycle:'Moto',otherVehicle:'Otro',petrol:'Gasolina',diesel:'Diésel',hybrid:'Híbrido',pluginHybrid:'Híbrido enchufable',electric:'Eléctrico',hydrogen:'Hidrógeno',unknown:'Desconocido',roadRules:'Contexto vial',crossBorder:'Transfronterizo',urbanAccess:'Comprobar acceso urbano',vehicleNeeded:'Se requiere contexto del vehículo para peajes, ZBE y accesos.',facet_world:'Vuelta al mundo',facet_round_trip:'Ruta circular',facet_road_trip:'Road trip',facet_cruise:'Crucero',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Sur de Europa',facet_italy:'Italia',facet_mediterranean:'Mediterráneo',facet_north_africa:'Norte de África',filterMode:'Transporte',filterTheme:'Tema',results:'rutas encontradas',resetFilters:'Restablecer',details:'Detalles',start:'Inicio',finish:'Final',previous:'Anterior',next:'Siguiente',type:'Tipo',country:'País',duration:'Duración',cost:'Coste',segment:'Tramo',stop:'Parada',currency:'Moneda',facet_rail:'Tren',facet_bus:'Bus',facet_car:'Coche',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Carretera',facet_coach:'Autocar',facet_ground_transfer:'Traslado terrestre'},
    fr:{routes:'Itinéraires',traveller:'Voyageur',flagship:'Flagship',template:'Modèle',open:'Ouvrir',days:'jours',stops:'étapes',segments:'segments',global:'Perspective globale',contextTitle:'Contexte voyageur',contextLead:'Adapte formalités, langue, devise et départ. Stocké uniquement sur cet appareil.',passports:'Pays du passeport',secondPassport:'Deuxième passeport (facultatif)',residence:'Résidence',language:'Langue',currency:'Devise',origin:'Ville / aéroport de départ',adults:'Adultes',children:'Enfants',mobility:'Mobilité réduite',save:'Enregistrer',clear:'Effacer',notSet:'Non défini',currentCheck:'Vérification actuelle requise',routeLibrary:'Explorer les itinéraires',routeLibraryLead:'Une plateforme pour tours du monde, road trips, train, croisières et plus.',editorial:'Modèle éditorial — vérifiez transports, prix et formalités pour vos dates.',overview:'Aperçu',day:'Jour',nights:'nuits',transport:'Transport',verification:'Vérification',backWorld:'Tour du monde',private:'Privé sur cet appareil. Aucun numéro de passeport, référence de réservation ou paiement n’est demandé.',sourcedBeta:'Bêta sourcée',sources:'Sources',lastChecked:'Dernière vérification',publishedFrom:'à partir de',verified:'Vérifié',routeEvidence:'Sources de l’itinéraire',entryGuidance:'Entrée',officialCheck:'Vérification officielle',connectionRequired:'correspondance nécessaire',minimumTravel:'temps minimum',cruiseTemplate:'Modèle croisière',onboardNights:'nuits à bord',seaDays:'jours en mer',portCall:'Escale',embarkation:'Embarquement',disembarkation:'Débarquement',border:'Contexte frontalier',schengenExit:'Sortie Schengen',schengenEntry:'Rentrée Schengen',sailingNeeded:'Sélectionnez un départ réel pour le navire, l’opérateur, les horaires, le quai et le prix.',illustrative:'Illustratif',searchRoutes:'Rechercher des itinéraires',filterType:'Type de voyage',filterRegion:'Région',filterDuration:'Durée',all:'Tous',noRoutes:'Aucun itinéraire ne correspond aux filtres.',vehicleSection:'Contexte véhicule (facultatif)',vehicleType:'Véhicule',registrationCountry:'Pays d’immatriculation',fuelType:'Carburant / motorisation',euroClass:'Classe Euro',rentalCrossBorder:'Location autorisée à franchir les frontières',privateCar:'Voiture privée',rentalCar:'Voiture de location',camper:'Camping-car',motorcycle:'Moto',otherVehicle:'Autre',petrol:'Essence',diesel:'Diesel',hybrid:'Hybride',pluginHybrid:'Hybride rechargeable',electric:'Électrique',hydrogen:'Hydrogène',unknown:'Inconnu',roadRules:'Contexte routier',crossBorder:'Transfrontalier',urbanAccess:'Vérifier l’accès urbain',vehicleNeeded:'Le contexte véhicule est requis pour péages, ZFE et accès.',facet_world:'Tour du monde',facet_round_trip:'Circuit',facet_road_trip:'Road trip',facet_cruise:'Croisière',facet_global:'Mondial',facet_europe:'Europe',facet_southern_europe:'Europe du Sud',facet_italy:'Italie',facet_mediterranean:'Méditerranée',facet_north_africa:'Afrique du Nord',filterMode:'Transport',filterTheme:'Thème',results:'itinéraires trouvés',resetFilters:'Réinitialiser',details:'Détails',start:'Départ',finish:'Arrivée',previous:'Précédent',next:'Suivant',type:'Type',country:'Pays',duration:'Durée',cost:'Coût',segment:'Segment',stop:'Étape',currency:'Devise',facet_rail:'Train',facet_bus:'Bus',facet_car:'Voiture',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Route',facet_coach:'Autocar',facet_ground_transfer:'Transfert terrestre'},
    pt:{routes:'Rotas',traveller:'Viajante',flagship:'Flagship',template:'Modelo',open:'Abrir rota',days:'dias',stops:'paradas',segments:'trechos',global:'Perspectiva global',contextTitle:'Contexto do viajante',contextLead:'Adapta entrada, idioma, moeda e origem. Guardado apenas neste dispositivo.',passports:'País do passaporte',secondPassport:'Segundo passaporte (opcional)',residence:'Residência',language:'Idioma',currency:'Moeda',origin:'Cidade / aeroporto de partida',adults:'Adultos',children:'Crianças',mobility:'Mobilidade reduzida',save:'Salvar',clear:'Limpar',notSet:'Não definido',currentCheck:'Verificação atual necessária',routeLibrary:'Explorar rotas',routeLibraryLead:'Uma plataforma para voltas ao mundo, road trips, trem, cruzeiros e mais.',editorial:'Modelo editorial — verifique transporte, preços e entrada para suas datas.',overview:'Visão geral',day:'Dia',nights:'noites',transport:'Transporte',verification:'Verificação',backWorld:'Rota mundial',private:'Privado neste dispositivo. Nunca pedimos número de passaporte, referência de reserva ou pagamento.',sourcedBeta:'Beta com fontes',sources:'Fontes',lastChecked:'Última verificação',publishedFrom:'a partir de',verified:'Verificado',routeEvidence:'Fontes da rota',entryGuidance:'Entrada',officialCheck:'Verificação oficial',connectionRequired:'conexão necessária',minimumTravel:'tempo mínimo',cruiseTemplate:'Modelo de cruzeiro',onboardNights:'noites a bordo',seaDays:'dias no mar',portCall:'Escala',embarkation:'Embarque',disembarkation:'Desembarque',border:'Contexto de fronteira',schengenExit:'Saída de Schengen',schengenEntry:'Reentrada em Schengen',sailingNeeded:'Selecione uma partida real para navio, operadora, horários, cais e preço.',illustrative:'Ilustrativo',searchRoutes:'Pesquisar rotas',filterType:'Tipo de viagem',filterRegion:'Região',filterDuration:'Duração',all:'Todas',noRoutes:'Nenhuma rota corresponde aos filtros.',vehicleSection:'Contexto do veículo (opcional)',vehicleType:'Veículo',registrationCountry:'País de matrícula',fuelType:'Combustível / motorização',euroClass:'Classe Euro',rentalCrossBorder:'Aluguel autorizado para cruzar fronteiras',privateCar:'Carro particular',rentalCar:'Carro alugado',camper:'Motorhome',motorcycle:'Moto',otherVehicle:'Outro',petrol:'Gasolina',diesel:'Diesel',hybrid:'Híbrido',pluginHybrid:'Híbrido plug-in',electric:'Elétrico',hydrogen:'Hidrogênio',unknown:'Desconhecido',roadRules:'Contexto rodoviário',crossBorder:'Transfronteiriço',urbanAccess:'Verificar acesso urbano',vehicleNeeded:'O contexto do veículo é necessário para portagens, ZBE e acessos.',facet_world:'Volta ao mundo',facet_round_trip:'Roteiro circular',facet_road_trip:'Road trip',facet_cruise:'Cruzeiro',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Sul da Europa',facet_italy:'Itália',facet_mediterranean:'Mediterrâneo',facet_north_africa:'Norte da África',filterMode:'Transporte',filterTheme:'Tema',results:'rotas encontradas',resetFilters:'Redefinir',details:'Detalhes',start:'Início',finish:'Fim',previous:'Anterior',next:'Seguinte',type:'Tipo',country:'País',duration:'Duração',cost:'Custo',segment:'Trecho',stop:'Parada',currency:'Moeda',facet_rail:'Trem',facet_bus:'Ônibus',facet_car:'Carro',facet_ferry:'Balsa',facet_multimodal:'Multimodal',facet_road:'Estrada',facet_coach:'Ônibus rodoviário',facet_ground_transfer:'Transfer terrestre'}
  };


  const LEGACY_WORLD_TEXT = {
    de:{
      '195 countries · one continuous journey':'195 Länder · eine zusammenhängende Reise',
      'PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'ÖFFENTLICHER PLAN · STAND 17. SEP. 2026',
      'Every country.':'Jedes Land.','One route.':'Eine Route.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Ein transparentes Projekt, das alle 195 souveränen Staaten zu einer zusammenhängenden Reise verbindet – mit offen dargestellten Verkehrsetappen, Visa, Kosten und Einschränkungen.',
      'Explore':'Erkunden','Operations':'Operationen','Country, segment, route…':'Land, Segment, Route…',
      'Layer':'Ebene','Reset':'Zurücksetzen','Route':'Route','Status':'Status','Visa':'Visum','Health':'Gesundheit','Cost':'Kosten','Risk':'Risiko','Progress':'Fortschritt','Critical':'Kritisch',
      'Filters':'Filter','Transport':'Verkehrsmittel','All modes':'Alle Verkehrsmittel','Booking tier':'Buchungsstufe','All tiers':'Alle Stufen','Feasibility':'Machbarkeit','All':'Alle','Alert':'Warnstufe','All alerts':'Alle Warnstufen',
      'Journey intelligence':'Reiseanalyse','Install':'Installieren','Stats':'Statistik','Live':'Live','Journal':'Reisetagebuch','Changes':'Änderungen',
      'Overview':'Übersicht','Details':'Details','Ops':'Betrieb','Sources':'Quellen','Speed':'Tempo','START':'START','FINISH':'ZIEL',
      'Globe settings':'Globus-Einstellungen','Auto rotate':'Automatisch drehen','High detail globe':'Hochauflösender Globus','Real 3D globe terrain':'Echtes 3D-Terrain','Country points':'Länderpunkte','Route glow':'Routenleuchten','Arc thickness':'Linienstärke','Reduced motion':'Reduzierte Bewegung','Share view':'Ansicht teilen','Methodology':'Methodik',
      'METHODOLOGY':'METHODIK','A public travel-operations experiment.':'Ein öffentliches Reiseplanungs-Experiment.',
      'This explorer is generated from a private operational master workbook. Only publication-safe fields are exported. Booking references, payment data, passport details, insurance identifiers, private document links and personal contacts never enter the public dataset.':'Dieser Explorer wird aus einer privaten operativen Masterplanung erzeugt. Veröffentlicht werden nur unkritische Felder. Buchungsreferenzen, Zahlungsdaten, Passdaten, Versicherungskennungen, private Dokumentlinks und persönliche Kontakte gelangen niemals in den öffentlichen Datensatz.',
      'Sovereign states in scope':'Souveräne Staaten im Umfang','International legs':'Internationale Legs','Planned days':'Geplante Tage','Base planning envelope':'Basis-Planungsrahmen',
      'What “verified” means':'Was „verifiziert“ bedeutet','Segments may cite airlines, immigration authorities or government sources. A published transport corridor is not a safety recommendation. Volatile borders and high-risk states are intentionally surfaced as uncertainty rather than hidden.':'Segmente können Airlines, Einwanderungsbehörden oder Regierungsquellen zitieren. Eine veröffentlichte Verkehrsverbindung ist keine Sicherheitsempfehlung. Volatile Grenzen und Hochrisikostaaten werden bewusst als Unsicherheit sichtbar gemacht und nicht verborgen.',
      'North Korea':'Nordkorea','DPRK remains outside the executable 194-country calendar until legal tourism for the relevant passport is operationally available. It is never counted as completed without legal physical entry.':'Nordkorea bleibt außerhalb des ausführbaren 194-Länder-Kalenders, bis legaler Tourismus für den jeweiligen Pass tatsächlich möglich ist. Ohne legale physische Einreise wird es niemals als abgeschlossen gezählt.',
      'Search a country, segment, visa, transport…':'Land, Segment, Visum oder Verkehrsmittel suchen…','Search results':'Suchergebnisse','Jump to route':'Zur Route springen',
      'Play the journey':'Reise abspielen','Follow all 194 route legs':'Allen 194 Etappen folgen','Exit story':'Story beenden','Current chapter':'Aktuelles Kapitel','Journey position':'Reiseposition','Route context':'Routenkontext',
      'Country':'Land','Readiness':'Bereitschaft','Planned entry':'Geplante Einreise','Arrival':'Ankunft','Next':'Weiter','Departure':'Abfahrt','Phase':'Phase','Plan budget':'Planbudget','Why this route?':'Warum diese Route?',
      'visible legs':'sichtbare Legs','transport model':'Verkehrsmodell','critical':'kritisch','countries':'Länder','planned days':'geplante Tage','intl. legs':'internationale Legs','base model':'Basismodell',
      'Route legs':'Routen-Legs','Planned duration':'Geplante Dauer','Route distance':'Routendistanz','Transport model':'Verkehrsmodell','Chapters':'Kapitel','Transport mix':'Verkehrsmix','sovereign states':'souveräne Staaten','executable segments':'ausführbare Segmente','continuous route':'zusammenhängende Route','No actual journey events yet.':'Noch keine tatsächlichen Reiseereignisse.'
    },
    it:{
      '195 countries · one continuous journey':'195 paesi · un unico viaggio continuo','PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'PIANO PUBBLICO · AGGIORNATO 17 SET 2026','Every country.':'Ogni paese.','One route.':'Un solo itinerario.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Un progetto trasparente per collegare tutti i 195 stati sovrani in un unico viaggio continuo, con trasporti, visti, costi e vincoli mostrati apertamente.',
      'Explore':'Esplora','Operations':'Operazioni','Country, segment, route…':'Paese, segmento, itinerario…','Layer':'Livello','Reset':'Reimposta','Route':'Itinerario','Status':'Stato','Visa':'Visto','Health':'Salute','Cost':'Costo','Risk':'Rischio','Progress':'Progresso','Critical':'Critico',
      'Filters':'Filtri','Transport':'Trasporto','All modes':'Tutti i mezzi','Booking tier':'Livello prenotazione','All tiers':'Tutti i livelli','Feasibility':'Fattibilità','All':'Tutti','Alert':'Avviso','All alerts':'Tutti gli avvisi',
      'Journey intelligence':'Analisi del viaggio','Install':'Installa','Stats':'Statistiche','Live':'Live','Journal':'Diario','Changes':'Modifiche','Overview':'Panoramica','Details':'Dettagli','Ops':'Operazioni','Sources':'Fonti','Speed':'Velocità','START':'PARTENZA','FINISH':'ARRIVO',
      'Globe settings':'Impostazioni globo','Auto rotate':'Rotazione automatica','High detail globe':'Globo ad alta definizione','Real 3D globe terrain':'Terreno 3D reale','Country points':'Punti dei paesi','Route glow':'Bagliore itinerario','Arc thickness':'Spessore linee','Reduced motion':'Movimento ridotto','Share view':'Condividi vista','Methodology':'Metodologia',
      'METHODOLOGY':'METODOLOGIA','A public travel-operations experiment.':'Un esperimento pubblico di pianificazione dei viaggi.','Sovereign states in scope':'Stati sovrani inclusi','International legs':'Tratte internazionali','Planned days':'Giorni pianificati','Base planning envelope':'Budget base di pianificazione',
      'What “verified” means':'Cosa significa “verificato”','North Korea':'Corea del Nord','Search a country, segment, visa, transport…':'Cerca paese, segmento, visto o trasporto…','Search results':'Risultati','Jump to route':'Vai all’itinerario',
      'Play the journey':'Riproduci il viaggio','Follow all 194 route legs':'Segui tutte le 194 tratte','Exit story':'Esci dalla storia','Current chapter':'Capitolo attuale','Journey position':'Posizione nel viaggio','Route context':'Contesto itinerario','Country':'Paese','Readiness':'Prontezza','Planned entry':'Ingresso previsto','Arrival':'Arrivo','Next':'Successivo','Departure':'Partenza','Phase':'Fase','Plan budget':'Budget previsto','Why this route?':'Perché questo itinerario?','visible legs':'tratte visibili','transport model':'modello trasporti','critical':'critico','countries':'paesi','planned days':'giorni previsti','intl. legs':'tratte internazionali','base model':'modello base'
    },
    es:{
      '195 countries · one continuous journey':'195 países · un viaje continuo','PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'PLAN PÚBLICO · ACTUALIZADO 17 SEP 2026','Every country.':'Cada país.','One route.':'Una ruta.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Un proyecto transparente para conectar los 195 estados soberanos en un único viaje continuo, mostrando transportes, visados, costes y restricciones.',
      'Explore':'Explorar','Operations':'Operaciones','Country, segment, route…':'País, segmento, ruta…','Layer':'Capa','Reset':'Restablecer','Route':'Ruta','Status':'Estado','Visa':'Visado','Health':'Salud','Cost':'Coste','Risk':'Riesgo','Progress':'Progreso','Critical':'Crítico',
      'Filters':'Filtros','Transport':'Transporte','All modes':'Todos los medios','Booking tier':'Nivel de reserva','All tiers':'Todos los niveles','Feasibility':'Viabilidad','All':'Todos','Alert':'Alerta','All alerts':'Todas las alertas','Journey intelligence':'Análisis del viaje','Install':'Instalar','Stats':'Estadísticas','Live':'En vivo','Journal':'Diario','Changes':'Cambios',
      'Overview':'Resumen','Details':'Detalles','Ops':'Operaciones','Sources':'Fuentes','Speed':'Velocidad','START':'INICIO','FINISH':'FINAL','Globe settings':'Ajustes del globo','Auto rotate':'Rotación automática','High detail globe':'Globo de alta definición','Real 3D globe terrain':'Terreno 3D real','Country points':'Puntos de países','Route glow':'Brillo de ruta','Arc thickness':'Grosor de líneas','Reduced motion':'Movimiento reducido','Share view':'Compartir vista','Methodology':'Metodología',
      'METHODOLOGY':'METODOLOGÍA','A public travel-operations experiment.':'Un experimento público de planificación de viajes.','Sovereign states in scope':'Estados soberanos incluidos','International legs':'Tramos internacionales','Planned days':'Días previstos','Base planning envelope':'Marco presupuestario base','What “verified” means':'Qué significa “verificado”','North Korea':'Corea del Norte',
      'Search a country, segment, visa, transport…':'Buscar país, segmento, visado o transporte…','Search results':'Resultados','Jump to route':'Ir a la ruta','Play the journey':'Reproducir el viaje','Follow all 194 route legs':'Seguir los 194 tramos','Exit story':'Salir de la historia','Current chapter':'Capítulo actual','Journey position':'Posición del viaje','Route context':'Contexto de ruta','Country':'País','Readiness':'Preparación','Planned entry':'Entrada prevista','Arrival':'Llegada','Next':'Siguiente','Departure':'Salida','Phase':'Fase','Plan budget':'Presupuesto previsto','Why this route?':'¿Por qué esta ruta?','visible legs':'tramos visibles','transport model':'modelo de transporte','critical':'crítico','countries':'países','planned days':'días previstos','intl. legs':'tramos internacionales','base model':'modelo base'
    },
    fr:{
      '195 countries · one continuous journey':'195 pays · un voyage continu','PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'PLAN PUBLIC · MISE À JOUR 17 SEPT. 2026','Every country.':'Chaque pays.','One route.':'Un seul itinéraire.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Un projet transparent pour relier les 195 États souverains en un seul voyage continu, avec transports, visas, coûts et contraintes affichés ouvertement.',
      'Explore':'Explorer','Operations':'Opérations','Country, segment, route…':'Pays, segment, itinéraire…','Layer':'Couche','Reset':'Réinitialiser','Route':'Itinéraire','Status':'Statut','Visa':'Visa','Health':'Santé','Cost':'Coût','Risk':'Risque','Progress':'Progression','Critical':'Critique',
      'Filters':'Filtres','Transport':'Transport','All modes':'Tous les modes','Booking tier':'Niveau de réservation','All tiers':'Tous les niveaux','Feasibility':'Faisabilité','All':'Tous','Alert':'Alerte','All alerts':'Toutes les alertes','Journey intelligence':'Analyse du voyage','Install':'Installer','Stats':'Statistiques','Live':'En direct','Journal':'Journal','Changes':'Modifications',
      'Overview':'Aperçu','Details':'Détails','Ops':'Opérations','Sources':'Sources','Speed':'Vitesse','START':'DÉPART','FINISH':'ARRIVÉE','Globe settings':'Réglages du globe','Auto rotate':'Rotation automatique','High detail globe':'Globe haute définition','Real 3D globe terrain':'Relief 3D réel','Country points':'Points pays','Route glow':'Lueur de route','Arc thickness':'Épaisseur des lignes','Reduced motion':'Mouvement réduit','Share view':'Partager la vue','Methodology':'Méthodologie',
      'METHODOLOGY':'MÉTHODOLOGIE','A public travel-operations experiment.':'Une expérimentation publique de planification de voyage.','Sovereign states in scope':'États souverains couverts','International legs':'Étapes internationales','Planned days':'Jours planifiés','Base planning envelope':'Budget de planification de base','What “verified” means':'Ce que signifie « vérifié »','North Korea':'Corée du Nord',
      'Search a country, segment, visa, transport…':'Rechercher pays, segment, visa ou transport…','Search results':'Résultats','Jump to route':'Aller à l’itinéraire','Play the journey':'Lire le voyage','Follow all 194 route legs':'Suivre les 194 étapes','Exit story':'Quitter le récit','Current chapter':'Chapitre actuel','Journey position':'Position du voyage','Route context':'Contexte de route','Country':'Pays','Readiness':'Préparation','Planned entry':'Entrée prévue','Arrival':'Arrivée','Next':'Suivant','Departure':'Départ','Phase':'Phase','Plan budget':'Budget prévu','Why this route?':'Pourquoi cet itinéraire ?','visible legs':'étapes visibles','transport model':'modèle de transport','critical':'critique','countries':'pays','planned days':'jours planifiés','intl. legs':'étapes internationales','base model':'modèle de base'
    },
    pt:{
      '195 countries · one continuous journey':'195 países · uma viagem contínua','PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'PLANO PÚBLICO · ATUALIZADO 17 SET 2026','Every country.':'Cada país.','One route.':'Uma rota.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Um projeto transparente para ligar os 195 estados soberanos numa única viagem contínua, mostrando transportes, vistos, custos e restrições.',
      'Explore':'Explorar','Operations':'Operações','Country, segment, route…':'País, segmento, rota…','Layer':'Camada','Reset':'Redefinir','Route':'Rota','Status':'Estado','Visa':'Visto','Health':'Saúde','Cost':'Custo','Risk':'Risco','Progress':'Progresso','Critical':'Crítico',
      'Filters':'Filtros','Transport':'Transporte','All modes':'Todos os meios','Booking tier':'Nível de reserva','All tiers':'Todos os níveis','Feasibility':'Viabilidade','All':'Todos','Alert':'Alerta','All alerts':'Todos os alertas','Journey intelligence':'Análise da viagem','Install':'Instalar','Stats':'Estatísticas','Live':'Ao vivo','Journal':'Diário','Changes':'Alterações',
      'Overview':'Visão geral','Details':'Detalhes','Ops':'Operações','Sources':'Fontes','Speed':'Velocidade','START':'INÍCIO','FINISH':'FIM','Globe settings':'Definições do globo','Auto rotate':'Rotação automática','High detail globe':'Globo de alta definição','Real 3D globe terrain':'Terreno 3D real','Country points':'Pontos dos países','Route glow':'Brilho da rota','Arc thickness':'Espessura das linhas','Reduced motion':'Movimento reduzido','Share view':'Partilhar vista','Methodology':'Metodologia',
      'METHODOLOGY':'METODOLOGIA','A public travel-operations experiment.':'Uma experiência pública de planeamento de viagem.','Sovereign states in scope':'Estados soberanos abrangidos','International legs':'Trechos internacionais','Planned days':'Dias planeados','Base planning envelope':'Orçamento base de planeamento','What “verified” means':'O que significa “verificado”','North Korea':'Coreia do Norte',
      'Search a country, segment, visa, transport…':'Pesquisar país, segmento, visto ou transporte…','Search results':'Resultados','Jump to route':'Ir para a rota','Play the journey':'Reproduzir a viagem','Follow all 194 route legs':'Seguir os 194 trechos','Exit story':'Sair da história','Current chapter':'Capítulo atual','Journey position':'Posição na viagem','Route context':'Contexto da rota','Country':'País','Readiness':'Preparação','Planned entry':'Entrada planeada','Arrival':'Chegada','Next':'Seguinte','Departure':'Partida','Phase':'Fase','Plan budget':'Orçamento previsto','Why this route?':'Porquê esta rota?','visible legs':'trechos visíveis','transport model':'modelo de transporte','critical':'crítico','countries':'países','planned days':'dias planeados','intl. legs':'trechos internacionais','base model':'modelo base'
    }
  };

  const LEGACY_PHASES={
    de:{'Europe I':'Europa I','North & Central America':'Nord- & Mittelamerika','Caribbean':'Karibik','South America':'Südamerika','South Pacific':'Südpazifik','Southeast Asia & Indian Ocean':'Südostasien & Indischer Ozean','East & Central Asia':'Ost- & Zentralasien','Levant & North Africa':'Levante & Nordafrika','West & Central Africa':'West- & Zentralafrika','Southern & East Africa':'Süd- & Ostafrika','Gulf & Levant':'Golf & Levante','Europe II · Finish':'Europa II · Ziel'},
    it:{'Europe I':'Europa I','North & Central America':'Nord e Centro America','Caribbean':'Caraibi','South America':'Sud America','South Pacific':'Pacifico meridionale','Southeast Asia & Indian Ocean':'Sud-est asiatico e Oceano Indiano','East & Central Asia':'Asia orientale e centrale','Levant & North Africa':'Levante e Nord Africa','West & Central Africa':'Africa occidentale e centrale','Southern & East Africa':'Africa meridionale e orientale','Gulf & Levant':'Golfo e Levante','Europe II · Finish':'Europa II · Arrivo'},
    es:{'Europe I':'Europa I','North & Central America':'Norte y Centroamérica','Caribbean':'Caribe','South America':'Sudamérica','South Pacific':'Pacífico Sur','Southeast Asia & Indian Ocean':'Sudeste Asiático y Océano Índico','East & Central Asia':'Asia Oriental y Central','Levant & North Africa':'Levante y Norte de África','West & Central Africa':'África Occidental y Central','Southern & East Africa':'África Meridional y Oriental','Gulf & Levant':'Golfo y Levante','Europe II · Finish':'Europa II · Final'},
    fr:{'Europe I':'Europe I','North & Central America':'Amérique du Nord et centrale','Caribbean':'Caraïbes','South America':'Amérique du Sud','South Pacific':'Pacifique Sud','Southeast Asia & Indian Ocean':'Asie du Sud-Est et océan Indien','East & Central Asia':'Asie de l’Est et centrale','Levant & North Africa':'Levant et Afrique du Nord','West & Central Africa':'Afrique de l’Ouest et centrale','Southern & East Africa':'Afrique australe et orientale','Gulf & Levant':'Golfe et Levant','Europe II · Finish':'Europe II · Arrivée'},
    pt:{'Europe I':'Europa I','North & Central America':'América do Norte e Central','Caribbean':'Caraíbas','South America':'América do Sul','South Pacific':'Pacífico Sul','Southeast Asia & Indian Ocean':'Sudeste Asiático e Oceano Índico','East & Central Asia':'Ásia Oriental e Central','Levant & North Africa':'Levante e Norte de África','West & Central Africa':'África Ocidental e Central','Southern & East Africa':'África Austral e Oriental','Gulf & Levant':'Golfo e Levante','Europe II · Finish':'Europa II · Fim'}
  };

  const LEGACY_EXTRA={
    de:{
      'Europe':'Europa','Western Europe':'Westeuropa','Eastern Europe':'Osteuropa','Northern Europe':'Nordeuropa','Southern Europe':'Südeuropa','Asia':'Asien','Africa':'Afrika','Americas':'Amerika','Oceania':'Ozeanien',
      'Ready':'Bereit','READY':'BEREIT','Blocked':'Blockiert','BLOCKED':'BLOCKIERT','Pending':'Ausstehend','Conditional':'Bedingt','Critical':'Kritisch','Verified':'Verifiziert','Not verified':'Nicht verifiziert','Not recorded':'Nicht erfasst','Not started':'Nicht gestartet',
      'Action':'Aktion','From':'Von','Duration':'Dauer','Distance unknown':'Distanz unbekannt','Mode to confirm':'Verkehrsmittel prüfen','Plan depart':'Plan-Abfahrt','Plan arrive':'Plan-Ankunft','Planned':'Geplant','Planned start':'Geplanter Start','Actual status':'Ist-Status','Actual spend':'Tatsächliche Ausgaben','Last update':'Letzte Aktualisierung',
      'Clear / approved':'Frei / genehmigt','Conditional feasibility':'Bedingte Machbarkeit','Critical feasibility':'Kritische Machbarkeit','Plannable / verified':'Planbar / verifiziert','Countries in legs':'Länder in Legs','Countries without coordinates':'Länder ohne Koordinaten','Cumulative transport budget':'Kumuliertes Verkehrsbudget','Other hidden':'Weitere ausgeblendet',
      'Next segment':'Nächstes Segment','Play / pause journey':'Reise starten / pausieren','Play journey from here':'Reise ab hier starten','Play or pause journey':'Reise starten oder pausieren','Close':'Schließen','Copy the URL from your browser':'URL aus dem Browser kopieren',
      'Loading 3D globe terrain…':'3D-Globus-Terrain wird geladen…','Loading globe, map and elevation data…':'Globus, Karte und Höhendaten werden geladen…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Ziehen zum Drehen · scrollen zum Zoomen · Relief erscheint beim Annähern',
      '3D globe terrain mode unavailable':'3D-Globus-Terrain nicht verfügbar','3D globe terrain could not be initialized. Standard globe restored.':'3D-Terrain konnte nicht initialisiert werden. Standardglobus wiederhergestellt.','3D globe terrain could not be loaded. Standard globe restored.':'3D-Terrain konnte nicht geladen werden. Standardglobus wiederhergestellt.',
      'The journey begins across Europe.':'Die Reise beginnt durch Europa.','Across the Atlantic into North America.':'Über den Atlantik nach Nordamerika.','Island connections and short regional hops.':'Inselverbindungen und kurze regionale Etappen.','A continuous line through South America.':'Eine zusammenhängende Route durch Südamerika.','The route opens into the Pacific.':'Die Route öffnet sich in den Pazifik.','Dense regional links and island crossings.':'Dichte Regionalverbindungen und Inselquerungen.','Long-distance transitions across Asia.':'Langstreckenübergänge durch Asien.','A compact but operationally complex chapter.':'Ein kompaktes, operativ anspruchsvolles Kapitel.','Overland and air corridors across West Africa.':'Land- und Flugkorridore durch Westafrika.','The route turns south, then back north-east.':'Die Route führt nach Süden und anschließend wieder nach Nordosten.','The final Middle East sequence.':'Die letzte Nahost-Sequenz.','The closing run back to Germany.':'Die abschließende Etappe zurück nach Deutschland.','The planned continuous route returns to Germany.':'Die geplante zusammenhängende Route kehrt nach Deutschland zurück.',
      'Route legs':'Routen-Legs',
      'Planned duration':'Geplante Dauer',
      'Route distance':'Routendistanz',
      'Transport model':'Verkehrsmodell',
      'Chapters':'Kapitel',
      'Transport mix':'Verkehrsmix',
      'sovereign states':'souveräne Staaten',
      'executable segments':'ausführbare Segmente',
      'continuous route':'zusammenhängende Route',
      'corridor / geodesic estimate':'Korridor-/Geodäsie-Schätzung',
      'public segment budget':'öffentliches Segmentbudget',
      'No actual journey events yet.':'Noch keine tatsächlichen Reiseereignisse.',
      'Journal ready for departure':'Reisetagebuch bereit für den Start',
      'Photos and short field notes can be attached to countries, route legs and travel days without turning the site into a generic blog.':'Fotos und kurze Notizen können Ländern, Routen-Legs und Reisetagen zugeordnet werden, ohne die Seite in einen allgemeinen Blog zu verwandeln.',
      'Media schema is active; there are no public travel entries before departure.':'Das Medienschema ist aktiv; vor dem Start gibt es keine öffentlichen Reiseeinträge.',
      'Actual journey data is being compared with the public plan.':'Tatsächliche Reisedaten werden mit dem öffentlichen Plan verglichen.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'Die öffentliche Live-Ebene ist bereit. Tatsächliche Check-ins erscheinen hier nach Reisebeginn.',
      'Starts in':'Start in',
      'Ready to depart':'Bereit zur Abreise',
      'JOURNEY COMPLETE':'REISE ABGESCHLOSSEN',
    },
    it:{
      'Europe':'Europa','Western Europe':'Europa occidentale','Eastern Europe':'Europa orientale','Northern Europe':'Europa settentrionale','Southern Europe':'Europa meridionale','Asia':'Asia','Africa':'Africa','Americas':'Americhe','Oceania':'Oceania',
      'Ready':'Pronto','READY':'PRONTO','Blocked':'Bloccato','BLOCKED':'BLOCCATO','Pending':'In sospeso','Conditional':'Condizionato','Critical':'Critico','Verified':'Verificato','Not verified':'Non verificato','Not recorded':'Non registrato','Not started':'Non iniziato',
      'Action':'Azione','From':'Da','Duration':'Durata','Distance unknown':'Distanza sconosciuta','Mode to confirm':'Mezzo da confermare','Plan depart':'Partenza prevista','Plan arrive':'Arrivo previsto','Planned':'Pianificato','Planned start':'Partenza prevista','Actual status':'Stato reale','Actual spend':'Spesa reale','Last update':'Ultimo aggiornamento',
      'Next segment':'Tratta successiva','Play / pause journey':'Avvia / pausa viaggio','Play journey from here':'Avvia il viaggio da qui','Close':'Chiudi','Copy the URL from your browser':'Copia l’URL dal browser',
      'Loading 3D globe terrain…':'Caricamento terreno 3D…','Loading globe, map and elevation data…':'Caricamento globo, mappa e dati altimetrici…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Trascina per ruotare · scorri per zoomare · il rilievo appare avvicinandoti',
      'Route legs':'Tratte',
      'Planned duration':'Durata prevista',
      'Route distance':'Distanza itinerario',
      'Transport model':'Modello trasporti',
      'Chapters':'Capitoli',
      'Transport mix':'Mix trasporti',
      'sovereign states':'stati sovrani',
      'executable segments':'segmenti eseguibili',
      'continuous route':'itinerario continuo',
      'corridor / geodesic estimate':'stima corridoio / geodetica',
      'public segment budget':'budget pubblico dei segmenti',
      'No actual journey events yet.':'Nessun evento reale del viaggio.',
      'Journal ready for departure':'Diario pronto per la partenza',
      'Actual journey data is being compared with the public plan.':'I dati reali del viaggio vengono confrontati con il piano pubblico.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'Il livello live pubblico è pronto. I check-in reali appariranno quando inizierà il viaggio.',
      'Starts in':'Inizia tra',
      'Ready to depart':'Pronto alla partenza',
      'JOURNEY COMPLETE':'VIAGGIO COMPLETATO',
      'The journey begins across Europe.':'Il viaggio inizia attraverso l’Europa.',
      'Across the Atlantic into North America.':'Attraverso l’Atlantico verso il Nord America.',
      'Island connections and short regional hops.':'Collegamenti tra isole e brevi tratte regionali.',
      'A continuous line through South America.':'Un itinerario continuo attraverso il Sud America.',
      'The route opens into the Pacific.':'L’itinerario si apre sul Pacifico.',
      'Dense regional links and island crossings.':'Fitti collegamenti regionali e traversate tra isole.',
      'Long-distance transitions across Asia.':'Lunghe transizioni attraverso l’Asia.',
      'A compact but operationally complex chapter.':'Un capitolo compatto ma operativamente complesso.',
      'Overland and air corridors across West Africa.':'Corridoi terrestri e aerei attraverso l’Africa occidentale.',
      'The route turns south, then back north-east.':'L’itinerario scende a sud e poi torna verso nord-est.',
      'The final Middle East sequence.':'La sequenza finale in Medio Oriente.',
      'The closing run back to Germany.':'La tratta conclusiva verso la Germania.',
      'The planned continuous route returns to Germany.':'L’itinerario continuo pianificato ritorna in Germania.',
    },
    es:{
      'Europe':'Europa','Western Europe':'Europa occidental','Eastern Europe':'Europa oriental','Northern Europe':'Europa septentrional','Southern Europe':'Europa meridional','Asia':'Asia','Africa':'África','Americas':'América','Oceania':'Oceanía',
      'Ready':'Listo','READY':'LISTO','Blocked':'Bloqueado','BLOCKED':'BLOQUEADO','Pending':'Pendiente','Conditional':'Condicional','Critical':'Crítico','Verified':'Verificado','Not verified':'No verificado','Not recorded':'No registrado','Not started':'No iniciado',
      'Action':'Acción','From':'Desde','Duration':'Duración','Distance unknown':'Distancia desconocida','Mode to confirm':'Transporte por confirmar','Plan depart':'Salida prevista','Plan arrive':'Llegada prevista','Planned':'Planificado','Planned start':'Inicio previsto','Actual status':'Estado real','Actual spend':'Gasto real','Last update':'Última actualización',
      'Next segment':'Siguiente tramo','Play / pause journey':'Reproducir / pausar viaje','Play journey from here':'Reproducir desde aquí','Close':'Cerrar','Copy the URL from your browser':'Copia la URL del navegador',
      'Loading 3D globe terrain…':'Cargando terreno 3D…','Loading globe, map and elevation data…':'Cargando globo, mapa y elevación…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Arrastra para girar · desplázate para acercar · el relieve aparece al aproximarte',
      'Route legs':'Tramos de ruta',
      'Planned duration':'Duración prevista',
      'Route distance':'Distancia de ruta',
      'Transport model':'Modelo de transporte',
      'Chapters':'Capítulos',
      'Transport mix':'Combinación de transportes',
      'sovereign states':'estados soberanos',
      'executable segments':'segmentos ejecutables',
      'continuous route':'ruta continua',
      'corridor / geodesic estimate':'estimación de corredor / geodésica',
      'public segment budget':'presupuesto público de segmentos',
      'No actual journey events yet.':'Aún no hay eventos reales del viaje.',
      'Journal ready for departure':'Diario listo para la salida',
      'Actual journey data is being compared with the public plan.':'Los datos reales del viaje se comparan con el plan público.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'La capa pública en vivo está lista. Los check-ins reales aparecerán cuando empiece el viaje.',
      'Starts in':'Empieza en',
      'Ready to depart':'Listo para salir',
      'JOURNEY COMPLETE':'VIAJE COMPLETADO',
      'The journey begins across Europe.':'El viaje comienza por Europa.',
      'Across the Atlantic into North America.':'Cruzando el Atlántico hacia Norteamérica.',
      'Island connections and short regional hops.':'Conexiones entre islas y trayectos regionales cortos.',
      'A continuous line through South America.':'Una ruta continua por Sudamérica.',
      'The route opens into the Pacific.':'La ruta se abre hacia el Pacífico.',
      'Dense regional links and island crossings.':'Conexiones regionales densas y cruces entre islas.',
      'Long-distance transitions across Asia.':'Transiciones de larga distancia por Asia.',
      'A compact but operationally complex chapter.':'Un capítulo compacto pero operativamente complejo.',
      'Overland and air corridors across West Africa.':'Corredores terrestres y aéreos por África Occidental.',
      'The route turns south, then back north-east.':'La ruta gira al sur y después vuelve al noreste.',
      'The final Middle East sequence.':'La secuencia final por Oriente Medio.',
      'The closing run back to Germany.':'El tramo final de regreso a Alemania.',
      'The planned continuous route returns to Germany.':'La ruta continua planificada regresa a Alemania.',
    },
    fr:{
      'Europe':'Europe','Western Europe':'Europe occidentale','Eastern Europe':'Europe orientale','Northern Europe':'Europe du Nord','Southern Europe':'Europe du Sud','Asia':'Asie','Africa':'Afrique','Americas':'Amériques','Oceania':'Océanie',
      'Ready':'Prêt','READY':'PRÊT','Blocked':'Bloqué','BLOCKED':'BLOQUÉ','Pending':'En attente','Conditional':'Conditionnel','Critical':'Critique','Verified':'Vérifié','Not verified':'Non vérifié','Not recorded':'Non enregistré','Not started':'Non commencé',
      'Action':'Action','From':'Depuis','Duration':'Durée','Distance unknown':'Distance inconnue','Mode to confirm':'Transport à confirmer','Plan depart':'Départ prévu','Plan arrive':'Arrivée prévue','Planned':'Planifié','Planned start':'Départ prévu','Actual status':'État réel','Actual spend':'Dépenses réelles','Last update':'Dernière mise à jour',
      'Next segment':'Segment suivant','Play / pause journey':'Lire / mettre en pause','Play journey from here':'Lire le voyage depuis ici','Close':'Fermer','Copy the URL from your browser':'Copiez l’URL du navigateur',
      'Loading 3D globe terrain…':'Chargement du relief 3D…','Loading globe, map and elevation data…':'Chargement du globe, de la carte et du relief…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Faites glisser pour tourner · faites défiler pour zoomer · le relief apparaît en vous rapprochant',
      'Route legs':'Étapes de route',
      'Planned duration':'Durée prévue',
      'Route distance':'Distance de l’itinéraire',
      'Transport model':'Modèle de transport',
      'Chapters':'Chapitres',
      'Transport mix':'Répartition des transports',
      'sovereign states':'États souverains',
      'executable segments':'segments exécutables',
      'continuous route':'itinéraire continu',
      'corridor / geodesic estimate':'estimation corridor / géodésique',
      'public segment budget':'budget public des segments',
      'No actual journey events yet.':'Aucun événement réel du voyage pour le moment.',
      'Journal ready for departure':'Journal prêt pour le départ',
      'Actual journey data is being compared with the public plan.':'Les données réelles du voyage sont comparées au plan public.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'La couche publique en direct est prête. Les check-ins réels apparaîtront au début du voyage.',
      'Starts in':'Départ dans',
      'Ready to depart':'Prêt au départ',
      'JOURNEY COMPLETE':'VOYAGE TERMINÉ',
      'The journey begins across Europe.':'Le voyage commence à travers l’Europe.',
      'Across the Atlantic into North America.':'Traversée de l’Atlantique vers l’Amérique du Nord.',
      'Island connections and short regional hops.':'Liaisons insulaires et courtes étapes régionales.',
      'A continuous line through South America.':'Un itinéraire continu à travers l’Amérique du Sud.',
      'The route opens into the Pacific.':'L’itinéraire s’ouvre sur le Pacifique.',
      'Dense regional links and island crossings.':'Liaisons régionales denses et traversées insulaires.',
      'Long-distance transitions across Asia.':'Longues transitions à travers l’Asie.',
      'A compact but operationally complex chapter.':'Un chapitre compact mais complexe sur le plan opérationnel.',
      'Overland and air corridors across West Africa.':'Corridors terrestres et aériens à travers l’Afrique de l’Ouest.',
      'The route turns south, then back north-east.':'L’itinéraire descend vers le sud puis remonte au nord-est.',
      'The final Middle East sequence.':'La séquence finale au Moyen-Orient.',
      'The closing run back to Germany.':'La dernière étape vers l’Allemagne.',
      'The planned continuous route returns to Germany.':'L’itinéraire continu prévu revient en Allemagne.',
    },
    pt:{
      'Europe':'Europa','Western Europe':'Europa Ocidental','Eastern Europe':'Europa Oriental','Northern Europe':'Europa do Norte','Southern Europe':'Europa do Sul','Asia':'Ásia','Africa':'África','Americas':'Américas','Oceania':'Oceania',
      'Ready':'Pronto','READY':'PRONTO','Blocked':'Bloqueado','BLOCKED':'BLOQUEADO','Pending':'Pendente','Conditional':'Condicional','Critical':'Crítico','Verified':'Verificado','Not verified':'Não verificado','Not recorded':'Não registado','Not started':'Não iniciado',
      'Action':'Ação','From':'De','Duration':'Duração','Distance unknown':'Distância desconhecida','Mode to confirm':'Transporte a confirmar','Plan depart':'Partida prevista','Plan arrive':'Chegada prevista','Planned':'Planeado','Planned start':'Início previsto','Actual status':'Estado real','Actual spend':'Despesa real','Last update':'Última atualização',
      'Next segment':'Próximo trecho','Play / pause journey':'Reproduzir / pausar viagem','Play journey from here':'Reproduzir a partir daqui','Close':'Fechar','Copy the URL from your browser':'Copie o URL do navegador',
      'Loading 3D globe terrain…':'A carregar terreno 3D…','Loading globe, map and elevation data…':'A carregar globo, mapa e elevação…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Arraste para rodar · desloque para ampliar · o relevo aparece ao aproximar',
      'Route legs':'Trechos da rota',
      'Planned duration':'Duração planeada',
      'Route distance':'Distância da rota',
      'Transport model':'Modelo de transporte',
      'Chapters':'Capítulos',
      'Transport mix':'Mix de transportes',
      'sovereign states':'estados soberanos',
      'executable segments':'segmentos executáveis',
      'continuous route':'rota contínua',
      'corridor / geodesic estimate':'estimativa de corredor / geodésica',
      'public segment budget':'orçamento público dos segmentos',
      'No actual journey events yet.':'Ainda não existem eventos reais da viagem.',
      'Journal ready for departure':'Diário pronto para a partida',
      'Actual journey data is being compared with the public plan.':'Os dados reais da viagem estão a ser comparados com o plano público.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'A camada pública ao vivo está pronta. Os check-ins reais aparecerão quando a viagem começar.',
      'Starts in':'Começa em',
      'Ready to depart':'Pronto para partir',
      'JOURNEY COMPLETE':'VIAGEM CONCLUÍDA',
      'The journey begins across Europe.':'A viagem começa pela Europa.',
      'Across the Atlantic into North America.':'Atravessando o Atlântico rumo à América do Norte.',
      'Island connections and short regional hops.':'Ligações entre ilhas e pequenos trechos regionais.',
      'A continuous line through South America.':'Uma rota contínua pela América do Sul.',
      'The route opens into the Pacific.':'A rota abre-se para o Pacífico.',
      'Dense regional links and island crossings.':'Ligações regionais densas e travessias entre ilhas.',
      'Long-distance transitions across Asia.':'Transições de longa distância pela Ásia.',
      'A compact but operationally complex chapter.':'Um capítulo compacto, mas operacionalmente complexo.',
      'Overland and air corridors across West Africa.':'Corredores terrestres e aéreos pela África Ocidental.',
      'The route turns south, then back north-east.':'A rota segue para sul e depois volta para nordeste.',
      'The final Middle East sequence.':'A sequência final no Médio Oriente.',
      'The closing run back to Germany.':'O trecho final de regresso à Alemanha.',
      'The planned continuous route returns to Germany.':'A rota contínua planeada regressa à Alemanha.',
    }
  };

  let legacyLocaleObserver=null,legacyLocaleScheduled=false;
  function legacyTranslate(raw){
    const text=String(raw||'').trim();
    if(!text||locale==='en')return text;
    const dict={...(LEGACY_WORLD_TEXT[locale]||{}),...(LEGACY_EXTRA[locale]||{})};
    if(dict[text])return dict[text];
    const exactKey=Object.keys(dict).find(k=>k.toLocaleLowerCase('en')===text.toLocaleLowerCase('en'));
    if(exactKey)return dict[exactKey];
    if(LEGACY_PHASES[locale]?.[text])return LEGACY_PHASES[locale][text];
    let m=text.match(/^(\d{2})\s+(.+)$/);
    if(m&&LEGACY_PHASES[locale]?.[m[2]])return `${m[1]} ${LEGACY_PHASES[locale][m[2]]}`;
    m=text.match(/^CHAPTER\s+(\d+)\s*\/\s*(\d+)$/i);
    if(m)return `${locale==='de'?'KAPITEL':locale==='it'?'CAPITOLO':locale==='es'?'CAPÍTULO':locale==='fr'?'CHAPITRE':locale==='pt'?'CAPÍTULO':'CHAPTER'} ${m[1]} / ${m[2]}`;
    m=text.match(/^Country\s+(\d+)\s*\/\s*195$/i);
    if(m)return `${t('country')} ${m[1]}/195`;
    m=text.match(/^Country\s+(\d+)\s*·\s*(.+)$/i);
    if(m)return `${t('country')} ${m[1]} · ${legacyTranslate(m[2])}`;
    m=text.match(/^Segment\s+(\d+)\s*·\s*Day\s+([^·]+)\s*·\s*(.+)$/i);
    if(m)return `${t('segment')} ${m[1]} · ${t('day')} ${m[2].trim()} · ${m[3]}`;
    m=text.match(/^Segment\s+(\d+)\s*\/\s*(\d+)$/i);
    if(m)return `${t('segment')} ${m[1]} / ${m[2]}`;
    return text;
  }

  function localizeLegacyNode(root=document){
    if(locale==='en'||document.body.classList.contains('platform-regional-trip'))return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const raw=node.nodeValue,trimmed=String(raw||'').trim();if(!trimmed)continue;
      const translated=legacyTranslate(trimmed);
      if(translated!==trimmed)node.nodeValue=raw.replace(trimmed,translated);
    }
    for(const el of root.querySelectorAll?.('[placeholder],[title],[aria-label]')||[]){
      for(const attr of ['placeholder','title','aria-label']){
        const raw=el.getAttribute(attr);if(!raw)continue;
        const translated=legacyTranslate(raw);if(translated!==raw)el.setAttribute(attr,translated);
      }
    }
  }

  function activateLegacyLocalization(){
    document.documentElement.lang=locale;
    localizeLegacyNode(document.body);
    if(legacyLocaleObserver)legacyLocaleObserver.disconnect();
    legacyLocaleObserver=new MutationObserver(mutations=>{
      if(legacyLocaleScheduled||document.body.classList.contains('platform-regional-trip'))return;
      legacyLocaleScheduled=true;
      requestAnimationFrame(()=>{
        legacyLocaleScheduled=false;
        for(const mutation of mutations){
          for(const node of mutation.addedNodes){
            if(node.nodeType===Node.ELEMENT_NODE)localizeLegacyNode(node);
            else if(node.nodeType===Node.TEXT_NODE&&node.parentElement)localizeLegacyNode(node.parentElement);
          }
          if(mutation.type==='characterData'&&mutation.target.parentElement)localizeLegacyNode(mutation.target.parentElement);
        }
      });
    });
    legacyLocaleObserver.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  }

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
  const sourceMap = () => new Map((currentTrip?.sources||[]).map(s=>[s.id,s]));
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
  let countries = [];

  function profileDefaults(){
    return {passports:[],residenceCountry:null,language:locale,currency:'EUR',origin:null,party:{adults:1,children:0},accessibility:{reducedMobility:false},vehicle:null};
  }
  function loadProfile(){
    try{return {...profileDefaults(),...JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')}}catch{return profileDefaults()}
  }
  function saveProfile(profile){localStorage.setItem(PROFILE_KEY,JSON.stringify(profile))}

  async function waitForCore(max=70){
    for(let i=0;i<max;i++){
      if(window.__ONE_WORLD_ROUTE_APP__ && window.__ONE_WORLD_ROUTE_GLOBE__) return true;
      await sleep(80);
    }
    return false;
  }

  function buildTripUrl(id){
    const p = new URLSearchParams(location.search);
    if(id === catalog.defaultTripId) p.delete('trip'); else p.set('trip',id);
    p.delete('segment'); p.delete('country'); p.delete('phase'); p.delete('view');
    return `/${p.toString()?`?${p}`:''}`;
  }

  function setQueryTrip(id){
    if(!catalog?.trips?.some(t=>t.id===id||t.slug===id))return;
    location.assign(buildTripUrl(id));
  }

  function ensureGlobalUi(){
    const top = $('.topbar');
    if(!top || $('#platformRouteBtn')) return;
    const actions = $('.top-actions',top);
    const wrap = document.createElement('div');
    wrap.className='platform-actions';
    wrap.innerHTML=`<button id="platformRouteBtn" class="platform-pill" type="button" aria-label="${esc(t('routes'))}" title="${esc(t('routes'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg></span><span class="platform-pill-label">${esc(t('routes'))}</span></button><button id="platformTravellerBtn" class="platform-pill secondary" type="button" aria-label="${esc(t('traveller'))}" title="${esc(t('traveller'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-4.2 3-6.3 6.5-6.3s5.7 2.1 6.5 6.3"/></svg></span><span class="platform-pill-label">${esc(t('traveller'))}</span></button>`;
    top.insertBefore(wrap, actions || null);
    $('#platformRouteBtn').onclick=openRouteLibrary;
    $('#platformTravellerBtn').onclick=openTraveller;
  }

  function ensureDialog(id, cls='platform-modal'){
    let modal=$('#'+id);
    if(modal) return modal;
    modal=document.createElement('div');modal.id=id;modal.className=`${cls} hidden`;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});
    document.body.appendChild(modal);return modal;
  }

  function openRouteLibrary(){
    const modal=ensureDialog('platformRouteModal');
    const kinds=[...new Set(catalog.trips.map(r=>r.kind))].sort();
    const regions=[...new Set(catalog.trips.flatMap(r=>r.discovery?.regions||[]))].sort();
    const modes=[...new Set(catalog.trips.flatMap(r=>r.discovery?.modes||[]))].sort();
    const themes=[...new Set(catalog.trips.flatMap(r=>r.discovery?.themes||[]))].sort();
    modal.innerHTML=`<div class="platform-modal-card route-library-card glass"><button class="platform-x" aria-label="Close">×</button><div class="platform-eyebrow">ONE WORLD ROUTE</div><h2>${esc(t('routeLibrary'))}</h2><p class="platform-lead">${esc(t('routeLibraryLead'))}</p><div class="platform-route-filters"><label class="route-search"><span>${esc(t('searchRoutes'))}</span><input id="platformRouteSearch" type="search" autocomplete="off" placeholder="${esc(t('searchRoutes'))}"></label><label><span>${esc(t('filterType'))}</span><select id="platformRouteKind"><option value="">${esc(t('all'))}</option>${kinds.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterRegion'))}</span><select id="platformRouteRegion"><option value="">${esc(t('all'))}</option>${regions.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterDuration'))}</span><select id="platformRouteDuration"><option value="">${esc(t('all'))}</option><option value="7-14">7–14 ${esc(t('days'))}</option><option value="15-30">15–30 ${esc(t('days'))}</option><option value="31-89">31–89 ${esc(t('days'))}</option><option value="90-plus">90+ ${esc(t('days'))}</option></select></label><label><span>${esc(t('filterMode'))}</span><select id="platformRouteMode"><option value="">${esc(t('all'))}</option>${modes.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterTheme'))}</span><select id="platformRouteTheme"><option value="">${esc(t('all'))}</option>${themes.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label></div><div class="platform-route-resultbar"><span id="platformRouteCount"></span><button id="platformRouteReset" type="button">${esc(t('resetFilters'))}</button></div><div id="platformRouteResults" class="platform-route-grid"></div></div>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    const render=()=>{
      const q=String($('#platformRouteSearch',modal)?.value||'').trim().toLowerCase();
      const kind=$('#platformRouteKind',modal)?.value||'',region=$('#platformRouteRegion',modal)?.value||'',duration=$('#platformRouteDuration',modal)?.value||'',mode=$('#platformRouteMode',modal)?.value||'',theme=$('#platformRouteTheme',modal)?.value||'';
      const filtered=catalog.trips.filter(r=>{
        const hay=[local(r.title),local(r.subtitle),r.kind,...(r.discovery?.regions||[]),...(r.discovery?.themes||[]),...(r.discovery?.modes||[])].join(' ').toLowerCase();
        return (!q||hay.includes(q))&&(!kind||r.kind===kind)&&(!region||(r.discovery?.regions||[]).includes(region))&&(!duration||r.discovery?.durationBand===duration)&&(!mode||(r.discovery?.modes||[]).includes(mode))&&(!theme||(r.discovery?.themes||[]).includes(theme));
      });
      const host=$('#platformRouteResults',modal);
      host.innerHTML=filtered.length?filtered.map(routeCard).join(''):`<div class="platform-no-routes">${esc(t('noRoutes'))}</div>`;
      const count=$('#platformRouteCount',modal);if(count)count.textContent=`${filtered.length} ${t('results')}`;
      // Route buttons are handled by event delegation below so filtering/re-rendering stays reliable.
    };
    const results=$('#platformRouteResults',modal);
    results.addEventListener('click',e=>{
      const button=e.target.closest('[data-platform-trip]');
      if(!button||!results.contains(button))return;
      e.preventDefault();
      setQueryTrip(button.dataset.platformTrip);
    });
    ['platformRouteSearch','platformRouteKind','platformRouteRegion','platformRouteDuration','platformRouteMode','platformRouteTheme'].forEach(id=>$('#'+id,modal)?.addEventListener(id==='platformRouteSearch'?'input':'change',render));
    $('#platformRouteReset',modal)?.addEventListener('click',()=>{
      const search=$('#platformRouteSearch',modal);if(search)search.value='';
      ['platformRouteKind','platformRouteRegion','platformRouteDuration','platformRouteMode','platformRouteTheme'].forEach(id=>{const el=$('#'+id,modal);if(el)el.value=''});
      render();
    });
    render();
  }

  function routeCard(r){
    const metrics=[];
    if(r.metrics?.days)metrics.push(`${r.metrics.days} ${t('days')}`);
    if(r.metrics?.stops)metrics.push(`${r.metrics.stops} ${t('stops')}`);
    if(r.metrics?.countries)metrics.push(`${r.metrics.countries} ${r.metrics.countries===1?'country':'countries'}`);
    if(r.metrics?.nights)metrics.push(`${r.metrics.nights} ${t('onboardNights')}`);
    if(r.metrics?.seaDays)metrics.push(`${r.metrics.seaDays} ${t('seaDays')}`);
    return `<article class="platform-route-card ${r.id===currentTripMeta?.id?'active':''}"><div class="platform-route-top"><span>${esc(facetLabel(r.kind))}</span><b>${esc(r.id===catalog.defaultTripId?t('flagship'):(r.status==='sourced-beta'?t('sourcedBeta'):(r.kind==='cruise'?t('cruiseTemplate'):t('template'))))}</b></div><h3>${esc(local(r.title))}</h3><p>${esc(local(r.subtitle))}</p><div class="platform-route-metrics">${metrics.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button type="button" data-platform-trip="${esc(r.id)}">${esc(t('open'))} →</button></article>`;
  }

  async function loadCountries(){
    if(countries.length) return countries;
    try{countries=await fetch('./data/country-centroids.json',{cache:'force-cache'}).then(r=>r.json())}catch{countries=[]}
    return countries;
  }

  async function openTraveller(){
    await loadCountries();
    const profile=loadProfile();
    const modal=ensureDialog('platformTravellerModal');
    const display = (()=>{try{return new Intl.DisplayNames([locale],{type:'region'})}catch{return null}})();
    const options=[...countries].filter(c=>c.cca2).map(c=>({code:c.cca2,name:display?.of(c.cca2)||c.name})).sort((a,b)=>a.name.localeCompare(b.name,locale));
    const countryOptions=(selected,blank=true)=>`${blank?`<option value="">${esc(t('notSet'))}</option>`:''}${options.map(o=>`<option value="${o.code}" ${selected===o.code?'selected':''}>${esc(o.name)}</option>`).join('')}`;
    const currencies = typeof Intl.supportedValuesOf==='function' ? Intl.supportedValuesOf('currency') : ['EUR','USD','GBP','CHF','JPY','CAD','AUD','NZD','CNY','INR','BRL','MXN','ZAR','SGD'];
    modal.innerHTML=`<form id="platformTravellerForm" class="platform-modal-card traveller-card glass"><button class="platform-x" type="button" aria-label="Close">×</button><div class="platform-eyebrow">${esc(t('global'))}</div><h2>${esc(t('contextTitle'))}</h2><p class="platform-lead">${esc(t('contextLead'))}</p><div class="traveller-grid"><label>${esc(t('passports'))}<select name="passport">${countryOptions(profile.passports?.[0]||null)}</select></label><label>${esc(t('secondPassport'))}<select name="passport2">${countryOptions(profile.passports?.[1]||null)}</select></label><label>${esc(t('residence'))}<select name="residence">${countryOptions(profile.residenceCountry)}</select></label><label>${esc(t('language'))}<select name="language">${SUPPORTED_LOCALES.map(l=>`<option value="${l}" ${profile.language===l?'selected':''}>${l.toUpperCase()}</option>`).join('')}</select></label><label>${esc(t('currency'))}<select name="currency">${currencies.map(c=>`<option value="${c}" ${profile.currency===c?'selected':''}>${c}</option>`).join('')}</select></label><label class="span-2">${esc(t('origin'))}<input name="origin" value="${esc(profile.origin||'')}" autocomplete="off" placeholder="e.g. Toronto / YYZ"></label><label>${esc(t('adults'))}<input name="adults" type="number" min="1" max="20" value="${Number(profile.party?.adults||1)}"></label><label>${esc(t('children'))}<input name="children" type="number" min="0" max="20" value="${Number(profile.party?.children||0)}"></label><label class="check span-2"><input name="mobility" type="checkbox" ${profile.accessibility?.reducedMobility?'checked':''}><span>${esc(t('mobility'))}</span></label><div class="traveller-subhead span-2">${esc(t('vehicleSection'))}</div><label>${esc(t('vehicleType'))}<select name="vehicleType"><option value="">${esc(t('notSet'))}</option><option value="private-car" ${profile.vehicle?.type==='private-car'?'selected':''}>${esc(t('privateCar'))}</option><option value="rental-car" ${profile.vehicle?.type==='rental-car'?'selected':''}>${esc(t('rentalCar'))}</option><option value="camper" ${profile.vehicle?.type==='camper'?'selected':''}>${esc(t('camper'))}</option><option value="motorcycle" ${profile.vehicle?.type==='motorcycle'?'selected':''}>${esc(t('motorcycle'))}</option><option value="other" ${profile.vehicle?.type==='other'?'selected':''}>${esc(t('otherVehicle'))}</option></select></label><label>${esc(t('registrationCountry'))}<select name="vehicleRegistration">${countryOptions(profile.vehicle?.registrationCountry||null)}</select></label><label>${esc(t('fuelType'))}<select name="vehicleFuel"><option value="unknown">${esc(t('unknown'))}</option><option value="petrol" ${profile.vehicle?.fuelType==='petrol'?'selected':''}>${esc(t('petrol'))}</option><option value="diesel" ${profile.vehicle?.fuelType==='diesel'?'selected':''}>${esc(t('diesel'))}</option><option value="hybrid" ${profile.vehicle?.fuelType==='hybrid'?'selected':''}>${esc(t('hybrid'))}</option><option value="plug-in-hybrid" ${profile.vehicle?.fuelType==='plug-in-hybrid'?'selected':''}>${esc(t('pluginHybrid'))}</option><option value="electric" ${profile.vehicle?.fuelType==='electric'?'selected':''}>${esc(t('electric'))}</option><option value="hydrogen" ${profile.vehicle?.fuelType==='hydrogen'?'selected':''}>${esc(t('hydrogen'))}</option><option value="other" ${profile.vehicle?.fuelType==='other'?'selected':''}>${esc(t('otherVehicle'))}</option></select></label><label>${esc(t('euroClass'))}<select name="vehicleEuro"><option value="unknown">${esc(t('unknown'))}</option>${['Euro 1','Euro 2','Euro 3','Euro 4','Euro 5','Euro 6'].map(v=>`<option value="${v}" ${profile.vehicle?.euroClass===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="check span-2"><input name="rentalCrossBorder" type="checkbox" ${profile.vehicle?.rentalCrossBorderApproved===true?'checked':''}><span>${esc(t('rentalCrossBorder'))}</span></label></div><p class="platform-privacy">${esc(t('private'))}</p><div class="platform-form-actions"><button class="ghost" type="button" id="platformClearTraveller">${esc(t('clear'))}</button><button class="primary" type="submit">${esc(t('save'))}</button></div></form>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    $('#platformClearTraveller').onclick=()=>{localStorage.removeItem(PROFILE_KEY);modal.classList.add('hidden');location.reload()};
    $('#platformTravellerForm').onsubmit=e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);
      const passports=[f.get('passport'),f.get('passport2')].filter(Boolean).map(String).filter((v,i,a)=>a.indexOf(v)===i);const vehicleType=String(f.get('vehicleType')||'');const vehicle=vehicleType?{type:vehicleType,registrationCountry:f.get('vehicleRegistration')||null,fuelType:String(f.get('vehicleFuel')||'unknown'),euroClass:String(f.get('vehicleEuro')||'unknown'),rentalCrossBorderApproved:vehicleType==='rental-car'?(f.get('rentalCrossBorder')==='on'):null}:null;const next={passports,residenceCountry:f.get('residence')||null,language:String(f.get('language')||'en'),currency:String(f.get('currency')||'EUR'),origin:String(f.get('origin')||'').trim()||null,party:{adults:Number(f.get('adults')||1),children:Number(f.get('children')||0)},accessibility:{reducedMobility:f.get('mobility')==='on'},vehicle};
      saveProfile(next);locale=SUPPORTED_LOCALES.includes(next.language)?next.language:locale;modal.classList.add('hidden');const p=new URLSearchParams(location.search);p.set('lang',locale);location.assign(`${location.pathname}?${p.toString()}`);
    };
  }

  function placeMap(trip){return new Map((trip.places||[]).map(p=>[p.id,p]))}
  function stopMap(trip){return new Map((trip.stops||[]).map(s=>[s.id,s]))}
  function stopPlace(trip,stop){return placeMap(trip).get(stop.placeId)}

  function syncRegionalUrl(){
    if(!currentTripMeta||currentTripMeta.renderer==='legacy-world')return;
    const p=new URLSearchParams();
    p.set('trip',currentTripMeta.id);
    p.set('lang',locale);
    history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
  }

  function isolateRegionalRuntime(){
    document.body.classList.add('platform-regional-trip');
    document.body.classList.remove('story-mode','story-launching','terrain-view');
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

  function applyTripShell(){
    isolateRegionalRuntime();
    syncRegionalUrl();
    document.documentElement.lang=locale;
    document.title=`${local(currentTrip.title)} — ONE WORLD ROUTE`;
    const meta=$('meta[name="description"]');if(meta)meta.content=local(currentTrip.summary);
    const brandSmall=$('.brand small');if(brandSmall)brandSmall.textContent=local(currentTrip.title);
    const hero=$('.hero-copy');
    if(hero){
      hero.innerHTML=`<div class="eyebrow"><span class="live-dot"></span>${esc(currentTrip.kind)} · ${currentTrip.planning?.days||''} ${esc(t('days'))}</div><h1>${esc(local(currentTrip.title))}</h1><p>${esc(local(currentTrip.summary))}</p><div class="platform-template-note">${esc(t('editorial'))}</div>`;
    }
    const kpis=$('#topKpis');
    if(kpis)kpis.innerHTML=`<div class="kpi"><b>${currentTrip.planning?.days||'—'}</b><span>${esc(t('days'))}</span></div><div class="kpi"><b>${currentTrip.stops?.length||0}</b><span>${esc(t('stops'))}</span></div><div class="kpi"><b>${currentTrip.segments?.length||0}</b><span>${esc(t('segments'))}</span></div>`;
    const mobileFilters=$('#mobileFilters');if(mobileFilters)mobileFilters.textContent=t('stops');
    const mobileDetails=$('#mobileDetails');if(mobileDetails)mobileDetails.textContent=t('details');
    buildLeftNavigation();
    buildChapterRail();
    replaceTimeline();
    renderTripOverview();
  }

  function buildLeftNavigation(){
    const panel=$('#leftPanel');if(!panel)return;
    panel.scrollTop=0;
    $('.platform-regional-nav',panel)?.remove();
    const nav=document.createElement('div');nav.className='platform-regional-nav';
    nav.innerHTML=`<div class="section-title"><span>${esc(t('stops'))}</span><span class="pill">${currentTrip.stops.length}</span></div><div class="platform-stop-list">${currentTrip.stops.map((s,i)=>stopButton(s,i)).join('')}</div>`;
    panel.appendChild(nav);
    $$('[data-stop-index]',nav).forEach(b=>b.onclick=()=>selectStop(Number(b.dataset.stopIndex),true));
  }

  function stopButton(stop,index){
    const p=stopPlace(currentTrip,stop);return `<button type="button" data-stop-index="${index}" class="platform-stop ${index===0?'active':''}"><span>${String(stop.sequence).padStart(2,'0')}</span><div><b>${esc(local(p?.name))}</b><small>${esc(t('day'))} ${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''} · ${stop.nights||0} ${esc(t('nights'))}</small></div></button>`;
  }

  function buildChapterRail(){
    const rail=$('#phaseRail');if(!rail)return;
    const chapters=currentTrip.chapters||[];
    rail.classList.toggle('platform-empty-rail',chapters.length===0);
    rail.innerHTML=chapters.map((c,i)=>`<button type="button" data-trip-chapter="${i}" class="${i===0?'active':''}"><span class="phase-dot"></span>${esc(local(c.title))}</button>`).join('');
    $$('[data-trip-chapter]',rail).forEach(b=>b.onclick=()=>{
      $$('[data-trip-chapter]',rail).forEach(x=>x.classList.toggle('active',x===b));
      const c=currentTrip.chapters[Number(b.dataset.tripChapter)],idx=currentTrip.stops.findIndex(s=>s.id===c.stopIds?.[0]);if(idx>=0)selectStop(idx,true);
    });
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
    return currentTrip.segments.map((s,i)=>{const a=places.get(stops.get(s.fromStopId)?.placeId),b=places.get(stops.get(s.toStopId)?.placeId);return {...s,_index:i,start:a?.coordinates,end:b?.coordinates,fromName:local(a?.name),toName:local(b?.name)}}).filter(x=>x.start&&x.end);
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
      globe.arcsData(arcs)
        .arcStartLat(d=>d.start.lat).arcStartLng(d=>d.start.lng)
        .arcEndLat(d=>d.end.lat).arcEndLng(d=>d.end.lng)
        .arcAltitude(d=>d._index===selectedSegmentIndex?.075:.045)
        .arcStroke(d=>d._index===selectedSegmentIndex?.78:.30)
        .arcColor(d=>d._index===selectedSegmentIndex?'#59ddff':'rgba(113,151,190,.62)')
        .arcDashLength(1).arcDashGap(0)
        .onArcClick(d=>selectSegmentIndex(d._index,true));
      globe.pointsData(places)
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
      if(globe.controls()){globe.controls().autoRotate=false;globe.controls().enableZoom=true}
      const camera=currentTrip.rendering?.camera||{lat:43.5,lng:13.5,altitude:.72};
      if(!document.body.dataset.regionalCameraReady){document.body.dataset.regionalCameraReady='1';globe.pointOfView(camera,700)}
    }catch(e){console.warn('Regional globe render failed',e)}
  }

  function selectSegmentIndex(index,focus=false){
    selectedSegmentIndex=Math.max(0,Math.min(currentTrip.segments.length-1,index));
    $$('.platform-stop').forEach(x=>x.classList.remove('active'));
    renderRegionalGlobe();updateTimelineRegional();renderSegmentDetail(currentTrip.segments[selectedSegmentIndex]);
    if(focus)focusSegment(currentTrip.segments[selectedSegmentIndex]);
  }

  function selectStop(index,focus=false){
    const stop=currentTrip.stops[index],p=stopPlace(currentTrip,stop);if(!stop||!p)return;
    $$('.platform-stop').forEach((x,i)=>x.classList.toggle('active',i===index));
    renderStopDetail(stop,p);
    if(index<currentTrip.segments.length){selectedSegmentIndex=index;updateTimelineRegional();renderRegionalGlobe()}
    if(focus)window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView({lat:p.coordinates.lat,lng:p.coordinates.lng,altitude:.48},650);
  }

  function focusSegment(seg){
    const sm=stopMap(currentTrip),pm=placeMap(currentTrip),a=pm.get(sm.get(seg.fromStopId)?.placeId),b=pm.get(sm.get(seg.toStopId)?.placeId);if(!a||!b)return;
    let lng=(a.coordinates.lng+b.coordinates.lng)/2;let lat=(a.coordinates.lat+b.coordinates.lat)/2;window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView({lat,lng,altitude:.52},650);
  }

  function renderTripOverview(){
    const title=$('#detailTitle');if(title)title.textContent=local(currentTrip.title);
    const eye=$('#detailEyebrow');if(eye)eye.textContent=t('overview');
    const tabs=$('#detailTabs');if(tabs)tabs.style.display='none';
    const content=$('#detailContent');if(!content)return;
    content.scrollTop=0;
    const sourced=currentTrip.segments.filter(s=>(s.verification?.sourceIds||[]).length).length,verified=currentTrip.segments.filter(s=>s.verification?.status==='verified').length;
    const entry=currentTrip.entryGuidance,entrySource=entry?sourceMap().get(entry.officialResolverSourceId):null;
    const cruise=currentTrip.cruise;
    const roadTrip=currentTrip.roadTrip;
    const profile=loadProfile();
    const cruiseCards=cruise?`<div class="data-card"><span>${esc(t('onboardNights'))}</span><b>${cruise.nights??'—'}</b></div><div class="data-card"><span>${esc(t('seaDays'))}</span><b>${cruise.seaDays??0}</b></div>`:'';
    const vehiclePrompt=roadTrip?.vehicleContextRequired&&!profile.vehicle?`<div class="platform-cruise-note">${esc(t('vehicleNeeded'))}</div>`:'';
    content.innerHTML=`<div class="overview-number">${currentTrip.planning?.days||'—'}<small> ${esc(t('days'))}</small></div><p class="detail-copy">${esc(local(currentTrip.summary))}</p><div class="data-grid"><div class="data-card"><span>${esc(t('stops'))}</span><b>${currentTrip.stops.length}</b></div>${cruiseCards}<div class="data-card"><span>${esc(t('routeEvidence'))}</span><b>${sourced}/${currentTrip.segments.length}</b></div><div class="data-card"><span>${esc(t('verified'))}</span><b>${verified}/${currentTrip.segments.length}</b></div><div class="data-card"><span>${esc(t('currency'))}</span><b>${esc(currentTrip.planning?.currency||'—')}</b></div></div>${vehiclePrompt}${cruise?.requiresSailingSelection?`<div class="platform-cruise-note">${esc(t('sailingNeeded'))}</div>`:''}${entry?`<div class="platform-entry"><b>${esc(t('entryGuidance'))}</b><p>${esc(local(entry.message))}</p>${entrySource?`<a href="${esc(entrySource.url)}" target="_blank" rel="noopener noreferrer">${esc(t('officialCheck'))} →</a>`:''}</div>`:''}<button class="platform-context-inline" id="regionalTravellerBtn" type="button">${esc(t('traveller'))} →</button>`;
    $('#regionalTravellerBtn')?.addEventListener('click',openTraveller);
  }

  function renderStopDetail(stop,p){
    const title=$('#detailTitle');if(title)title.textContent=local(p.name);
    const eye=$('#detailEyebrow');if(eye)eye.textContent=`${t('stop').toUpperCase()} ${stop.sequence} · ${p.type}`;
    const content=$('#detailContent');if(!content)return;
    content.scrollTop=0;
    const call=stop.call;
    const callLabel=call?.kind==='embarkation'?t('embarkation'):(call?.kind==='disembarkation'?t('disembarkation'):(call?t('portCall'):null));
    const portRefs=p.port?.sourceIds||[];
    content.innerHTML=`<div class="overview-number">${stop.sequence}<small> / ${currentTrip.stops.length}</small></div><div class="data-grid"><div class="data-card"><span>${esc(t('day'))}</span><b>${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''}</b></div>${callLabel?`<div class="data-card"><span>${esc(t('portCall'))}</span><b>${esc(callLabel)}</b></div>`:''}<div class="data-card"><span>${esc(t('type'))}</span><b>${esc(p.type)}</b></div><div class="data-card"><span>${esc(t('country'))}</span><b>${esc(p.countryCode||'—')}</b></div></div>${currentTrip.kind==='cruise'?'<div class="platform-cruise-note">'+esc(t('sailingNeeded'))+'</div>':`<p class="detail-copy">${esc(t('editorial'))}</p>`}${portRefs.length?`<div class="platform-evidence"><div class="ops-mini-title">${esc(t('sources'))}</div>${sourceLinks(portRefs)}</div>`:''}`;
  }

  function renderSegmentDetail(s){
    const sm=stopMap(currentTrip),pm=placeMap(currentTrip),a=pm.get(sm.get(s.fromStopId)?.placeId),b=pm.get(sm.get(s.toStopId)?.placeId);
    const title=$('#detailTitle');if(title)title.textContent=`${local(a?.name)} → ${local(b?.name)}`;
    const eye=$('#detailEyebrow');if(eye)eye.textContent=`${t('segment').toUpperCase()} ${s.sequence} / ${currentTrip.segments.length}`;
    const content=$('#detailContent');if(!content)return;
    content.scrollTop=0;
    const stages=(s.transport?.stages||[]).map((stage,i)=>`<article class="platform-stage"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(stage.operator||String(stage.mode||'').replaceAll('-',' '))}</b><small>${esc(stage.from||'')} → ${esc(stage.to||'')}</small><em>${esc(durationLabel(stage))} · ${esc(costLabel(stage))}</em></div></article>`).join('');
    const refs=[...(s.verification?.sourceIds||[]),...(s.transport?.stages||[]).flatMap(x=>x.sourceIds||[])];
    const road=s.roadContext;
    const profile=loadProfile();
    const roadPanel=road?`<div class="platform-road-context"><div><span>${esc(t('roadRules'))}</span><b>${road.crossBorder?esc(t('crossBorder')):esc(road.fromCountry||'')}</b></div><div><span>${esc(t('urbanAccess'))}</span><b>${esc((road.urbanAccessChecks||[]).join(' · ')||'—')}</b></div>${!profile.vehicle?`<p>${esc(t('vehicleNeeded'))}</p>`:''}</div>`:'';
    const cruise=s.cruise;
    const border=s.borderContext;
    const borderLabel=border?.zoneTransition==='schengen-exit'?t('schengenExit'):(border?.zoneTransition==='schengen-entry'?t('schengenEntry'):border?.zoneTransition);
    const cruisePanel=cruise?`<div class="platform-cruise-leg"><div><span>${esc(t('onboardNights'))}</span><b>${cruise.onboardNights??0}</b></div><div><span>${esc(t('seaDays'))}</span><b>${(cruise.seaDayNumbers||[]).join(', ')||'—'}</b></div></div>`:'';
    const borderPanel=border&&border.zoneTransition!=='domestic'?`<div class="platform-border ${border.personalizationRequired?'requires-context':''}"><b>${esc(t('border'))}</b><span>${esc(borderLabel||'—')} · ${esc(border.fromCountry)} → ${esc(border.toCountry)}</span></div>`:'';
    content.innerHTML=`<div class="data-grid"><div class="data-card"><span>${esc(t('transport'))}</span><b>${esc(facetLabel(String(s.transport?.mode||'—')))}</b></div><div class="data-card"><span>${esc(t('verification'))}</span><b class="${s.verification?.status==='verified'?'evidence-ok':(s.verification?.status==='illustrative'?'evidence-info':'evidence-watch')}">${esc(verificationLabel(s))}</b></div><div class="data-card"><span>${esc(t('duration'))}</span><b>${esc(durationLabel(s.planning))}</b></div><div class="data-card"><span>${esc(t('cost'))}</span><b>${esc(costLabel(s.planning))}</b></div></div>${cruisePanel}${borderPanel}${roadPanel}${stages?`<div class="platform-stages">${stages}</div>`:''}${s.verification?.notes?`<div class="op-callout">${esc(s.verification.notes)}</div>`:''}${refs.length?`<div class="platform-evidence"><div class="ops-mini-title">${esc(t('sources'))}</div>${sourceLinks(refs)}</div>`:''}`;
  }

  async function activateRegionalTrip(meta){
    currentTripMeta=meta;
    selectedSegmentIndex=0;
    currentTrip=await fetch(meta.dataset,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip dataset '+r.status);return r.json()});
    await waitForCore();
    applyTripShell();
    renderRegionalGlobe();
    setTimeout(renderRegionalGlobe,500);
  }

  async function init(){
    try{
      catalog=await fetch(CATALOG_URL,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip catalog '+r.status);return r.json()});
      const p=new URLSearchParams(location.search),wanted=p.get('trip')||catalog.defaultTripId;
      currentTripMeta=catalog.trips.find(x=>x.id===wanted||x.slug===wanted)||catalog.trips.find(x=>x.id===catalog.defaultTripId);
      const profile=loadProfile();
      const explicitLang=new URLSearchParams(location.search).get('lang');
      if(!SUPPORTED_LOCALES.includes(String(explicitLang||'').toLowerCase())&&profile.language&&SUPPORTED_LOCALES.includes(profile.language))locale=profile.language;
      ensureGlobalUi();
      if(currentTripMeta.renderer!=='legacy-world') await activateRegionalTrip(currentTripMeta);
      else { await waitForCore(); activateLegacyLocalization(); }
    }catch(e){console.warn('ONE WORLD ROUTE platform layer unavailable',e)}
  }

  window.ONE_WORLD_PLATFORM={openRoutes:openRouteLibrary,openTraveller,getProfile:loadProfile,getTrip:()=>currentTripMeta,buildTripUrl};
  window.addEventListener('DOMContentLoaded',init);
})();

