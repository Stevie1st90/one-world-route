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
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker unavailable',err));
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
    en:{routes:'Routes',traveller:'Traveller',flagship:'Flagship',template:'Template',open:'Open route',days:'days',stops:'stops',segments:'segments',global:'Global perspective',contextTitle:'Traveller context',contextLead:'Used to adapt entry rules, language, currency and departure assumptions. Stored only on this device.',passports:'Passport country',secondPassport:'Second passport (optional)',residence:'Residence',language:'Language',currency:'Currency',origin:'Starting city / airport',adults:'Adults',children:'Children',mobility:'Reduced mobility',save:'Save context',clear:'Clear',notSet:'Not set',currentCheck:'Current check required',routeLibrary:'Explore routes',routeLibraryLead:'One platform for world journeys, round trips, road trips, rail, cruises and more.',editorial:'Editorial template — verify transport, prices and entry requirements for your dates.',overview:'Route overview',day:'Day',nights:'nights',transport:'Transport',verification:'Verification',backWorld:'World route',private:'Private on this device. Passport numbers, booking references and payment details are never requested.',sourcedBeta:'Sourced beta',sources:'Sources',lastChecked:'Last checked',publishedFrom:'from',verified:'Verified',routeEvidence:'Route evidence',entryGuidance:'Entry guidance',officialCheck:'Official check',connectionRequired:'connection required',minimumTravel:'minimum travel'},
    de:{routes:'Routen',traveller:'Traveller',flagship:'Flagship',template:'Vorlage',open:'Route öffnen',days:'Tage',stops:'Stopps',segments:'Segmente',global:'Globale Perspektive',contextTitle:'Traveller Context',contextLead:'Passt Einreisehinweise, Sprache, Währung und Startannahmen an. Wird nur auf diesem Gerät gespeichert.',passports:'Passland',secondPassport:'Zweiter Pass (optional)',residence:'Wohnsitz',language:'Sprache',currency:'Währung',origin:'Startstadt / Flughafen',adults:'Erwachsene',children:'Kinder',mobility:'Eingeschränkte Mobilität',save:'Kontext speichern',clear:'Zurücksetzen',notSet:'Nicht gesetzt',currentCheck:'Aktuelle Prüfung erforderlich',routeLibrary:'Routen entdecken',routeLibraryLead:'Eine Plattform für Weltreisen, Rundreisen, Roadtrips, Bahnreisen, Kreuzfahrten und mehr.',editorial:'Redaktionelle Vorlage — Verkehr, Preise und Einreisebedingungen für die eigenen Daten prüfen.',overview:'Routenübersicht',day:'Tag',nights:'Nächte',transport:'Verkehr',verification:'Prüfstatus',backWorld:'Weltreise',private:'Privat auf diesem Gerät. Passnummern, Buchungsreferenzen und Zahlungsdaten werden niemals abgefragt.',sourcedBeta:'Quellen-Beta',sources:'Quellen',lastChecked:'Zuletzt geprüft',publishedFrom:'ab',verified:'Verifiziert',routeEvidence:'Routenbelege',entryGuidance:'Einreisehinweise',officialCheck:'Offiziell prüfen',connectionRequired:'Umstieg einplanen',minimumTravel:'Mindestfahrzeit'},
    it:{routes:'Itinerari',traveller:'Viaggiatore',flagship:'Flagship',template:'Modello',open:'Apri itinerario',days:'giorni',stops:'tappe',segments:'tratte',global:'Prospettiva globale',contextTitle:'Profilo viaggiatore',contextLead:'Adatta requisiti d’ingresso, lingua, valuta e partenza. Salvato solo su questo dispositivo.',passports:'Paese del passaporto',secondPassport:'Secondo passaporto (opzionale)',residence:'Residenza',language:'Lingua',currency:'Valuta',origin:'Città / aeroporto di partenza',adults:'Adulti',children:'Bambini',mobility:'Mobilità ridotta',save:'Salva',clear:'Cancella',notSet:'Non impostato',currentCheck:'Verifica attuale richiesta',routeLibrary:'Esplora itinerari',routeLibraryLead:'Una piattaforma per giri del mondo, road trip, treni, crociere e altro.',editorial:'Modello editoriale — verifica trasporti, prezzi e requisiti per le tue date.',overview:'Panoramica',day:'Giorno',nights:'notti',transport:'Trasporto',verification:'Verifica',backWorld:'Giro del mondo',private:'Privato su questo dispositivo. Non chiediamo numeri di passaporto, prenotazioni o dati di pagamento.',sourcedBeta:'Beta con fonti',sources:'Fonti',lastChecked:'Ultima verifica',publishedFrom:'da',verified:'Verificato',routeEvidence:'Fonti del percorso',entryGuidance:'Ingresso',officialCheck:'Verifica ufficiale',connectionRequired:'coincidenza necessaria',minimumTravel:'tempo minimo'},
    es:{routes:'Rutas',traveller:'Viajero',flagship:'Flagship',template:'Plantilla',open:'Abrir ruta',days:'días',stops:'paradas',segments:'tramos',global:'Perspectiva global',contextTitle:'Contexto del viajero',contextLead:'Adapta requisitos de entrada, idioma, moneda y origen. Solo se guarda en este dispositivo.',passports:'País del pasaporte',secondPassport:'Segundo pasaporte (opcional)',residence:'Residencia',language:'Idioma',currency:'Moneda',origin:'Ciudad / aeropuerto de salida',adults:'Adultos',children:'Niños',mobility:'Movilidad reducida',save:'Guardar',clear:'Borrar',notSet:'Sin definir',currentCheck:'Revisión actual necesaria',routeLibrary:'Explorar rutas',routeLibraryLead:'Una plataforma para vueltas al mundo, road trips, trenes, cruceros y más.',editorial:'Plantilla editorial — verifica transporte, precios y requisitos para tus fechas.',overview:'Resumen de ruta',day:'Día',nights:'noches',transport:'Transporte',verification:'Verificación',backWorld:'Ruta mundial',private:'Privado en este dispositivo. Nunca pedimos números de pasaporte, reservas ni pagos.',sourcedBeta:'Beta con fuentes',sources:'Fuentes',lastChecked:'Última revisión',publishedFrom:'desde',verified:'Verificado',routeEvidence:'Fuentes de ruta',entryGuidance:'Entrada',officialCheck:'Comprobación oficial',connectionRequired:'conexión necesaria',minimumTravel:'tiempo mínimo'},
    fr:{routes:'Itinéraires',traveller:'Voyageur',flagship:'Flagship',template:'Modèle',open:'Ouvrir',days:'jours',stops:'étapes',segments:'segments',global:'Perspective globale',contextTitle:'Contexte voyageur',contextLead:'Adapte formalités, langue, devise et départ. Stocké uniquement sur cet appareil.',passports:'Pays du passeport',secondPassport:'Deuxième passeport (facultatif)',residence:'Résidence',language:'Langue',currency:'Devise',origin:'Ville / aéroport de départ',adults:'Adultes',children:'Enfants',mobility:'Mobilité réduite',save:'Enregistrer',clear:'Effacer',notSet:'Non défini',currentCheck:'Vérification actuelle requise',routeLibrary:'Explorer les itinéraires',routeLibraryLead:'Une plateforme pour tours du monde, road trips, train, croisières et plus.',editorial:'Modèle éditorial — vérifiez transports, prix et formalités pour vos dates.',overview:'Aperçu',day:'Jour',nights:'nuits',transport:'Transport',verification:'Vérification',backWorld:'Tour du monde',private:'Privé sur cet appareil. Aucun numéro de passeport, référence de réservation ou paiement n’est demandé.',sourcedBeta:'Bêta sourcée',sources:'Sources',lastChecked:'Dernière vérification',publishedFrom:'à partir de',verified:'Vérifié',routeEvidence:'Sources de l’itinéraire',entryGuidance:'Entrée',officialCheck:'Vérification officielle',connectionRequired:'correspondance nécessaire',minimumTravel:'temps minimum'},
    pt:{routes:'Rotas',traveller:'Viajante',flagship:'Flagship',template:'Modelo',open:'Abrir rota',days:'dias',stops:'paradas',segments:'trechos',global:'Perspectiva global',contextTitle:'Contexto do viajante',contextLead:'Adapta entrada, idioma, moeda e origem. Guardado apenas neste dispositivo.',passports:'País do passaporte',secondPassport:'Segundo passaporte (opcional)',residence:'Residência',language:'Idioma',currency:'Moeda',origin:'Cidade / aeroporto de partida',adults:'Adultos',children:'Crianças',mobility:'Mobilidade reduzida',save:'Salvar',clear:'Limpar',notSet:'Não definido',currentCheck:'Verificação atual necessária',routeLibrary:'Explorar rotas',routeLibraryLead:'Uma plataforma para voltas ao mundo, road trips, trem, cruzeiros e mais.',editorial:'Modelo editorial — verifique transporte, preços e entrada para suas datas.',overview:'Visão geral',day:'Dia',nights:'noites',transport:'Transporte',verification:'Verificação',backWorld:'Rota mundial',private:'Privado neste dispositivo. Nunca pedimos número de passaporte, referência de reserva ou pagamento.',sourcedBeta:'Beta com fontes',sources:'Fontes',lastChecked:'Última verificação',publishedFrom:'a partir de',verified:'Verificado',routeEvidence:'Fontes da rota',entryGuidance:'Entrada',officialCheck:'Verificação oficial',connectionRequired:'conexão necessária',minimumTravel:'tempo mínimo'}
  };

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
  const verificationLabel = s => s?.verification?.status==='verified'?t('verified'):t('currentCheck');
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
    return {passports:[],residenceCountry:null,language:locale,currency:'EUR',origin:null,party:{adults:1,children:0},accessibility:{reducedMobility:false}};
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

  function setQueryTrip(id){
    const p = new URLSearchParams(location.search);
    if(id === catalog.defaultTripId) p.delete('trip'); else p.set('trip',id);
    p.delete('segment'); p.delete('country'); p.delete('phase'); p.delete('view');
    location.assign(`${location.pathname}${p.toString()?`?${p}`:''}`);
  }

  function ensureGlobalUi(){
    const top = $('.topbar');
    if(!top || $('#platformRouteBtn')) return;
    const actions = $('.top-actions',top);
    const wrap = document.createElement('div');
    wrap.className='platform-actions';
    wrap.innerHTML=`<button id="platformRouteBtn" class="platform-pill" type="button"><span class="platform-pill-dot"></span><span>${esc(t('routes'))}</span></button><button id="platformTravellerBtn" class="platform-pill secondary" type="button">${esc(t('traveller'))}</button>`;
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
    modal.innerHTML=`<div class="platform-modal-card glass"><button class="platform-x" aria-label="Close">×</button><div class="platform-eyebrow">ONE WORLD ROUTE</div><h2>${esc(t('routeLibrary'))}</h2><p class="platform-lead">${esc(t('routeLibraryLead'))}</p><div class="platform-route-grid">${catalog.trips.map(routeCard).join('')}</div></div>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    $$('[data-platform-trip]',modal).forEach(b=>b.onclick=()=>setQueryTrip(b.dataset.platformTrip));
  }

  function routeCard(r){
    const metrics=[];
    if(r.metrics?.days)metrics.push(`${r.metrics.days} ${t('days')}`);
    if(r.metrics?.stops)metrics.push(`${r.metrics.stops} ${t('stops')}`);
    if(r.metrics?.countries)metrics.push(`${r.metrics.countries} ${r.metrics.countries===1?'country':'countries'}`);
    return `<article class="platform-route-card ${r.id===currentTripMeta?.id?'active':''}"><div class="platform-route-top"><span>${esc(r.kind)}</span><b>${esc(r.id===catalog.defaultTripId?t('flagship'):(r.status==='sourced-beta'?t('sourcedBeta'):t('template')))}</b></div><h3>${esc(local(r.title))}</h3><p>${esc(local(r.subtitle))}</p><div class="platform-route-metrics">${metrics.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button type="button" data-platform-trip="${esc(r.id)}">${esc(t('open'))} →</button></article>`;
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
    modal.innerHTML=`<form id="platformTravellerForm" class="platform-modal-card traveller-card glass"><button class="platform-x" type="button" aria-label="Close">×</button><div class="platform-eyebrow">${esc(t('global'))}</div><h2>${esc(t('contextTitle'))}</h2><p class="platform-lead">${esc(t('contextLead'))}</p><div class="traveller-grid"><label>${esc(t('passports'))}<select name="passport">${countryOptions(profile.passports?.[0]||null)}</select></label><label>${esc(t('secondPassport'))}<select name="passport2">${countryOptions(profile.passports?.[1]||null)}</select></label><label>${esc(t('residence'))}<select name="residence">${countryOptions(profile.residenceCountry)}</select></label><label>${esc(t('language'))}<select name="language">${SUPPORTED_LOCALES.map(l=>`<option value="${l}" ${profile.language===l?'selected':''}>${l.toUpperCase()}</option>`).join('')}</select></label><label>${esc(t('currency'))}<select name="currency">${currencies.map(c=>`<option value="${c}" ${profile.currency===c?'selected':''}>${c}</option>`).join('')}</select></label><label class="span-2">${esc(t('origin'))}<input name="origin" value="${esc(profile.origin||'')}" autocomplete="off" placeholder="e.g. Toronto / YYZ"></label><label>${esc(t('adults'))}<input name="adults" type="number" min="1" max="20" value="${Number(profile.party?.adults||1)}"></label><label>${esc(t('children'))}<input name="children" type="number" min="0" max="20" value="${Number(profile.party?.children||0)}"></label><label class="check span-2"><input name="mobility" type="checkbox" ${profile.accessibility?.reducedMobility?'checked':''}><span>${esc(t('mobility'))}</span></label></div><p class="platform-privacy">${esc(t('private'))}</p><div class="platform-form-actions"><button class="ghost" type="button" id="platformClearTraveller">${esc(t('clear'))}</button><button class="primary" type="submit">${esc(t('save'))}</button></div></form>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    $('#platformClearTraveller').onclick=()=>{localStorage.removeItem(PROFILE_KEY);modal.classList.add('hidden');location.reload()};
    $('#platformTravellerForm').onsubmit=e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);
      const passports=[f.get('passport'),f.get('passport2')].filter(Boolean).map(String).filter((v,i,a)=>a.indexOf(v)===i);const next={passports,residenceCountry:f.get('residence')||null,language:String(f.get('language')||'en'),currency:String(f.get('currency')||'EUR'),origin:String(f.get('origin')||'').trim()||null,party:{adults:Number(f.get('adults')||1),children:Number(f.get('children')||0)},accessibility:{reducedMobility:f.get('mobility')==='on'}};
      saveProfile(next);locale=SUPPORTED_LOCALES.includes(next.language)?next.language:locale;modal.classList.add('hidden');location.reload();
    };
  }

  function placeMap(trip){return new Map((trip.places||[]).map(p=>[p.id,p]))}
  function stopMap(trip){return new Map((trip.stops||[]).map(s=>[s.id,s]))}
  function stopPlace(trip,stop){return placeMap(trip).get(stop.placeId)}

  function applyTripShell(){
    document.body.classList.add('platform-regional-trip');
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
    buildLeftNavigation();
    buildChapterRail();
    replaceTimeline();
    renderTripOverview();
  }

  function buildLeftNavigation(){
    const panel=$('#leftPanel');if(!panel)return;
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
    rail.innerHTML=(currentTrip.chapters||[]).map((c,i)=>`<button type="button" data-trip-chapter="${i}" class="${i===0?'active':''}"><span class="phase-dot"></span>${esc(local(c.title))}</button>`).join('');
    $$('[data-trip-chapter]',rail).forEach(b=>b.onclick=()=>{
      $$('[data-trip-chapter]',rail).forEach(x=>x.classList.toggle('active',x===b));
      const c=currentTrip.chapters[Number(b.dataset.tripChapter)],idx=currentTrip.stops.findIndex(s=>s.id===c.stopIds?.[0]);if(idx>=0)selectStop(idx,true);
    });
  }

  function replaceTimeline(){
    const oldPlay=$('#playBtn');if(oldPlay){const n=oldPlay.cloneNode(true);n.id='playBtn';n.textContent='▶';oldPlay.replaceWith(n);n.onclick=togglePlayback}
    const oldRange=$('#routeRange');if(oldRange){const n=oldRange.cloneNode(true);n.id='routeRange';n.min='1';n.max=String(Math.max(1,currentTrip.segments.length));n.value='1';n.style.setProperty('--range-progress','0%');oldRange.replaceWith(n);n.oninput=()=>selectSegmentIndex(Number(n.value)-1,true)}
    const speed=$('.speed-control');if(speed)speed.style.display='none';
    updateTimelineRegional();
  }

  function updateTimelineRegional(){
    const s=currentTrip.segments[selectedSegmentIndex];if(!s)return;
    const stops=stopMap(currentTrip),places=placeMap(currentTrip),a=places.get(stops.get(s.fromStopId)?.placeId),b=places.get(stops.get(s.toStopId)?.placeId);
    const title=$('#timelineTitle');if(title)title.textContent=`${local(a?.name)} → ${local(b?.name)}`;
    const meta=$('#timelineMeta');if(meta)meta.textContent=`${t('segments')} ${s.sequence} / ${currentTrip.segments.length} · ${String(s.transport?.mode||'').replaceAll('-',' ')}`;
    const range=$('#routeRange');if(range){range.value=String(selectedSegmentIndex+1);range.style.setProperty('--range-progress',`${currentTrip.segments.length<=1?100:(selectedSegmentIndex/(currentTrip.segments.length-1))*100}%`)}
    const labels=$$('.range-labels span');if(labels[0])labels[0].innerHTML=`<b>START</b> · ${esc(local(stopPlace(currentTrip,currentTrip.stops[0])?.name))}`;if(labels[1])labels[1].textContent=`${currentTrip.planning?.days||'—'} ${t('days')}`;if(labels[2])labels[2].innerHTML=`<b>FINISH</b> · ${esc(local(stopPlace(currentTrip,currentTrip.stops.at(-1))?.name))}`;
  }

  function togglePlayback(){
    const btn=$('#playBtn');if(playTimer){clearInterval(playTimer);playTimer=null;if(btn)btn.textContent='▶';return}
    if(btn)btn.textContent='Ⅱ';playTimer=setInterval(()=>{if(selectedSegmentIndex>=currentTrip.segments.length-1){clearInterval(playTimer);playTimer=null;if(btn)btn.textContent='▶';return}selectSegmentIndex(selectedSegmentIndex+1,true)},1400);
  }

  function routeGeometry(){
    const stops=stopMap(currentTrip),places=placeMap(currentTrip);
    return currentTrip.segments.map((s,i)=>{const a=places.get(stops.get(s.fromStopId)?.placeId),b=places.get(stops.get(s.toStopId)?.placeId);return {...s,_index:i,start:a?.coordinates,end:b?.coordinates,fromName:local(a?.name),toName:local(b?.name)}}).filter(x=>x.start&&x.end);
  }

  function renderRegionalGlobe(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;if(!globe)return;
    const arcs=routeGeometry();
    try{
      globe.arcsData(arcs).arcStartLat(d=>d.start.lat).arcStartLng(d=>d.start.lng).arcEndLat(d=>d.end.lat).arcEndLng(d=>d.end.lng).arcAltitude(0.06).arcStroke(d=>d._index===selectedSegmentIndex?0.75:0.35).arcColor(d=>d._index===selectedSegmentIndex?'#59ddff':'rgba(113,151,190,.75)').arcDashLength(1).arcDashGap(0).onArcClick(d=>selectSegmentIndex(d._index,true));
      const places=[...placeMap(currentTrip).values()];
      globe.pointsData(places).pointLat(d=>d.coordinates.lat).pointLng(d=>d.coordinates.lng).pointAltitude(0.016).pointRadius(0.13).pointColor(()=> '#dff8ff').onPointClick(p=>{const idx=currentTrip.stops.findIndex(s=>s.placeId===p.id);if(idx>=0)selectStop(idx,true)});
      if(typeof globe.labelsData==='function')globe.labelsData(places).labelLat(d=>d.coordinates.lat).labelLng(d=>d.coordinates.lng).labelText(d=>local(d.name)).labelColor(()=> 'rgba(230,247,255,.94)').labelSize(1.15).labelDotRadius(0.15).labelAltitude(0.02);
      if(globe.controls()){globe.controls().autoRotate=false;globe.controls().enableZoom=true}
      const c=currentTrip.rendering?.camera||{lat:43.5,lng:13.5,altitude:.72};globe.pointOfView(c,900);
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
    const sourced=currentTrip.segments.filter(s=>(s.verification?.sourceIds||[]).length).length,verified=currentTrip.segments.filter(s=>s.verification?.status==='verified').length;
    const entry=currentTrip.entryGuidance,entrySource=entry?sourceMap().get(entry.officialResolverSourceId):null;
    content.innerHTML=`<div class="overview-number">${currentTrip.planning?.days||'—'}<small> ${esc(t('days'))}</small></div><p class="detail-copy">${esc(local(currentTrip.summary))}</p><div class="data-grid"><div class="data-card"><span>${esc(t('stops'))}</span><b>${currentTrip.stops.length}</b></div><div class="data-card"><span>${esc(t('routeEvidence'))}</span><b>${sourced}/${currentTrip.segments.length}</b></div><div class="data-card"><span>${esc(t('verified'))}</span><b>${verified}/${currentTrip.segments.length}</b></div><div class="data-card"><span>Currency</span><b>${esc(currentTrip.planning?.currency||'—')}</b></div></div>${entry?`<div class="platform-entry"><b>${esc(t('entryGuidance'))}</b><p>${esc(local(entry.message))}</p>${entrySource?`<a href="${esc(entrySource.url)}" target="_blank" rel="noopener noreferrer">${esc(t('officialCheck'))} →</a>`:''}</div>`:''}<button class="platform-context-inline" id="regionalTravellerBtn" type="button">${esc(t('traveller'))} →</button>`;
    $('#regionalTravellerBtn')?.addEventListener('click',openTraveller);
  }

  function renderStopDetail(stop,p){
    const title=$('#detailTitle');if(title)title.textContent=local(p.name);
    const eye=$('#detailEyebrow');if(eye)eye.textContent=`STOP ${stop.sequence} · ${p.type}`;
    const content=$('#detailContent');if(!content)return;
    content.innerHTML=`<div class="overview-number">${stop.sequence}<small> / ${currentTrip.stops.length}</small></div><div class="data-grid"><div class="data-card"><span>${esc(t('day'))}</span><b>${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''}</b></div><div class="data-card"><span>${esc(t('nights'))}</span><b>${stop.nights||0}</b></div><div class="data-card"><span>Type</span><b>${esc(p.type)}</b></div><div class="data-card"><span>Country</span><b>${esc(p.countryCode||'—')}</b></div></div><p class="detail-copy">${esc(t('editorial'))}</p>`;
  }

  function renderSegmentDetail(s){
    const sm=stopMap(currentTrip),pm=placeMap(currentTrip),a=pm.get(sm.get(s.fromStopId)?.placeId),b=pm.get(sm.get(s.toStopId)?.placeId);
    const title=$('#detailTitle');if(title)title.textContent=`${local(a?.name)} → ${local(b?.name)}`;
    const eye=$('#detailEyebrow');if(eye)eye.textContent=`SEGMENT ${s.sequence} / ${currentTrip.segments.length}`;
    const content=$('#detailContent');if(!content)return;
    const stages=(s.transport?.stages||[]).map((stage,i)=>`<article class="platform-stage"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(stage.operator||String(stage.mode||'').replaceAll('-',' '))}</b><small>${esc(stage.from||'')} → ${esc(stage.to||'')}</small><em>${esc(durationLabel(stage))} · ${esc(costLabel(stage))}</em></div></article>`).join('');
    const refs=[...(s.verification?.sourceIds||[]),...(s.transport?.stages||[]).flatMap(x=>x.sourceIds||[])];
    content.innerHTML=`<div class="data-grid"><div class="data-card"><span>${esc(t('transport'))}</span><b>${esc(String(s.transport?.mode||'—').replaceAll('-',' '))}</b></div><div class="data-card"><span>${esc(t('verification'))}</span><b class="${s.verification?.status==='verified'?'evidence-ok':'evidence-watch'}">${esc(verificationLabel(s))}</b></div><div class="data-card"><span>Duration</span><b>${esc(durationLabel(s.planning))}</b></div><div class="data-card"><span>Cost</span><b>${esc(costLabel(s.planning))}</b></div></div>${stages?`<div class="platform-stages">${stages}</div>`:''}${s.verification?.notes?`<div class="op-callout">${esc(s.verification.notes)}</div>`:''}${refs.length?`<div class="platform-evidence"><div class="ops-mini-title">${esc(t('sources'))}</div>${sourceLinks(refs)}</div>`:''}`;
  }

  async function activateRegionalTrip(meta){
    currentTripMeta=meta;
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
      const profile=loadProfile();if(profile.language&&SUPPORTED_LOCALES.includes(profile.language))locale=profile.language;
      ensureGlobalUi();
      if(currentTripMeta.renderer!=='legacy-world') await activateRegionalTrip(currentTripMeta);
    }catch(e){console.warn('ONE WORLD ROUTE platform layer unavailable',e)}
  }

  window.ONE_WORLD_PLATFORM={openRoutes:openRouteLibrary,openTraveller,getProfile:loadProfile,getTrip:()=>currentTripMeta};
  window.addEventListener('DOMContentLoaded',init);
})();

