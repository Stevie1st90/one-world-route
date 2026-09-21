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


/* ===== platform/runtime.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const extensions=new Map();
  root.runtime={
    version:1,
    registerExtension(id,extension){
      if(!id||typeof extension!=='object')throw new Error('Invalid platform extension');
      if(extensions.has(id))throw new Error('Duplicate platform extension: '+id);
      extensions.set(id,Object.freeze({...extension,id}));
      return extensions.get(id);
    },
    getExtension(id){return extensions.get(id)||null},
    listExtensions(){return [...extensions.values()]}
  };
})();


/* ===== platform/map-style.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  function localize(style,locale='en'){
    const supported=['en','de','it','es','fr','pt'];
    const lang=supported.includes(String(locale||'').toLowerCase())?String(locale).toLowerCase():'en';
    const nameExpr=['coalesce',['get',`name:${lang}`],['get',`name_${lang}`],['get','name:latin'],['get','name_en'],['get','name']];
    for(const layer of style?.layers||[]){
      if(layer?.type!=='symbol'||!layer.layout)continue;
      if(/^(label_(country|city|state|other)|water_name)/.test(String(layer.id||'')))layer.layout['text-field']=nameExpr;
    }
    return style;
  }

  function brandDark(style){
    for(const layer of style?.layers||[]){
      const id=String(layer.id||'').toLowerCase(),type=layer.type;
      layer.paint=layer.paint||{};
      if(type==='background'){
        layer.paint['background-color']='#071019';
        continue;
      }
      if(type==='fill'){
        if(/water|ocean|lake|river/.test(id)){
          layer.paint['fill-color']='#071b2a';layer.paint['fill-opacity']=.98;
        }else if(/park|wood|forest|grass|nature|landcover/.test(id)){
          layer.paint['fill-color']='#102018';layer.paint['fill-opacity']=.72;
        }else if(/building/.test(id)){
          layer.paint['fill-color']='#16232d';layer.paint['fill-outline-color']='#20333e';layer.paint['fill-opacity']=.78;
        }else{
          layer.paint['fill-color']='#0d1720';
          if(layer.paint['fill-opacity']===undefined)layer.paint['fill-opacity']=.94;
        }
      }else if(type==='line'){
        if(/boundary|admin/.test(id)){
          layer.paint['line-color']='#466076';layer.paint['line-opacity']=.5;
        }else if(/motorway|trunk|primary/.test(id)){
          layer.paint['line-color']='#5b6571';layer.paint['line-opacity']=.66;
        }else if(/road|street|transport/.test(id)){
          layer.paint['line-color']='#33424f';layer.paint['line-opacity']=.52;
        }else if(/water|river/.test(id)){
          layer.paint['line-color']='#234f65';layer.paint['line-opacity']=.7;
        }else{
          layer.paint['line-color']=layer.paint['line-color']||'#2e3d49';
          if(layer.paint['line-opacity']===undefined)layer.paint['line-opacity']=.48;
        }
      }else if(type==='symbol'){
        layer.paint['text-color']=/water|marine/.test(id)?'#7098ae':(/country/.test(id)?'#dfeaf2':'#aebfcb');
        layer.paint['text-halo-color']='#071019';
        layer.paint['text-halo-width']=1.2;
        layer.paint['text-halo-blur']=.45;
        if(layer.paint['icon-opacity']===undefined)layer.paint['icon-opacity']=.72;
      }else if(type==='fill-extrusion'){
        layer.paint['fill-extrusion-color']='#172630';layer.paint['fill-extrusion-opacity']=.72;
      }else if(type==='hillshade'){
        layer.paint['hillshade-shadow-color']='#02070b';
        layer.paint['hillshade-highlight-color']='#50606b';
        layer.paint['hillshade-accent-color']='#1f3440';
        layer.paint['hillshade-exaggeration']=.42;
      }
    }
    return style;
  }

  root.mapStyle={localize,brandDark};
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

  const localizeTerrainStyle=style=>window.ONE_WORLD_PLATFORM_MODULES?.mapStyle?.localize(style,String(document.documentElement.lang||'en').toLowerCase().split('-')[0])||style;
  const brandTerrainStyle=style=>window.ONE_WORLD_PLATFORM_MODULES?.mapStyle?.brandDark(style)||style;

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

    base=brandTerrainStyle(localizeTerrainStyle(base));
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
    if(document.body.classList.contains('platform-regional-trip')||new URLSearchParams(location.search).has('trip')){
      const api=window.ONE_WORLD_PLATFORM;
      if(api?.setTerrain)return api.setTerrain(Boolean(active));
      setTimeout(()=>window.ONE_WORLD_PLATFORM?.setTerrain?.(Boolean(active)),120);
      return;
    }
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
    const params=new URLSearchParams(location.search);
    setToggleState(false);
    if(params.has('trip'))return;
    const wantsTerrain=params.get('view')==='terrain';
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
      if(document.body.classList.contains('platform-regional-trip')){
        window.ONE_WORLD_PLATFORM?.focusRoute?.();
        return;
      }
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

/* ===== platform/i18n.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const SUPPORTED_LOCALES=['en','de','it','es','fr','pt'];
  const I18N = {
    en:{routes:'Routes',traveller:'Traveller',flagship:'Flagship',template:'Template',open:'Open route',days:'days',stops:'stops',segments:'segments',global:'Global perspective',contextTitle:'Traveller context',contextLead:'Used to adapt entry rules, language, currency and departure assumptions. Stored only on this device.',passports:'Passport country',secondPassport:'Second passport (optional)',residence:'Residence',language:'Language',currency:'Currency',origin:'Starting city / airport',adults:'Adults',children:'Children',mobility:'Reduced mobility',save:'Save context',clear:'Clear',close:'Close',notSet:'Not set',currentCheck:'Current check required',routeLibrary:'Explore routes',routeLibraryLead:'One platform for world journeys, round trips, road trips, rail, cruises and more.',editorial:'Editorial template — verify transport, prices and entry requirements for your dates.',overview:'Route overview',day:'Day',nights:'nights',transport:'Transport',verification:'Verification',backWorld:'World route',private:'Private on this device. Passport numbers, booking references and payment details are never requested.',sourcedBeta:'Sourced beta',sources:'Sources',lastChecked:'Last checked',publishedFrom:'from',verified:'Verified',routeEvidence:'Route evidence',entryGuidance:'Entry guidance',officialCheck:'Official check',connectionRequired:'connection required',minimumTravel:'minimum travel',cruiseTemplate:'Cruise template',onboardNights:'onboard nights',seaDays:'sea days',portCall:'Port call',embarkation:'Embarkation',disembarkation:'Disembarkation',border:'Border context',schengenExit:'Schengen exit',schengenEntry:'Schengen re-entry',sailingNeeded:'Select a real sailing for ship, operator, times, berth and price.',illustrative:'Illustrative',searchRoutes:'Search routes',filterType:'Travel type',filterRegion:'Region',filterDuration:'Duration',all:'All',noRoutes:'No routes match these filters.',vehicleSection:'Vehicle context (optional)',vehicleType:'Vehicle',registrationCountry:'Registration country',fuelType:'Fuel / powertrain',euroClass:'Euro emissions class',rentalCrossBorder:'Rental approved for cross-border travel',privateCar:'Private car',rentalCar:'Rental car',camper:'Camper',motorcycle:'Motorcycle',otherVehicle:'Other',petrol:'Petrol',diesel:'Diesel',hybrid:'Hybrid',pluginHybrid:'Plug-in hybrid',electric:'Electric',hydrogen:'Hydrogen',unknown:'Unknown',roadRules:'Road context',crossBorder:'Cross-border',urbanAccess:'Urban access checks',vehicleNeeded:'Vehicle context required for toll, LEZ and access checks.',facet_world:'World',facet_round_trip:'Round trip',facet_road_trip:'Road trip',facet_cruise:'Cruise',facet_global:'Global',facet_europe:'Europe',facet_southern_europe:'Southern Europe',facet_italy:'Italy',facet_mediterranean:'Mediterranean',facet_north_africa:'North Africa',filterMode:'Transport',filterTheme:'Theme',results:'routes found',resetFilters:'Reset',details:'Details',start:'Start',finish:'Finish',previous:'Previous',next:'Next',type:'Type',country:'Country',duration:'Duration',cost:'Cost',segment:'Segment',stop:'Stop',currency:'Currency',facet_rail:'Rail',facet_bus:'Bus',facet_car:'Car',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Road',facet_coach:'Coach',facet_ground_transfer:'Ground transfer',story:'Story',storyPlay:'Play story',storyExit:'Exit story',storyComplete:'Route complete',chapter:'Chapter',settings:'Settings',methodology:'Methodology',share:'Share',autoRotate:'Auto rotate',highDetail:'High detail globe',terrain:'Real 3D globe terrain',showPoints:'Stop points',routeGlow:'Route glow',arcThickness:'Route thickness',reducedMotion:'Reduced motion',terrainLoading:'Loading 3D terrain…',terrainHint:'Drag to rotate · scroll to zoom · real elevation appears as you move closer',routeMethodTitle:'Route methodology',routeMethodText:'This curated route uses publication-safe trip data and source-backed evidence where available. Volatile schedules, prices and traveller-specific rules remain explicitly unresolved until dates and context are known.',evidenceCoverage:'Evidence coverage',editorialStatus:'Editorial status',storyRoute:'Route story',routeFit:'Route Fit',showFit:'More fit filters',hideFit:'Hide fit filters',fitPace:'Pace',fitSeason:'Season',fitParty:'Travelling as',fitStart:'Route starts in',facet_relaxed:'Relaxed',facet_balanced:'Balanced',facet_active:'Active',facet_spring:'Spring',facet_summer:'Summer',facet_autumn:'Autumn',facet_winter:'Winter',facet_multi_season:'Multi-season',facet_solo:'Solo',facet_couples:'Couple',facet_friends:'Friends',facet_families:'Family',resultOne:'route found',countryUnit:'country',countriesUnit:'countries',facet_city:'City',facet_cruise_port:'Cruise port',facet_port:'Port',facet_rail_station:'Rail station',facet_airport:'Airport',facet_island:'Island',facet_park:'Park',status_planned:'Planned',status_sourced_beta:'Sourced beta',status_illustrative_template:'Illustrative template',status_draft:'Draft'},
    de:{routes:'Routen',traveller:'Reisekontext',flagship:'Flagship',template:'Vorlage',open:'Route öffnen',days:'Tage',stops:'Stopps',segments:'Segmente',global:'Globale Perspektive',contextTitle:'Reisekontext',contextLead:'Passt Einreisehinweise, Sprache, Währung und Startannahmen an. Wird nur auf diesem Gerät gespeichert.',passports:'Passland',secondPassport:'Zweiter Pass (optional)',residence:'Wohnsitz',language:'Sprache',currency:'Währung',origin:'Startstadt / Flughafen',adults:'Erwachsene',children:'Kinder',mobility:'Eingeschränkte Mobilität',save:'Kontext speichern',clear:'Zurücksetzen',close:'Schließen',notSet:'Nicht gesetzt',currentCheck:'Aktuelle Prüfung erforderlich',routeLibrary:'Routen entdecken',routeLibraryLead:'Eine Plattform für Weltreisen, Rundreisen, Roadtrips, Bahnreisen, Kreuzfahrten und mehr.',editorial:'Redaktionelle Vorlage — Verkehr, Preise und Einreisebedingungen für die eigenen Daten prüfen.',overview:'Routenübersicht',day:'Tag',nights:'Nächte',transport:'Verkehr',verification:'Prüfstatus',backWorld:'Weltreise',private:'Privat auf diesem Gerät. Passnummern, Buchungsreferenzen und Zahlungsdaten werden niemals abgefragt.',sourcedBeta:'Quellen-Beta',sources:'Quellen',lastChecked:'Zuletzt geprüft',publishedFrom:'ab',verified:'Verifiziert',routeEvidence:'Routenbelege',entryGuidance:'Einreisehinweise',officialCheck:'Offiziell prüfen',connectionRequired:'Umstieg einplanen',minimumTravel:'Mindestfahrzeit',cruiseTemplate:'Kreuzfahrt-Vorlage',onboardNights:'Nächte an Bord',seaDays:'Seetage',portCall:'Hafenstopp',embarkation:'Einschiffung',disembarkation:'Ausschiffung',border:'Grenzkontext',schengenExit:'Schengen-Ausreise',schengenEntry:'Schengen-Wiedereinreise',sailingNeeded:'Für Schiff, Reederei, Zeiten, Liegeplatz und Preis muss eine konkrete Abfahrt gewählt werden.',illustrative:'Illustrativ',searchRoutes:'Routen suchen',filterType:'Reiseart',filterRegion:'Region',filterDuration:'Dauer',all:'Alle',noRoutes:'Keine Route passt zu diesen Filtern.',vehicleSection:'Fahrzeugkontext (optional)',vehicleType:'Fahrzeug',registrationCountry:'Zulassungsland',fuelType:'Kraftstoff / Antrieb',euroClass:'Euro-Abgasnorm',rentalCrossBorder:'Mietwagen für Grenzübertritte freigegeben',privateCar:'Privatwagen',rentalCar:'Mietwagen',camper:'Camper',motorcycle:'Motorrad',otherVehicle:'Anderes',petrol:'Benzin',diesel:'Diesel',hybrid:'Hybrid',pluginHybrid:'Plug-in-Hybrid',electric:'Elektro',hydrogen:'Wasserstoff',unknown:'Unbekannt',roadRules:'Straßenkontext',crossBorder:'Grenzübertritt',urbanAccess:'Stadtzufahrt prüfen',vehicleNeeded:'Für Maut-, Umweltzonen- und Zufahrtsprüfungen wird ein Fahrzeugkontext benötigt.',facet_world:'Weltreise',facet_round_trip:'Rundreise',facet_road_trip:'Roadtrip',facet_cruise:'Kreuzfahrt',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Südeuropa',facet_italy:'Italien',facet_mediterranean:'Mittelmeer',facet_north_africa:'Nordafrika',filterMode:'Verkehrsmittel',filterTheme:'Reisethema',results:'Routen gefunden',resetFilters:'Filter zurücksetzen',details:'Details',start:'Start',finish:'Ziel',previous:'Zurück',next:'Weiter',type:'Typ',country:'Land',duration:'Dauer',cost:'Kosten',segment:'Segment',stop:'Stopp',currency:'Währung',facet_rail:'Bahn',facet_bus:'Bus',facet_car:'Auto',facet_ferry:'Fähre',facet_multimodal:'Multimodal',facet_road:'Straße',facet_coach:'Fernbus',facet_ground_transfer:'Bodentransfer',story:'Story',storyPlay:'Story starten',storyExit:'Story beenden',storyComplete:'Route abgeschlossen',chapter:'Kapitel',settings:'Einstellungen',methodology:'Methodik',share:'Teilen',autoRotate:'Automatisch drehen',highDetail:'Hochauflösender Globus',terrain:'Echtes 3D-Globus-Terrain',showPoints:'Stopppunkte',routeGlow:'Routenleuchten',arcThickness:'Linienstärke',reducedMotion:'Reduzierte Bewegung',terrainLoading:'3D-Terrain wird geladen…',terrainHint:'Ziehen zum Drehen · scrollen zum Zoomen · echtes Relief erscheint beim Annähern',routeMethodTitle:'Routenmethodik',routeMethodText:'Diese kuratierte Route verwendet veröffentlichungssichere Reisedaten und, wo verfügbar, quellenbasierte Belege. Veränderliche Fahrpläne, Preise und reisendenspezifische Regeln bleiben ausdrücklich offen, bis Datum und Kontext feststehen.',evidenceCoverage:'Quellenabdeckung',editorialStatus:'Redaktioneller Status',storyRoute:'Routen-Story',routeFit:'Route Fit',showFit:'Weitere passende Filter',hideFit:'Passende Filter ausblenden',fitPace:'Reisetempo',fitSeason:'Reisezeit',fitParty:'Reisekonstellation',fitStart:'Routenstart',facet_relaxed:'Entspannt',facet_balanced:'Ausgewogen',facet_active:'Aktiv',facet_spring:'Frühling',facet_summer:'Sommer',facet_autumn:'Herbst',facet_winter:'Winter',facet_multi_season:'Mehrere Jahreszeiten',facet_solo:'Allein',facet_couples:'Paar',facet_friends:'Freunde',facet_families:'Familie',resultOne:'Route gefunden',countryUnit:'Land',countriesUnit:'Länder',facet_city:'Stadt',facet_cruise_port:'Kreuzfahrthafen',facet_port:'Hafen',facet_rail_station:'Bahnhof',facet_airport:'Flughafen',facet_island:'Insel',facet_park:'Park',status_planned:'Geplant',status_sourced_beta:'Quellen-Beta',status_illustrative_template:'Illustrative Vorlage',status_draft:'Entwurf'},
    it:{routes:'Itinerari',traveller:'Viaggiatore',flagship:'Flagship',template:'Modello',open:'Apri itinerario',days:'giorni',stops:'tappe',segments:'tratte',global:'Prospettiva globale',contextTitle:'Profilo viaggiatore',contextLead:'Adatta requisiti d’ingresso, lingua, valuta e partenza. Salvato solo su questo dispositivo.',passports:'Paese del passaporto',secondPassport:'Secondo passaporto (opzionale)',residence:'Residenza',language:'Lingua',currency:'Valuta',origin:'Città / aeroporto di partenza',adults:'Adulti',children:'Bambini',mobility:'Mobilità ridotta',save:'Salva',clear:'Cancella',close:'Chiudi',notSet:'Non impostato',currentCheck:'Verifica attuale richiesta',routeLibrary:'Esplora itinerari',routeLibraryLead:'Una piattaforma per giri del mondo, road trip, treni, crociere e altro.',editorial:'Modello editoriale — verifica trasporti, prezzi e requisiti per le tue date.',overview:'Panoramica',day:'Giorno',nights:'notti',transport:'Trasporto',verification:'Verifica',backWorld:'Giro del mondo',private:'Privato su questo dispositivo. Non chiediamo numeri di passaporto, prenotazioni o dati di pagamento.',sourcedBeta:'Beta con fonti',sources:'Fonti',lastChecked:'Ultima verifica',publishedFrom:'da',verified:'Verificato',routeEvidence:'Fonti del percorso',entryGuidance:'Ingresso',officialCheck:'Verifica ufficiale',connectionRequired:'coincidenza necessaria',minimumTravel:'tempo minimo',cruiseTemplate:'Modello crociera',onboardNights:'notti a bordo',seaDays:'giorni in mare',portCall:'Scalo',embarkation:'Imbarco',disembarkation:'Sbarco',border:'Contesto di frontiera',schengenExit:'Uscita Schengen',schengenEntry:'Rientro Schengen',sailingNeeded:'Seleziona una partenza reale per nave, operatore, orari, ormeggio e prezzo.',illustrative:'Illustrativo',searchRoutes:'Cerca itinerari',filterType:'Tipo di viaggio',filterRegion:'Regione',filterDuration:'Durata',all:'Tutti',noRoutes:'Nessun itinerario corrisponde ai filtri.',vehicleSection:'Profilo veicolo (opzionale)',vehicleType:'Veicolo',registrationCountry:'Paese di immatricolazione',fuelType:'Carburante / propulsione',euroClass:'Classe Euro',rentalCrossBorder:'Noleggio autorizzato oltre confine',privateCar:'Auto privata',rentalCar:'Auto a noleggio',camper:'Camper',motorcycle:'Moto',otherVehicle:'Altro',petrol:'Benzina',diesel:'Diesel',hybrid:'Ibrido',pluginHybrid:'Ibrido plug-in',electric:'Elettrico',hydrogen:'Idrogeno',unknown:'Sconosciuto',roadRules:'Contesto stradale',crossBorder:'Transfrontaliero',urbanAccess:'Verifica accesso urbano',vehicleNeeded:'Il profilo veicolo è necessario per pedaggi, ZFE e accessi.',facet_world:'Giro del mondo',facet_round_trip:'Tour',facet_road_trip:'Road trip',facet_cruise:'Crociera',facet_global:'Globale',facet_europe:'Europa',facet_southern_europe:'Europa meridionale',facet_italy:'Italia',facet_mediterranean:'Mediterraneo',facet_north_africa:'Nord Africa',filterMode:'Trasporto',filterTheme:'Tema',results:'itinerari trovati',resetFilters:'Reimposta',details:'Dettagli',start:'Partenza',finish:'Arrivo',previous:'Indietro',next:'Avanti',type:'Tipo',country:'Paese',duration:'Durata',cost:'Costo',segment:'Tratta',stop:'Tappa',currency:'Valuta',facet_rail:'Treno',facet_bus:'Bus',facet_car:'Auto',facet_ferry:'Traghetto',facet_multimodal:'Multimodale',facet_road:'Strada',facet_coach:'Pullman',facet_ground_transfer:'Trasferimento terrestre',story:'Storia',storyPlay:'Avvia storia',storyExit:'Esci dalla storia',storyComplete:'Itinerario completato',chapter:'Capitolo',settings:'Impostazioni',methodology:'Metodologia',share:'Condividi',autoRotate:'Rotazione automatica',highDetail:'Globo ad alta definizione',terrain:'Terreno 3D reale',showPoints:'Punti delle tappe',routeGlow:'Bagliore itinerario',arcThickness:'Spessore linea',reducedMotion:'Movimento ridotto',terrainLoading:'Caricamento terreno 3D…',terrainHint:'Trascina per ruotare · scorri per zoomare · il rilievo reale appare avvicinandoti',routeMethodTitle:'Metodologia itinerario',routeMethodText:'Questo itinerario curato usa dati pubblicabili e fonti verificabili quando disponibili. Orari, prezzi e regole personali variabili restano aperti finché non sono noti date e contesto.',evidenceCoverage:'Copertura fonti',editorialStatus:'Stato editoriale',storyRoute:'Storia itinerario',routeFit:'Route Fit',showFit:'Altri filtri di compatibilità',hideFit:'Nascondi filtri',fitPace:'Ritmo',fitSeason:'Stagione',fitParty:'Compagnia',fitStart:'Partenza itinerario',facet_relaxed:'Rilassato',facet_balanced:'Equilibrato',facet_active:'Attivo',facet_spring:'Primavera',facet_summer:'Estate',facet_autumn:'Autunno',facet_winter:'Inverno',facet_multi_season:'Più stagioni',facet_solo:'Solo',facet_couples:'Coppia',facet_friends:'Amici',facet_families:'Famiglia',resultOne:'itinerario trovato',countryUnit:'paese',countriesUnit:'paesi',facet_city:'Città',facet_cruise_port:'Porto crocieristico',facet_port:'Porto',facet_rail_station:'Stazione ferroviaria',facet_airport:'Aeroporto',facet_island:'Isola',facet_park:'Parco',status_planned:'Pianificato',status_sourced_beta:'Beta con fonti',status_illustrative_template:'Modello illustrativo',status_draft:'Bozza'},
    es:{routes:'Rutas',traveller:'Viajero',flagship:'Flagship',template:'Plantilla',open:'Abrir ruta',days:'días',stops:'paradas',segments:'tramos',global:'Perspectiva global',contextTitle:'Contexto del viajero',contextLead:'Adapta requisitos de entrada, idioma, moneda y origen. Solo se guarda en este dispositivo.',passports:'País del pasaporte',secondPassport:'Segundo pasaporte (opcional)',residence:'Residencia',language:'Idioma',currency:'Moneda',origin:'Ciudad / aeropuerto de salida',adults:'Adultos',children:'Niños',mobility:'Movilidad reducida',save:'Guardar',clear:'Borrar',close:'Cerrar',notSet:'Sin definir',currentCheck:'Revisión actual necesaria',routeLibrary:'Explorar rutas',routeLibraryLead:'Una plataforma para vueltas al mundo, road trips, trenes, cruceros y más.',editorial:'Plantilla editorial — verifica transporte, precios y requisitos para tus fechas.',overview:'Resumen de ruta',day:'Día',nights:'noches',transport:'Transporte',verification:'Verificación',backWorld:'Ruta mundial',private:'Privado en este dispositivo. Nunca pedimos números de pasaporte, reservas ni pagos.',sourcedBeta:'Beta con fuentes',sources:'Fuentes',lastChecked:'Última revisión',publishedFrom:'desde',verified:'Verificado',routeEvidence:'Fuentes de ruta',entryGuidance:'Entrada',officialCheck:'Comprobación oficial',connectionRequired:'conexión necesaria',minimumTravel:'tiempo mínimo',cruiseTemplate:'Plantilla de crucero',onboardNights:'noches a bordo',seaDays:'días de navegación',portCall:'Escala',embarkation:'Embarque',disembarkation:'Desembarque',border:'Contexto fronterizo',schengenExit:'Salida de Schengen',schengenEntry:'Reentrada a Schengen',sailingNeeded:'Selecciona una salida real para barco, operador, horarios, atraque y precio.',illustrative:'Ilustrativo',searchRoutes:'Buscar rutas',filterType:'Tipo de viaje',filterRegion:'Región',filterDuration:'Duración',all:'Todas',noRoutes:'Ninguna ruta coincide con los filtros.',vehicleSection:'Contexto del vehículo (opcional)',vehicleType:'Vehículo',registrationCountry:'País de matriculación',fuelType:'Combustible / propulsión',euroClass:'Clase Euro',rentalCrossBorder:'Alquiler autorizado para cruzar fronteras',privateCar:'Coche privado',rentalCar:'Coche de alquiler',camper:'Camper',motorcycle:'Moto',otherVehicle:'Otro',petrol:'Gasolina',diesel:'Diésel',hybrid:'Híbrido',pluginHybrid:'Híbrido enchufable',electric:'Eléctrico',hydrogen:'Hidrógeno',unknown:'Desconocido',roadRules:'Contexto vial',crossBorder:'Transfronterizo',urbanAccess:'Comprobar acceso urbano',vehicleNeeded:'Se requiere contexto del vehículo para peajes, ZBE y accesos.',facet_world:'Vuelta al mundo',facet_round_trip:'Ruta circular',facet_road_trip:'Road trip',facet_cruise:'Crucero',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Sur de Europa',facet_italy:'Italia',facet_mediterranean:'Mediterráneo',facet_north_africa:'Norte de África',filterMode:'Transporte',filterTheme:'Tema',results:'rutas encontradas',resetFilters:'Restablecer',details:'Detalles',start:'Inicio',finish:'Final',previous:'Anterior',next:'Siguiente',type:'Tipo',country:'País',duration:'Duración',cost:'Coste',segment:'Tramo',stop:'Parada',currency:'Moneda',facet_rail:'Tren',facet_bus:'Bus',facet_car:'Coche',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Carretera',facet_coach:'Autocar',facet_ground_transfer:'Traslado terrestre',story:'Historia',storyPlay:'Reproducir historia',storyExit:'Salir de la historia',storyComplete:'Ruta completada',chapter:'Capítulo',settings:'Ajustes',methodology:'Metodología',share:'Compartir',autoRotate:'Rotación automática',highDetail:'Globo de alta definición',terrain:'Terreno 3D real',showPoints:'Puntos de parada',routeGlow:'Brillo de ruta',arcThickness:'Grosor de ruta',reducedMotion:'Movimiento reducido',terrainLoading:'Cargando terreno 3D…',terrainHint:'Arrastra para girar · desplázate para acercar · el relieve real aparece al aproximarte',routeMethodTitle:'Metodología de ruta',routeMethodText:'Esta ruta curada usa datos publicables y evidencia con fuentes cuando está disponible. Horarios, precios y reglas personales variables permanecen abiertos hasta conocer fechas y contexto.',evidenceCoverage:'Cobertura de fuentes',editorialStatus:'Estado editorial',storyRoute:'Historia de la ruta',routeFit:'Route Fit',showFit:'Más filtros de ajuste',hideFit:'Ocultar filtros',fitPace:'Ritmo',fitSeason:'Temporada',fitParty:'Compañía',fitStart:'Inicio de ruta',facet_relaxed:'Relajado',facet_balanced:'Equilibrado',facet_active:'Activo',facet_spring:'Primavera',facet_summer:'Verano',facet_autumn:'Otoño',facet_winter:'Invierno',facet_multi_season:'Varias estaciones',facet_solo:'Solo',facet_couples:'Pareja',facet_friends:'Amigos',facet_families:'Familia',resultOne:'ruta encontrada',countryUnit:'país',countriesUnit:'países',facet_city:'Ciudad',facet_cruise_port:'Puerto de cruceros',facet_port:'Puerto',facet_rail_station:'Estación de tren',facet_airport:'Aeropuerto',facet_island:'Isla',facet_park:'Parque',status_planned:'Planificado',status_sourced_beta:'Beta con fuentes',status_illustrative_template:'Plantilla ilustrativa',status_draft:'Borrador'},
    fr:{routes:'Itinéraires',traveller:'Voyageur',flagship:'Flagship',template:'Modèle',open:'Ouvrir',days:'jours',stops:'étapes',segments:'segments',global:'Perspective globale',contextTitle:'Contexte voyageur',contextLead:'Adapte formalités, langue, devise et départ. Stocké uniquement sur cet appareil.',passports:'Pays du passeport',secondPassport:'Deuxième passeport (facultatif)',residence:'Résidence',language:'Langue',currency:'Devise',origin:'Ville / aéroport de départ',adults:'Adultes',children:'Enfants',mobility:'Mobilité réduite',save:'Enregistrer',clear:'Effacer',close:'Fermer',notSet:'Non défini',currentCheck:'Vérification actuelle requise',routeLibrary:'Explorer les itinéraires',routeLibraryLead:'Une plateforme pour tours du monde, road trips, train, croisières et plus.',editorial:'Modèle éditorial — vérifiez transports, prix et formalités pour vos dates.',overview:'Aperçu',day:'Jour',nights:'nuits',transport:'Transport',verification:'Vérification',backWorld:'Tour du monde',private:'Privé sur cet appareil. Aucun numéro de passeport, référence de réservation ou paiement n’est demandé.',sourcedBeta:'Bêta sourcée',sources:'Sources',lastChecked:'Dernière vérification',publishedFrom:'à partir de',verified:'Vérifié',routeEvidence:'Sources de l’itinéraire',entryGuidance:'Entrée',officialCheck:'Vérification officielle',connectionRequired:'correspondance nécessaire',minimumTravel:'temps minimum',cruiseTemplate:'Modèle croisière',onboardNights:'nuits à bord',seaDays:'jours en mer',portCall:'Escale',embarkation:'Embarquement',disembarkation:'Débarquement',border:'Contexte frontalier',schengenExit:'Sortie Schengen',schengenEntry:'Rentrée Schengen',sailingNeeded:'Sélectionnez un départ réel pour le navire, l’opérateur, les horaires, le quai et le prix.',illustrative:'Illustratif',searchRoutes:'Rechercher des itinéraires',filterType:'Type de voyage',filterRegion:'Région',filterDuration:'Durée',all:'Tous',noRoutes:'Aucun itinéraire ne correspond aux filtres.',vehicleSection:'Contexte véhicule (facultatif)',vehicleType:'Véhicule',registrationCountry:'Pays d’immatriculation',fuelType:'Carburant / motorisation',euroClass:'Classe Euro',rentalCrossBorder:'Location autorisée à franchir les frontières',privateCar:'Voiture privée',rentalCar:'Voiture de location',camper:'Camping-car',motorcycle:'Moto',otherVehicle:'Autre',petrol:'Essence',diesel:'Diesel',hybrid:'Hybride',pluginHybrid:'Hybride rechargeable',electric:'Électrique',hydrogen:'Hydrogène',unknown:'Inconnu',roadRules:'Contexte routier',crossBorder:'Transfrontalier',urbanAccess:'Vérifier l’accès urbain',vehicleNeeded:'Le contexte véhicule est requis pour péages, ZFE et accès.',facet_world:'Tour du monde',facet_round_trip:'Circuit',facet_road_trip:'Road trip',facet_cruise:'Croisière',facet_global:'Mondial',facet_europe:'Europe',facet_southern_europe:'Europe du Sud',facet_italy:'Italie',facet_mediterranean:'Méditerranée',facet_north_africa:'Afrique du Nord',filterMode:'Transport',filterTheme:'Thème',results:'itinéraires trouvés',resetFilters:'Réinitialiser',details:'Détails',start:'Départ',finish:'Arrivée',previous:'Précédent',next:'Suivant',type:'Type',country:'Pays',duration:'Durée',cost:'Coût',segment:'Segment',stop:'Étape',currency:'Devise',facet_rail:'Train',facet_bus:'Bus',facet_car:'Voiture',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Route',facet_coach:'Autocar',facet_ground_transfer:'Transfert terrestre',story:'Récit',storyPlay:'Lire le récit',storyExit:'Quitter le récit',storyComplete:'Itinéraire terminé',chapter:'Chapitre',settings:'Réglages',methodology:'Méthodologie',share:'Partager',autoRotate:'Rotation automatique',highDetail:'Globe haute définition',terrain:'Relief 3D réel',showPoints:'Points d’étape',routeGlow:'Lueur de route',arcThickness:'Épaisseur de route',reducedMotion:'Mouvement réduit',terrainLoading:'Chargement du relief 3D…',terrainHint:'Faites glisser pour tourner · faites défiler pour zoomer · le relief réel apparaît en vous rapprochant',routeMethodTitle:'Méthodologie de l’itinéraire',routeMethodText:'Cet itinéraire éditorialisé utilise des données publiables et des preuves sourcées lorsque disponibles. Horaires, prix et règles personnelles variables restent ouverts jusqu’à connaître les dates et le contexte.',evidenceCoverage:'Couverture des sources',editorialStatus:'Statut éditorial',storyRoute:'Récit de l’itinéraire',routeFit:'Route Fit',showFit:'Plus de filtres adaptés',hideFit:'Masquer les filtres',fitPace:'Rythme',fitSeason:'Saison',fitParty:'Avec qui',fitStart:'Départ de l’itinéraire',facet_relaxed:'Détendu',facet_balanced:'Équilibré',facet_active:'Actif',facet_spring:'Printemps',facet_summer:'Été',facet_autumn:'Automne',facet_winter:'Hiver',facet_multi_season:'Plusieurs saisons',facet_solo:'Solo',facet_couples:'Couple',facet_friends:'Amis',facet_families:'Famille',resultOne:'itinéraire trouvé',countryUnit:'pays',countriesUnit:'pays',facet_city:'Ville',facet_cruise_port:'Port de croisière',facet_port:'Port',facet_rail_station:'Gare',facet_airport:'Aéroport',facet_island:'Île',facet_park:'Parc',status_planned:'Planifié',status_sourced_beta:'Bêta sourcée',status_illustrative_template:'Modèle illustratif',status_draft:'Brouillon'},
    pt:{routes:'Rotas',traveller:'Viajante',flagship:'Flagship',template:'Modelo',open:'Abrir rota',days:'dias',stops:'paradas',segments:'trechos',global:'Perspectiva global',contextTitle:'Contexto do viajante',contextLead:'Adapta entrada, idioma, moeda e origem. Guardado apenas neste dispositivo.',passports:'País do passaporte',secondPassport:'Segundo passaporte (opcional)',residence:'Residência',language:'Idioma',currency:'Moeda',origin:'Cidade / aeroporto de partida',adults:'Adultos',children:'Crianças',mobility:'Mobilidade reduzida',save:'Salvar',clear:'Limpar',close:'Fechar',notSet:'Não definido',currentCheck:'Verificação atual necessária',routeLibrary:'Explorar rotas',routeLibraryLead:'Uma plataforma para voltas ao mundo, road trips, trem, cruzeiros e mais.',editorial:'Modelo editorial — verifique transporte, preços e entrada para suas datas.',overview:'Visão geral',day:'Dia',nights:'noites',transport:'Transporte',verification:'Verificação',backWorld:'Rota mundial',private:'Privado neste dispositivo. Nunca pedimos número de passaporte, referência de reserva ou pagamento.',sourcedBeta:'Beta com fontes',sources:'Fontes',lastChecked:'Última verificação',publishedFrom:'a partir de',verified:'Verificado',routeEvidence:'Fontes da rota',entryGuidance:'Entrada',officialCheck:'Verificação oficial',connectionRequired:'conexão necessária',minimumTravel:'tempo mínimo',cruiseTemplate:'Modelo de cruzeiro',onboardNights:'noites a bordo',seaDays:'dias no mar',portCall:'Escala',embarkation:'Embarque',disembarkation:'Desembarque',border:'Contexto de fronteira',schengenExit:'Saída de Schengen',schengenEntry:'Reentrada em Schengen',sailingNeeded:'Selecione uma partida real para navio, operadora, horários, cais e preço.',illustrative:'Ilustrativo',searchRoutes:'Pesquisar rotas',filterType:'Tipo de viagem',filterRegion:'Região',filterDuration:'Duração',all:'Todas',noRoutes:'Nenhuma rota corresponde aos filtros.',vehicleSection:'Contexto do veículo (opcional)',vehicleType:'Veículo',registrationCountry:'País de matrícula',fuelType:'Combustível / motorização',euroClass:'Classe Euro',rentalCrossBorder:'Aluguel autorizado para cruzar fronteiras',privateCar:'Carro particular',rentalCar:'Carro alugado',camper:'Motorhome',motorcycle:'Moto',otherVehicle:'Outro',petrol:'Gasolina',diesel:'Diesel',hybrid:'Híbrido',pluginHybrid:'Híbrido plug-in',electric:'Elétrico',hydrogen:'Hidrogênio',unknown:'Desconhecido',roadRules:'Contexto rodoviário',crossBorder:'Transfronteiriço',urbanAccess:'Verificar acesso urbano',vehicleNeeded:'O contexto do veículo é necessário para portagens, ZBE e acessos.',facet_world:'Volta ao mundo',facet_round_trip:'Roteiro circular',facet_road_trip:'Road trip',facet_cruise:'Cruzeiro',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Sul da Europa',facet_italy:'Itália',facet_mediterranean:'Mediterrâneo',facet_north_africa:'Norte da África',filterMode:'Transporte',filterTheme:'Tema',results:'rotas encontradas',resetFilters:'Redefinir',details:'Detalhes',start:'Início',finish:'Fim',previous:'Anterior',next:'Seguinte',type:'Tipo',country:'País',duration:'Duração',cost:'Custo',segment:'Trecho',stop:'Parada',currency:'Moeda',facet_rail:'Trem',facet_bus:'Ônibus',facet_car:'Carro',facet_ferry:'Balsa',facet_multimodal:'Multimodal',facet_road:'Estrada',facet_coach:'Ônibus rodoviário',facet_ground_transfer:'Transfer terrestre',story:'História',storyPlay:'Reproduzir história',storyExit:'Sair da história',storyComplete:'Rota concluída',chapter:'Capítulo',settings:'Definições',methodology:'Metodologia',share:'Partilhar',autoRotate:'Rotação automática',highDetail:'Globo de alta definição',terrain:'Terreno 3D real',showPoints:'Pontos de paragem',routeGlow:'Brilho da rota',arcThickness:'Espessura da rota',reducedMotion:'Movimento reduzido',terrainLoading:'A carregar terreno 3D…',terrainHint:'Arraste para rodar · desloque para ampliar · o relevo real aparece ao aproximar',routeMethodTitle:'Metodologia da rota',routeMethodText:'Esta rota curada usa dados publicáveis e evidência com fontes quando disponível. Horários, preços e regras pessoais variáveis permanecem em aberto até serem conhecidas as datas e o contexto.',evidenceCoverage:'Cobertura de fontes',editorialStatus:'Estado editorial',storyRoute:'História da rota',routeFit:'Route Fit',showFit:'Mais filtros de adequação',hideFit:'Ocultar filtros',fitPace:'Ritmo',fitSeason:'Estação',fitParty:'Com quem viaja',fitStart:'Início da rota',facet_relaxed:'Relaxado',facet_balanced:'Equilibrado',facet_active:'Ativo',facet_spring:'Primavera',facet_summer:'Verão',facet_autumn:'Outono',facet_winter:'Inverno',facet_multi_season:'Várias estações',facet_solo:'Solo',facet_couples:'Casal',facet_friends:'Amigos',facet_families:'Família',resultOne:'rota encontrada',countryUnit:'país',countriesUnit:'países',facet_city:'Cidade',facet_cruise_port:'Porto de cruzeiros',facet_port:'Porto',facet_rail_station:'Estação ferroviária',facet_airport:'Aeroporto',facet_island:'Ilha',facet_park:'Parque',status_planned:'Planeado',status_sourced_beta:'Beta com fontes',status_illustrative_template:'Modelo ilustrativo',status_draft:'Rascunho'}
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

  const LEGACY_SHORT={
    de:{'All route':'Gesamtroute','N. America':'N. Amerika','S. America':'S. Amerika','Pacific':'Pazifik','SE Asia':'SO-Asien','C. Asia':'Zentralasien','Levant':'Levante','W. Africa':'W. Afrika','E. Africa':'O. Afrika','Gulf':'Golf','Finish':'Ziel','This is the current operational corridor in the public master plan.':'Dies ist der aktuelle operative Korridor im öffentlichen Masterplan.'},
    it:{'All route':'Itinerario completo','N. America':'N. America','S. America':'S. America','Pacific':'Pacifico','SE Asia':'SE Asia','C. Asia':'Asia centrale','Levant':'Levante','W. Africa':'Africa occ.','E. Africa':'Africa or.','Gulf':'Golfo','Finish':'Arrivo','This is the current operational corridor in the public master plan.':'Questo è il corridoio operativo attuale nel piano pubblico principale.'},
    es:{'All route':'Ruta completa','N. America':'N. América','S. America':'S. América','Pacific':'Pacífico','SE Asia':'SE Asia','C. Asia':'Asia central','Levant':'Levante','W. Africa':'África occ.','E. Africa':'África or.','Gulf':'Golfo','Finish':'Final','This is the current operational corridor in the public master plan.':'Este es el corredor operativo actual del plan maestro público.'},
    fr:{'All route':'Itinéraire complet','N. America':'Amér. N.','S. America':'Amér. S.','Pacific':'Pacifique','SE Asia':'Asie SE','C. Asia':'Asie centrale','Levant':'Levant','W. Africa':'Afrique O.','E. Africa':'Afrique E.','Gulf':'Golfe','Finish':'Arrivée','This is the current operational corridor in the public master plan.':'Il s’agit du corridor opérationnel actuel dans le plan directeur public.'},
    pt:{'All route':'Rota completa','N. America':'Amér. N.','S. America':'Amér. S.','Pacific':'Pacífico','SE Asia':'SE Ásia','C. Asia':'Ásia central','Levant':'Levante','W. Africa':'África O.','E. Africa':'África E.','Gulf':'Golfo','Finish':'Fim','This is the current operational corridor in the public master plan.':'Este é o corredor operacional atual no plano mestre público.'}
  };


  function regionName(locale,code){
    if(!code)return '—';
    const normalized=String(code).toUpperCase();
    try{return new Intl.DisplayNames([locale],{type:'region'}).of(normalized)||normalized}
    catch{return normalized}
  }

  function plural(locale,count,forms){
    let category='other';
    try{category=new Intl.PluralRules(locale).select(Number(count))}
    catch{}
    return forms?.[category]??forms?.other??forms?.one??'';
  }

  root.i18n={
    supportedLocales:[...SUPPORTED_LOCALES],
    messages:I18N,
    legacyWorldText:LEGACY_WORLD_TEXT,
    legacyPhases:LEGACY_PHASES,
    legacyExtra:LEGACY_EXTRA,
    legacyShort:LEGACY_SHORT,
    regionName,
    plural
  };
})();


/* ===== platform/legacy-localization.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;
  let observer=null;
  let scheduled=false;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Legacy localization is not configured');
    return deps;
  }

  function translate(raw){
    const d=context(),locale=d.getLocale();
    const text=String(raw||'').trim();
    if(!text||locale==='en')return text;
    const localeData=root.i18n;
    if(!localeData)return text;
    const dict={
      ...(localeData.legacyWorldText?.[locale]||{}),
      ...(localeData.legacyExtra?.[locale]||{}),
      ...(localeData.legacyShort?.[locale]||{})
    };
    if(dict[text])return dict[text];
    const exactKey=Object.keys(dict).find(key=>key.toLocaleLowerCase('en')===text.toLocaleLowerCase('en'));
    if(exactKey)return dict[exactKey];
    if(localeData.legacyPhases?.[locale]?.[text])return localeData.legacyPhases[locale][text];

    let match=text.match(/^(\d{2})\s+(.+)$/);
    if(match&&localeData.legacyPhases?.[locale]?.[match[2]])return `${match[1]} ${localeData.legacyPhases[locale][match[2]]}`;
    match=text.match(/^CHAPTER\s+(\d+)\s*\/\s*(\d+)$/i);
    if(match){
      const chapterLabel={de:'KAPITEL',it:'CAPITOLO',es:'CAPÍTULO',fr:'CHAPITRE',pt:'CAPÍTULO'}[locale]||'CHAPTER';
      return `${chapterLabel} ${match[1]} / ${match[2]}`;
    }
    match=text.match(/^Country\s+(\d+)\s*\/\s*195$/i);
    if(match)return `${d.t('country')} ${match[1]}/195`;
    match=text.match(/^Country\s+(\d+)\s*·\s*(.+)$/i);
    if(match)return `${d.t('country')} ${match[1]} · ${translate(match[2])}`;
    match=text.match(/^Day\s+(\d+)$/i);
    if(match)return `${d.t('day')} ${match[1]}`;
    match=text.match(/^Segment\s+(\d+)\s*·\s*Day\s+([^·]+)\s*·\s*(.+)$/i);
    if(match)return `${d.t('segment')} ${match[1]} · ${d.t('day')} ${match[2].trim()} · ${match[3]}`;
    match=text.match(/^Segment\s+(\d+)\s*\/\s*(\d+)$/i);
    if(match)return `${d.t('segment')} ${match[1]} / ${match[2]}`;
    return text;
  }

  function localizeNode(nodeRoot=document){
    const d=context(),locale=d.getLocale();
    if(locale==='en'||document.body.classList.contains('platform-regional-trip'))return;
    const walker=document.createTreeWalker(nodeRoot,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const raw=node.nodeValue,trimmed=String(raw||'').trim();
      if(!trimmed)continue;
      const translated=translate(trimmed);
      if(translated!==trimmed)node.nodeValue=raw.replace(trimmed,translated);
    }
    for(const el of nodeRoot.querySelectorAll?.('[placeholder],[title],[aria-label]')||[]){
      for(const attr of ['placeholder','title','aria-label']){
        const raw=el.getAttribute(attr);
        if(!raw)continue;
        const translated=translate(raw);
        if(translated!==raw)el.setAttribute(attr,translated);
      }
    }
  }

  function activate(){
    const d=context();
    document.documentElement.lang=d.getLocale();
    localizeNode(document.body);
    if(observer)observer.disconnect();
    observer=new MutationObserver(mutations=>{
      if(scheduled||document.body.classList.contains('platform-regional-trip'))return;
      scheduled=true;
      requestAnimationFrame(()=>{
        scheduled=false;
        for(const mutation of mutations){
          for(const node of mutation.addedNodes){
            if(node.nodeType===Node.ELEMENT_NODE)localizeNode(node);
            else if(node.nodeType===Node.TEXT_NODE&&node.parentElement)localizeNode(node.parentElement);
          }
          if(mutation.type==='characterData'&&mutation.target.parentElement)localizeNode(mutation.target.parentElement);
        }
      });
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  }

  const api={configure,translate,localizeNode,activate};
  root.legacyLocalization=api;
})();


/* ===== platform/model.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  function placeMap(trip){return new Map((trip?.places||[]).map(p=>[p.id,p]))}
  function stopMap(trip){return new Map((trip?.stops||[]).map(s=>[s.id,s]))}
  function stopPlace(trip,stop){return placeMap(trip).get(stop?.placeId)||null}
  function sourceMap(trip){return new Map((trip?.sources||[]).map(s=>[s.id,s]))}
  function extension(node,id){
    if(!node)return null;
    if(node.extensions&&Object.prototype.hasOwnProperty.call(node.extensions,id))return node.extensions[id];
    const legacy={
      cruise:'cruise',
      roadTrip:'roadTrip',
      road:'roadContext',
      border:'borderContext',
      cruiseCall:'call',
      port:'port'
    };
    const key=legacy[id];
    return key&&Object.prototype.hasOwnProperty.call(node,key)?node[key]:null;
  }
  function routeGeometry(trip){
    const sm=stopMap(trip),pm=placeMap(trip);
    return (trip?.segments||[]).map((segment,index)=>{
      const from=pm.get(sm.get(segment.fromStopId)?.placeId);
      const to=pm.get(sm.get(segment.toStopId)?.placeId);
      if(!from?.coordinates||!to?.coordinates)return null;
      return {...segment,_index:index,start:from.coordinates,end:to.coordinates};
    }).filter(Boolean);
  }
  function routeBounds(trip){
    const points=(trip?.places||[]).map(p=>p.coordinates).filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng)));
    if(!points.length)return null;
    const lngs=points.map(p=>Number(p.lng)),lats=points.map(p=>Number(p.lat));
    return [[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]];
  }
  function chapterForSegment(trip,index){
    const segment=trip?.segments?.[index];
    if(!segment)return null;
    return (trip.chapters||[]).find(ch=>(ch.stopIds||[]).includes(segment.fromStopId)||(ch.stopIds||[]).includes(segment.toStopId))||null;
  }
  function hasCapability(meta,id){return Array.isArray(meta?.capabilities)&&meta.capabilities.includes(id)}
  function metrics(trip){
    return {
      days:trip?.planning?.days??null,
      stops:trip?.stops?.length||0,
      segments:trip?.segments?.length||0,
      countries:new Set((trip?.places||[]).map(p=>p.countryCode).filter(Boolean)).size
    };
  }
  root.model={placeMap,stopMap,stopPlace,sourceMap,extension,routeGeometry,routeBounds,chapterForSegment,hasCapability,metrics};
})();


/* ===== platform/traveller.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const ALLOWED=['passports','residenceCountry','language','currency','origin','party','accessibility','vehicle'];
  function defaults(locale='en'){
    return {passports:[],residenceCountry:null,language:locale,currency:'EUR',origin:null,party:{adults:1,children:0},accessibility:{reducedMobility:false},vehicle:null};
  }
  function normalize(input,locale='en'){
    const base=defaults(locale),raw=input&&typeof input==='object'?input:{},safe={};
    for(const key of ALLOWED)if(Object.prototype.hasOwnProperty.call(raw,key))safe[key]=raw[key];
    return {
      ...base,
      ...safe,
      passports:Array.isArray(safe.passports)?safe.passports.filter(v=>typeof v==='string').slice(0,2):base.passports,
      party:{...base.party,...(safe.party&&typeof safe.party==='object'?safe.party:{})},
      accessibility:{...base.accessibility,...(safe.accessibility&&typeof safe.accessibility==='object'?safe.accessibility:{})},
      vehicle:safe.vehicle&&typeof safe.vehicle==='object'?{...safe.vehicle}:null
    };
  }
  function load(storage,key,locale='en'){
    try{return normalize(JSON.parse(storage.getItem(key)||'{}'),locale)}catch{return defaults(locale)}
  }
  function save(storage,key,profile,locale='en'){
    const normalized=normalize(profile,locale);
    storage.setItem(key,JSON.stringify(normalized));
    return normalized;
  }
  function clear(storage,key,locale='en'){storage.removeItem(key);return defaults(locale)}
  root.traveller={defaults,normalize,load,save,clear,allowedKeys:[...ALLOWED]};
})();


/* ===== platform/traveller-ui.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let countries=[];

  async function loadCountries(){
    if(countries.length)return countries;
    try{
      countries=await fetch('./data/country-centroids.json',{cache:'force-cache'}).then(r=>r.ok?r.json():Promise.reject(new Error('Country data '+r.status)));
    }catch{
      countries=[];
    }
    return countries;
  }

  async function open(deps){
    const {
      locale,
      supportedLocales,
      loadProfile,
      ensureDialog,
      t,
      esc,
      onSave,
      onClear
    }=deps;
    const $=(s,r=document)=>r.querySelector(s);
    const countryData=await loadCountries();
    const profile=loadProfile();
    const modal=ensureDialog('platformTravellerModal');
    const display=(()=>{try{return new Intl.DisplayNames([locale],{type:'region'})}catch{return null}})();
    const options=[...countryData]
      .filter(c=>c.cca2)
      .map(c=>({code:c.cca2,name:display?.of(c.cca2)||c.name}))
      .sort((a,b)=>a.name.localeCompare(b.name,locale));
    const countryOptions=(selected,blank=true)=>`${blank?`<option value="">${esc(t('notSet'))}</option>`:''}${options.map(o=>`<option value="${esc(o.code)}" ${selected===o.code?'selected':''}>${esc(o.name)}</option>`).join('')}`;
    const currencies=typeof Intl.supportedValuesOf==='function'
      ?Intl.supportedValuesOf('currency')
      :['EUR','USD','GBP','CHF','JPY','CAD','AUD','NZD','CNY','INR','BRL','MXN','ZAR','SGD'];

    modal.innerHTML=`<form id="platformTravellerForm" class="platform-modal-card traveller-card glass"><button class="platform-x" type="button" aria-label="${esc(t('close'))}">×</button><div class="platform-eyebrow">${esc(t('global'))}</div><h2>${esc(t('contextTitle'))}</h2><p class="platform-lead">${esc(t('contextLead'))}</p><div class="traveller-grid"><label>${esc(t('passports'))}<select name="passport">${countryOptions(profile.passports?.[0]||null)}</select></label><label>${esc(t('secondPassport'))}<select name="passport2">${countryOptions(profile.passports?.[1]||null)}</select></label><label>${esc(t('residence'))}<select name="residence">${countryOptions(profile.residenceCountry)}</select></label><label>${esc(t('language'))}<select name="language">${supportedLocales.map(l=>`<option value="${esc(l)}" ${profile.language===l?'selected':''}>${esc(l.toUpperCase())}</option>`).join('')}</select></label><label>${esc(t('currency'))}<select name="currency">${currencies.map(c=>`<option value="${esc(c)}" ${profile.currency===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label class="span-2">${esc(t('origin'))}<input name="origin" value="${esc(profile.origin||'')}" autocomplete="off" placeholder="e.g. Toronto / YYZ"></label><label>${esc(t('adults'))}<input name="adults" type="number" min="1" max="20" value="${Number(profile.party?.adults||1)}"></label><label>${esc(t('children'))}<input name="children" type="number" min="0" max="20" value="${Number(profile.party?.children||0)}"></label><label class="check span-2"><input name="mobility" type="checkbox" ${profile.accessibility?.reducedMobility?'checked':''}><span>${esc(t('mobility'))}</span></label><div class="traveller-subhead span-2">${esc(t('vehicleSection'))}</div><label>${esc(t('vehicleType'))}<select name="vehicleType"><option value="">${esc(t('notSet'))}</option><option value="private-car" ${profile.vehicle?.type==='private-car'?'selected':''}>${esc(t('privateCar'))}</option><option value="rental-car" ${profile.vehicle?.type==='rental-car'?'selected':''}>${esc(t('rentalCar'))}</option><option value="camper" ${profile.vehicle?.type==='camper'?'selected':''}>${esc(t('camper'))}</option><option value="motorcycle" ${profile.vehicle?.type==='motorcycle'?'selected':''}>${esc(t('motorcycle'))}</option><option value="other" ${profile.vehicle?.type==='other'?'selected':''}>${esc(t('otherVehicle'))}</option></select></label><label>${esc(t('registrationCountry'))}<select name="vehicleRegistration">${countryOptions(profile.vehicle?.registrationCountry||null)}</select></label><label>${esc(t('fuelType'))}<select name="vehicleFuel"><option value="unknown">${esc(t('unknown'))}</option><option value="petrol" ${profile.vehicle?.fuelType==='petrol'?'selected':''}>${esc(t('petrol'))}</option><option value="diesel" ${profile.vehicle?.fuelType==='diesel'?'selected':''}>${esc(t('diesel'))}</option><option value="hybrid" ${profile.vehicle?.fuelType==='hybrid'?'selected':''}>${esc(t('hybrid'))}</option><option value="plug-in-hybrid" ${profile.vehicle?.fuelType==='plug-in-hybrid'?'selected':''}>${esc(t('pluginHybrid'))}</option><option value="electric" ${profile.vehicle?.fuelType==='electric'?'selected':''}>${esc(t('electric'))}</option><option value="hydrogen" ${profile.vehicle?.fuelType==='hydrogen'?'selected':''}>${esc(t('hydrogen'))}</option><option value="other" ${profile.vehicle?.fuelType==='other'?'selected':''}>${esc(t('otherVehicle'))}</option></select></label><label>${esc(t('euroClass'))}<select name="vehicleEuro"><option value="unknown">${esc(t('unknown'))}</option>${['Euro 1','Euro 2','Euro 3','Euro 4','Euro 5','Euro 6'].map(v=>`<option value="${esc(v)}" ${profile.vehicle?.euroClass===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label class="check span-2"><input name="rentalCrossBorder" type="checkbox" ${profile.vehicle?.rentalCrossBorderApproved===true?'checked':''}><span>${esc(t('rentalCrossBorder'))}</span></label></div><p class="platform-privacy">${esc(t('private'))}</p><div class="platform-form-actions"><button class="ghost" type="button" id="platformClearTraveller">${esc(t('clear'))}</button><button class="primary" type="submit">${esc(t('save'))}</button></div></form>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    $('#platformClearTraveller',modal).onclick=()=>{
      modal.classList.add('hidden');
      onClear();
    };
    $('#platformTravellerForm',modal).onsubmit=e=>{
      e.preventDefault();
      const f=new FormData(e.currentTarget);
      const passports=[f.get('passport'),f.get('passport2')]
        .filter(Boolean)
        .map(String)
        .filter((v,i,a)=>a.indexOf(v)===i);
      const vehicleType=String(f.get('vehicleType')||'');
      const vehicle=vehicleType?{
        type:vehicleType,
        registrationCountry:f.get('vehicleRegistration')||null,
        fuelType:String(f.get('vehicleFuel')||'unknown'),
        euroClass:String(f.get('vehicleEuro')||'unknown'),
        rentalCrossBorderApproved:vehicleType==='rental-car'?(f.get('rentalCrossBorder')==='on'):null
      }:null;
      const next={
        passports,
        residenceCountry:f.get('residence')||null,
        language:String(f.get('language')||'en'),
        currency:String(f.get('currency')||'EUR'),
        origin:String(f.get('origin')||'').trim()||null,
        party:{adults:Number(f.get('adults')||1),children:Number(f.get('children')||0)},
        accessibility:{reducedMobility:f.get('mobility')==='on'},
        vehicle
      };
      modal.classList.add('hidden');
      onSave(next);
    };
    return modal;
  }

  root.travellerUi={open};
})();


/* ===== platform/ui.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const $=(s,r=document)=>r.querySelector(s);

  function ensureDialog(id,cls='platform-modal'){
    let modal=$('#'+id);
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id=id;
    modal.className=`${cls} hidden`;
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});
    document.body.appendChild(modal);
    return modal;
  }

  function ensureGlobalActions({t,esc,onRoutes,onTraveller}){
    const top=$('.topbar');
    if(!top||$('#platformRouteBtn'))return;
    const actions=$('.top-actions',top);
    const wrap=document.createElement('div');
    wrap.className='platform-actions';
    wrap.innerHTML=`<button id="platformRouteBtn" class="platform-pill" type="button" aria-label="${esc(t('routes'))}" title="${esc(t('routes'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg></span><span class="platform-pill-label">${esc(t('routes'))}</span></button><button id="platformTravellerBtn" class="platform-pill secondary" type="button" aria-label="${esc(t('traveller'))}" title="${esc(t('traveller'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-4.2 3-6.3 6.5-6.3s5.7 2.1 6.5 6.3"/></svg></span><span class="platform-pill-label">${esc(t('traveller'))}</span></button>`;
    top.insertBefore(wrap,actions||null);
    $('#platformRouteBtn').onclick=onRoutes;
    $('#platformTravellerBtn').onclick=onTraveller;
  }

  function toast(message){
    const node=$('#toast');
    if(!node)return;
    node.textContent=message;
    node.classList.add('show');
    clearTimeout(node._platformTimer);
    node._platformTimer=setTimeout(()=>node.classList.remove('show'),2600);
  }

  function regionalSettings(){
    return {
      autoRotate:$('#autoRotate')?.checked===true,
      showPoints:$('#showPoints')?.checked!==false,
      routeGlow:$('#routeGlow')?.checked!==false,
      arcWidth:Number($('#arcWidth')?.value||.55),
      reducedMotion:$('#reducedMotion')?.checked===true
    };
  }

  root.ui={ensureDialog,ensureGlobalActions,toast,regionalSettings};
})();


/* ===== platform/navigation.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  function buildTripUrl({id,defaultTripId='world-195',search=''}) {
    const params=new URLSearchParams(search);
    if(id===defaultTripId)params.delete('trip');
    else params.set('trip',id);
    for(const key of ['segment','country','phase','view'])params.delete(key);
    return `/${params.toString()?`?${params}`:''}`;
  }

  function regionalUrl({tripId,locale,search='',pathname='/',terrainActive=false}) {
    const existing=new URLSearchParams(search);
    const params=new URLSearchParams();
    params.set('trip',tripId);
    params.set('lang',locale);
    if(existing.get('view')==='terrain'||terrainActive)params.set('view','terrain');
    return `${pathname}?${params.toString()}`;
  }

  root.navigation={buildTripUrl,regionalUrl};
})();


/* ===== platform/discovery.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const unique=values=>[...new Set(values.filter(Boolean))].sort();
  function facets(catalog){
    const trips=catalog?.trips||[];
    return {
      kinds:unique(trips.map(r=>r.kind)),
      regions:unique(trips.flatMap(r=>r.discovery?.regions||[])),
      modes:unique(trips.flatMap(r=>r.discovery?.modes||[])),
      themes:unique(trips.flatMap(r=>r.discovery?.themes||[])),
      paces:unique(trips.map(r=>r.discovery?.fit?.pace)),
      seasons:unique(trips.flatMap(r=>r.discovery?.fit?.seasons||[])),
      parties:unique(trips.flatMap(r=>r.discovery?.fit?.party||[])),
      starts:unique(trips.map(r=>r.discovery?.fit?.startRegion))
    };
  }
  function matches(trip,filters={},searchText=''){
    const d=trip?.discovery||{},fit=d.fit||{},q=String(filters.q||'').trim().toLowerCase();
    return (!q||String(searchText).toLowerCase().includes(q))
      &&(!filters.kind||trip.kind===filters.kind)
      &&(!filters.region||(d.regions||[]).includes(filters.region))
      &&(!filters.duration||d.durationBand===filters.duration)
      &&(!filters.mode||(d.modes||[]).includes(filters.mode))
      &&(!filters.theme||(d.themes||[]).includes(filters.theme))
      &&(!filters.pace||fit.pace===filters.pace)
      &&(!filters.season||(fit.seasons||[]).includes(filters.season))
      &&(!filters.party||(fit.party||[]).includes(filters.party))
      &&(!filters.start||fit.startRegion===filters.start);
  }
  function filter(catalog,filters={},searchTextFor=()=> ''){
    return (catalog?.trips||[]).filter(trip=>matches(trip,filters,searchTextFor(trip)));
  }
  root.discovery={facets,matches,filter};
})();


/* ===== platform/route-library.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  function open(deps){
    const {catalog,currentTripMeta,Discovery,ensureDialog,t,local,esc,facetLabel,statusLabel,pluralLabel,onOpenTrip}=deps;
    const $=(s,r=document)=>r.querySelector(s);
    const modal=ensureDialog('platformRouteModal');
    const {kinds,regions,modes,themes,paces,seasons,parties,starts}=Discovery.facets(catalog);
    const card=r=>{
      const metrics=[];
      if(r.metrics?.days)metrics.push(`${r.metrics.days} ${t('days')}`);
      if(r.metrics?.stops)metrics.push(`${r.metrics.stops} ${t('stops')}`);
      if(r.metrics?.countries)metrics.push(`${r.metrics.countries} ${pluralLabel(r.metrics.countries,'countryUnit','countriesUnit')}`);
      if(r.metrics?.nights)metrics.push(`${r.metrics.nights} ${t('onboardNights')}`);
      if(r.metrics?.seaDays)metrics.push(`${r.metrics.seaDays} ${t('seaDays')}`);
      return `<article class="platform-route-card ${r.id===currentTripMeta?.id?'active':''}"><div class="platform-route-top"><span>${esc(facetLabel(r.kind))}</span><b>${esc(statusLabel(r))}</b></div><h3>${esc(local(r.title))}</h3><p>${esc(local(r.subtitle))}</p><div class="platform-route-metrics">${metrics.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button type="button" data-platform-trip="${esc(r.id)}">${esc(t('open'))} →</button></article>`;
    };

    modal.innerHTML=`<div class="platform-modal-card route-library-card glass"><button class="platform-x" aria-label="Close">×</button><div class="platform-eyebrow">ONE WORLD ROUTE</div><h2>${esc(t('routeLibrary'))}</h2><p class="platform-lead">${esc(t('routeLibraryLead'))}</p><div class="platform-route-filters"><label class="route-search"><span>${esc(t('searchRoutes'))}</span><input id="platformRouteSearch" type="search" autocomplete="off" placeholder="${esc(t('searchRoutes'))}"></label><label><span>${esc(t('filterType'))}</span><select id="platformRouteKind"><option value="">${esc(t('all'))}</option>${kinds.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterRegion'))}</span><select id="platformRouteRegion"><option value="">${esc(t('all'))}</option>${regions.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterDuration'))}</span><select id="platformRouteDuration"><option value="">${esc(t('all'))}</option><option value="7-14">7–14 ${esc(t('days'))}</option><option value="15-30">15–30 ${esc(t('days'))}</option><option value="31-89">31–89 ${esc(t('days'))}</option><option value="90-plus">90+ ${esc(t('days'))}</option></select></label><label><span>${esc(t('filterMode'))}</span><select id="platformRouteMode"><option value="">${esc(t('all'))}</option>${modes.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterTheme'))}</span><select id="platformRouteTheme"><option value="">${esc(t('all'))}</option>${themes.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label></div><div class="platform-fit-head"><button id="platformFitToggle" type="button" aria-expanded="false">${esc(t('showFit'))}</button></div><div id="platformFitFilters" class="platform-fit-filters hidden"><div class="platform-fit-title">${esc(t('routeFit'))}</div><label><span>${esc(t('fitPace'))}</span><select id="platformRoutePace"><option value="">${esc(t('all'))}</option>${paces.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitSeason'))}</span><select id="platformRouteSeason"><option value="">${esc(t('all'))}</option>${seasons.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitParty'))}</span><select id="platformRouteParty"><option value="">${esc(t('all'))}</option>${parties.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitStart'))}</span><select id="platformRouteStart"><option value="">${esc(t('all'))}</option>${starts.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label></div><div class="platform-route-resultbar"><span id="platformRouteCount"></span><button id="platformRouteReset" type="button">${esc(t('resetFilters'))}</button></div><div id="platformRouteResults" class="platform-route-grid"></div></div>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');

    const render=()=>{
      const filters={
        q:String($('#platformRouteSearch',modal)?.value||'').trim().toLowerCase(),
        kind:$('#platformRouteKind',modal)?.value||'',
        region:$('#platformRouteRegion',modal)?.value||'',
        duration:$('#platformRouteDuration',modal)?.value||'',
        mode:$('#platformRouteMode',modal)?.value||'',
        theme:$('#platformRouteTheme',modal)?.value||'',
        pace:$('#platformRoutePace',modal)?.value||'',
        season:$('#platformRouteSeason',modal)?.value||'',
        party:$('#platformRouteParty',modal)?.value||'',
        start:$('#platformRouteStart',modal)?.value||''
      };
      const filtered=Discovery.filter(catalog,filters,r=>[local(r.title),local(r.subtitle),r.kind,...(r.discovery?.regions||[]),...(r.discovery?.themes||[]),...(r.discovery?.modes||[])].join(' '));
      const host=$('#platformRouteResults',modal);
      host.innerHTML=filtered.length?filtered.map(card).join(''):`<div class="platform-no-routes">${esc(t('noRoutes'))}</div>`;
      const count=$('#platformRouteCount',modal);if(count)count.textContent=`${filtered.length} ${pluralLabel(filtered.length,'resultOne','results')}`;
    };

    $('#platformFitToggle',modal)?.addEventListener('click',e=>{
      const filters=$('#platformFitFilters',modal),button=e.currentTarget,opening=filters?.classList.contains('hidden');
      filters?.classList.toggle('hidden',!opening);
      button.setAttribute('aria-expanded',String(Boolean(opening)));
      button.textContent=t(opening?'hideFit':'showFit');
    });
    const results=$('#platformRouteResults',modal);
    results.addEventListener('click',e=>{
      const button=e.target.closest('[data-platform-trip]');
      if(!button||!results.contains(button))return;
      e.preventDefault();
      onOpenTrip(button.dataset.platformTrip);
    });
    ['platformRouteSearch','platformRouteKind','platformRouteRegion','platformRouteDuration','platformRouteMode','platformRouteTheme','platformRoutePace','platformRouteSeason','platformRouteParty','platformRouteStart'].forEach(id=>$('#'+id,modal)?.addEventListener(id==='platformRouteSearch'?'input':'change',render));
    $('#platformRouteReset',modal)?.addEventListener('click',()=>{
      const search=$('#platformRouteSearch',modal);if(search)search.value='';
      ['platformRouteKind','platformRouteRegion','platformRouteDuration','platformRouteMode','platformRouteTheme','platformRoutePace','platformRouteSeason','platformRouteParty','platformRouteStart'].forEach(id=>{const el=$('#'+id,modal);if(el)el.value=''});
      render();
    });
    render();
    return modal;
  }

  root.routeLibrary={open};
})();


/* ===== platform/regional-shell.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional shell is not configured');
    return deps;
  }

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function stopButton(stop,index){
    const d=context(),trip=d.getTrip(),place=d.stopPlace(trip,stop);
    return `<button type="button" data-stop-index="${index}" class="platform-stop ${index===0?'active':''}"><span>${String(stop.sequence).padStart(2,'0')}</span><div><b>${d.esc(d.local(place?.name))}</b><small>${d.esc(d.t('day'))} ${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''} · ${stop.nights||0} ${d.esc(d.t('nights'))}</small></div></button>`;
  }

  function buildLeftNavigation(){
    const d=context(),trip=d.getTrip();
    const panel=$('#leftPanel');
    if(!panel)return;
    panel.scrollTop=0;
    $('.platform-regional-nav',panel)?.remove();
    const nav=document.createElement('div');
    nav.className='platform-regional-nav';
    nav.innerHTML=`<div class="section-title"><span>${d.esc(d.t('stops'))}</span><span class="pill">${trip.stops.length}</span></div><div class="platform-stop-list">${trip.stops.map((stop,index)=>stopButton(stop,index)).join('')}</div>`;
    panel.appendChild(nav);
    $$('[data-stop-index]',nav).forEach(button=>{
      button.onclick=()=>d.selectStop(Number(button.dataset.stopIndex),true);
    });
  }

  function buildChapterRail(){
    const d=context(),trip=d.getTrip();
    const rail=$('#phaseRail');
    if(!rail)return;
    const chapters=trip.chapters||[];
    rail.classList.toggle('platform-empty-rail',chapters.length===0);
    rail.innerHTML=chapters.map((chapter,index)=>`<button type="button" data-trip-chapter="${index}" class="${index===0?'active':''}"><span class="phase-dot"></span>${d.esc(d.local(chapter.title))}</button>`).join('');
    $$('[data-trip-chapter]',rail).forEach(button=>{
      button.onclick=()=>{
        $$('[data-trip-chapter]',rail).forEach(item=>item.classList.toggle('active',item===button));
        const chapter=trip.chapters[Number(button.dataset.tripChapter)];
        const index=trip.stops.findIndex(stop=>stop.id===chapter.stopIds?.[0]);
        if(index>=0)d.selectStop(index,true);
      };
    });
  }

  function apply(){
    const d=context(),trip=d.getTrip();
    d.isolateRegionalRuntime();
    d.syncRegionalUrl();
    document.documentElement.lang=d.getLocale();
    document.title=`${d.local(trip.title)} — ONE WORLD ROUTE`;
    const meta=$('meta[name="description"]');
    if(meta)meta.content=d.local(trip.summary);
    const brandSmall=$('.brand small');
    if(brandSmall)brandSmall.textContent=d.local(trip.title);
    const hero=$('.hero-copy');
    if(hero){
      hero.innerHTML=`<div class="eyebrow"><span class="live-dot"></span>${d.esc(d.facetLabel(trip.kind))} · ${trip.planning?.days||''} ${d.esc(d.t('days'))}</div><h1>${d.esc(d.local(trip.title))}</h1><p>${d.esc(d.local(trip.summary))}</p><div class="platform-template-note">${d.esc(d.t('editorial'))}</div>`;
    }
    const kpis=$('#topKpis');
    if(kpis)kpis.innerHTML=`<div class="kpi"><b>${trip.planning?.days||'—'}</b><span>${d.esc(d.t('days'))}</span></div><div class="kpi"><b>${trip.stops?.length||0}</b><span>${d.esc(d.t('stops'))}</span></div><div class="kpi"><b>${trip.segments?.length||0}</b><span>${d.esc(d.t('segments'))}</span></div>`;
    const mobileFilters=$('#mobileFilters');
    if(mobileFilters)mobileFilters.textContent=d.t('stops');
    const mobileDetails=$('#mobileDetails');
    if(mobileDetails)mobileDetails.textContent=d.t('details');

    buildLeftNavigation();
    buildChapterRail();
    d.replaceTimeline();
    d.ensureStoryUi();
    d.configureRegionalSettings();
    d.renderTripOverview();
  }

  const api={configure,apply,buildLeftNavigation,buildChapterRail};
  root.regionalShell=api;
})();


/* ===== platform/regional-detail.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional detail renderer is not configured');
    return deps;
  }

  const $=(s,r=document)=>r.querySelector(s);

  function setMode(mode){
    for(const key of ['overview','stop','segment'])document.body.classList.toggle('platform-detail-'+key,key===mode);
    const panel=$('#rightPanel');
    if(panel)panel.scrollTop=0;
  }

  function renderTripOverview(){
    const d=context(),trip=d.getTrip();
    setMode('overview');
    const title=$('#detailTitle');
    if(title)title.textContent=d.local(trip.title);
    const eye=$('#detailEyebrow');
    if(eye)eye.textContent=d.t('overview');
    const tabs=$('#detailTabs');
    if(tabs)tabs.style.display='none';
    const content=$('#detailContent');
    if(!content)return;
    content.scrollTop=0;

    const sourced=trip.segments.filter(segment=>(segment.verification?.sourceIds||[]).length).length;
    const verified=trip.segments.filter(segment=>segment.verification?.status==='verified').length;
    const entry=trip.entryGuidance;
    const entrySource=entry?d.sourceMap().get(entry.officialResolverSourceId):null;
    const profile=d.loadProfile();
    const extension=d.extensions.composeTripOverview({trip,profile,t:d.t,esc:d.esc,local:d.local});

    content.innerHTML=`<div class="overview-number platform-duration-number">${trip.planning?.days||'—'}<small>${d.esc(d.t('days'))}</small></div><p class="detail-copy">${d.esc(d.local(trip.summary))}</p><div class="data-grid"><div class="data-card"><span>${d.esc(d.t('stops'))}</span><b>${trip.stops.length}</b></div>${extension.cards}<div class="data-card"><span>${d.esc(d.t('routeEvidence'))}</span><b>${sourced}/${trip.segments.length}</b></div><div class="data-card"><span>${d.esc(d.t('verified'))}</span><b>${verified}/${trip.segments.length}</b></div><div class="data-card"><span>${d.esc(d.t('currency'))}</span><b>${d.esc(trip.planning?.currency||'—')}</b></div></div>${extension.notices}${entry?`<div class="platform-entry"><b>${d.esc(d.t('entryGuidance'))}</b><p>${d.esc(d.local(entry.message))}</p>${entrySource?`<a href="${d.esc(entrySource.url)}" target="_blank" rel="noopener noreferrer">${d.esc(d.t('officialCheck'))} →</a>`:''}</div>`:''}<button class="platform-context-inline" id="regionalTravellerBtn" type="button">${d.esc(d.t('traveller'))} →</button>`;
    $('#regionalTravellerBtn')?.addEventListener('click',d.openTraveller);
  }

  function renderStopDetail(stop,place){
    const d=context(),trip=d.getTrip();
    setMode('stop');
    const title=$('#detailTitle');
    if(title)title.textContent=d.local(place.name);
    const eye=$('#detailEyebrow');
    if(eye)eye.textContent=`${d.t('stop').toUpperCase()} ${stop.sequence} · ${d.facetLabel(place.type)}`;
    const content=$('#detailContent');
    if(!content)return;
    content.scrollTop=0;

    const extension=d.extensions.composeStopDetail({trip,stop,place,profile:d.loadProfile(),t:d.t,esc:d.esc,local:d.local});
    const notices=extension.notices||`<p class="detail-copy">${d.esc(d.t('editorial'))}</p>`;
    content.innerHTML=`<div class="overview-number">${stop.sequence}<small> / ${trip.stops.length}</small></div><div class="data-grid"><div class="data-card"><span>${d.esc(d.t('day'))}</span><b>${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''}</b></div>${extension.cards}<div class="data-card"><span>${d.esc(d.t('type'))}</span><b>${d.esc(d.facetLabel(place.type))}</b></div><div class="data-card"><span>${d.esc(d.t('country'))}</span><b>${d.esc(d.countryDisplay(place.countryCode))}</b></div></div>${notices}${extension.sourceIds.length?`<div class="platform-evidence"><div class="ops-mini-title">${d.esc(d.t('sources'))}</div>${d.sourceLinks(extension.sourceIds)}</div>`:''}`;
  }

  function renderSegmentDetail(segment){
    const d=context(),trip=d.getTrip();
    setMode('segment');
    const stopMap=d.stopMap(trip),placeMap=d.placeMap(trip);
    const from=placeMap.get(stopMap.get(segment.fromStopId)?.placeId);
    const to=placeMap.get(stopMap.get(segment.toStopId)?.placeId);

    const title=$('#detailTitle');
    if(title)title.textContent=`${d.local(from?.name)} → ${d.local(to?.name)}`;
    const eye=$('#detailEyebrow');
    if(eye)eye.textContent=`${d.t('segment').toUpperCase()} ${segment.sequence} / ${trip.segments.length}`;
    const content=$('#detailContent');
    if(!content)return;
    content.scrollTop=0;

    const stages=(segment.transport?.stages||[]).map((stage,index)=>`<article class="platform-stage"><span>${String(index+1).padStart(2,'0')}</span><div><b>${d.esc(stage.operator||String(stage.mode||'').replaceAll('-',' '))}</b><small>${d.esc(stage.from||'')} → ${d.esc(stage.to||'')}</small><em>${d.esc(d.durationLabel(stage))} · ${d.esc(d.costLabel(stage))}</em></div></article>`).join('');
    const baseRefs=[...(segment.verification?.sourceIds||[]),...(segment.transport?.stages||[]).flatMap(stage=>stage.sourceIds||[])];
    const extension=d.extensions.composeSegmentDetail({trip,segment,profile:d.loadProfile(),t:d.t,esc:d.esc,local:d.local});
    const refs=[...new Set([...baseRefs,...extension.sourceIds])];

    content.innerHTML=`<div class="data-grid"><div class="data-card"><span>${d.esc(d.t('transport'))}</span><b>${d.esc(d.facetLabel(String(segment.transport?.mode||'—')))}</b></div><div class="data-card"><span>${d.esc(d.t('verification'))}</span><b class="${segment.verification?.status==='verified'?'evidence-ok':(segment.verification?.status==='illustrative'?'evidence-info':'evidence-watch')}">${d.esc(d.verificationLabel(segment))}</b></div><div class="data-card"><span>${d.esc(d.t('duration'))}</span><b>${d.esc(d.durationLabel(segment.planning))}</b></div><div class="data-card"><span>${d.esc(d.t('cost'))}</span><b>${d.esc(d.costLabel(segment.planning))}</b></div></div>${extension.panels}${stages?`<div class="platform-stages">${stages}</div>`:''}${segment.verification?.notes?`<div class="op-callout">${d.esc(d.editorialNote(segment.verification.notes))}</div>`:''}${refs.length?`<div class="platform-evidence"><div class="ops-mini-title">${d.esc(d.t('sources'))}</div>${d.sourceLinks(refs)}</div>`:''}`;
  }

  const api={configure,setMode,renderTripOverview,renderStopDetail,renderSegmentDetail};
  root.regionalDetail=api;
})();


/* ===== platform/regional-globe.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional globe renderer is not configured');
    return deps;
  }

  function getGlobe(){
    return window.__ONE_WORLD_ROUTE_GLOBE__||null;
  }

  function routeCamera(){
    const d=context(),trip=d.getTrip();
    const places=[...d.placeMap(trip).values()].filter(place=>Number.isFinite(Number(place.coordinates?.lat))&&Number.isFinite(Number(place.coordinates?.lng)));
    if(!places.length)return trip.rendering?.camera||{lat:20,lng:12,altitude:.8};
    const lats=places.map(place=>Number(place.coordinates.lat));
    const lngs=places.map(place=>Number(place.coordinates.lng));
    const lat=(Math.min(...lats)+Math.max(...lats))/2;
    const lng=(Math.min(...lngs)+Math.max(...lngs))/2;
    const latSpan=Math.max(...lats)-Math.min(...lats);
    const lngSpan=(Math.max(...lngs)-Math.min(...lngs))*Math.max(.35,Math.cos(lat*Math.PI/180));
    const span=Math.max(latSpan,lngSpan);
    let altitude=span<7?.15:span<13?.21:span<22?.30:span<34?.40:.54;
    if(innerWidth<=820)altitude+=.07;
    return {lat,lng,altitude};
  }

  function isolate(){
    document.body.classList.add('platform-regional-trip');
    document.body.classList.remove('story-mode','story-launching');
    window.ONE_WORLD_MOVEMENTS?.clear?.();
    const globe=getGlobe();
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
    }catch(error){console.warn('Regional isolation failed',error)}
  }

  function htmlLabel(place){
    const d=context();
    const el=document.createElement('div');
    el.className='platform-globe-label';
    const dot=document.createElement('i');
    el.appendChild(dot);
    const text=document.createElement('span');
    text.textContent=d.local(place?.name);
    el.appendChild(text);
    return el;
  }

  function routeGeometry(){
    const d=context(),trip=d.getTrip();
    const stops=d.stopMap(trip),places=d.placeMap(trip);
    return d.modelRouteGeometry(trip).map(segment=>({
      ...segment,
      fromName:d.local(places.get(stops.get(segment.fromStopId)?.placeId)?.name),
      toName:d.local(places.get(stops.get(segment.toStopId)?.placeId)?.name)
    }));
  }

  function render(){
    const d=context(),trip=d.getTrip(),selected=d.getSelectedIndex();
    const globe=getGlobe();
    if(!globe)return;
    const arcs=routeGeometry();
    const places=[...d.placeMap(trip).values()];
    const active=arcs[selected];
    const activeIds=new Set([
      active?.start&&trip.stops.find(stop=>stop.id===active.fromStopId)?.placeId,
      active?.end&&trip.stops.find(stop=>stop.id===active.toStopId)?.placeId
    ].filter(Boolean));
    const labelPlaces=places.filter(place=>activeIds.has(place.id));

    try{
      isolate();
      const settings=d.settings();
      const story=d.isStoryActive();
      const scale=Math.max(.45,settings.arcWidth/.55);
      globe.arcsData(arcs)
        .arcStartLat(item=>item.start.lat).arcStartLng(item=>item.start.lng)
        .arcEndLat(item=>item.end.lat).arcEndLng(item=>item.end.lng)
        .arcAltitude(item=>item._index===selected?.075:.045)
        .arcStroke(item=>(item._index===selected?.42:.18)*scale)
        .arcColor(item=>item._index===selected?(settings.routeGlow?['#59ddff','#ffffff']:'#59ddff'):(story?'rgba(92,124,151,.18)':'rgba(113,151,190,.62)'))
        .arcLabel(()=> '')
        .arcDashLength(item=>item._index===selected&&story?.62:1)
        .arcDashGap(item=>item._index===selected&&story?.16:0)
        .arcDashAnimateTime(item=>item._index===selected&&story&&!settings.reducedMotion?1200:0)
        .onArcClick(item=>{if(!d.isStoryActive())d.selectSegment(item._index,true)});

      globe.pointsData(settings.showPoints?places:[])
        .pointLat(place=>place.coordinates.lat).pointLng(place=>place.coordinates.lng)
        .pointAltitude(.012)
        .pointRadius(place=>activeIds.has(place.id)?.11:.065)
        .pointColor(place=>activeIds.has(place.id)?'#dff8ff':'rgba(130,185,214,.68)')
        .onPointClick(place=>{
          const index=trip.stops.findIndex(stop=>stop.placeId===place.id);
          if(index>=0)d.selectStop(index,true);
        });

      if(typeof globe.labelsData==='function')globe.labelsData([]);
      if(typeof globe.ringsData==='function')globe.ringsData([]);
      if(typeof globe.htmlElementsData==='function'){
        globe.htmlElementsData(labelPlaces)
          .htmlLat(place=>place.coordinates.lat)
          .htmlLng(place=>place.coordinates.lng)
          .htmlAltitude(.018)
          .htmlElement(htmlLabel)
          .htmlTransitionDuration(0);
      }
      if(typeof globe.onPolygonClick==='function')globe.onPolygonClick(()=>{});
      if(typeof globe.polygonLabel==='function')globe.polygonLabel(()=> '');
      if(globe.controls())globe.controls().enableZoom=true;
      updateAutoRotate();
      if(!document.body.dataset.regionalCameraReady){
        document.body.dataset.regionalCameraReady='1';
        globe.pointOfView(routeCamera(),settings.reducedMotion?0:700);
      }
    }catch(error){console.warn('Regional globe render failed',error)}
  }

  function updateAutoRotate(){
    const d=context(),controls=getGlobe()?.controls?.();
    if(!controls)return;
    controls.autoRotate=d.settings().autoRotate&&!d.isStoryActive()&&!document.body.classList.contains('terrain-view');
    controls.autoRotateSpeed=.28;
  }

  function focusRoute(){
    const d=context(),globe=getGlobe();
    if(!globe)return;
    globe.pointOfView(routeCamera(),d.settings().reducedMotion?0:650);
  }

  function focusPlace(place,altitude=.48){
    const d=context(),globe=getGlobe();
    if(!globe||!place?.coordinates)return;
    globe.pointOfView({lat:place.coordinates.lat,lng:place.coordinates.lng,altitude},d.settings().reducedMotion?0:650);
  }

  function focusSegment(segment){
    const d=context(),trip=d.getTrip();
    const stopMap=d.stopMap(trip),placeMap=d.placeMap(trip);
    const from=placeMap.get(stopMap.get(segment.fromStopId)?.placeId);
    const to=placeMap.get(stopMap.get(segment.toStopId)?.placeId);
    if(!from||!to)return;
    const lng=(from.coordinates.lng+to.coordinates.lng)/2;
    const lat=(from.coordinates.lat+to.coordinates.lat)/2;
    const spread=Math.max(
      Math.abs(Number(from.coordinates.lat)-Number(to.coordinates.lat)),
      Math.abs(Number(from.coordinates.lng)-Number(to.coordinates.lng))*Math.max(.35,Math.cos(lat*Math.PI/180))
    );
    let altitude=spread<1?.09:spread<2.5?.13:spread<5?.18:spread<10?.25:.34;
    if(innerWidth<=820)altitude+=.055;
    const globe=getGlobe();
    if(globe)globe.pointOfView({lat,lng,altitude},d.settings().reducedMotion?0:650);
  }

  const api={configure,routeCamera,isolate,routeGeometry,render,updateAutoRotate,focusRoute,focusPlace,focusSegment};
  root.regionalGlobe=api;
})();


/* ===== platform/story.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const state={active:false,playing:false,timer:null};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional story controller is not configured');
    return deps;
  }

  function ensureUi(){
    const d=context(),trip=d.getTrip(),meta=d.getTripMeta();
    const stage=document.querySelector('.globe-stage');
    if(!stage||!trip)return;
    if(!d.hasCapability(meta,'story')){
      document.querySelector('#platformStoryBtn')?.remove();
      document.querySelector('#platformStoryHud')?.remove();
      return;
    }
    let button=document.querySelector('#platformStoryBtn');
    if(!button){
      button=document.createElement('button');
      button.id='platformStoryBtn';
      button.className='platform-story-btn glass';
      button.type='button';
      stage.appendChild(button);
      button.addEventListener('click',start);
    }
    button.innerHTML=`<span class="platform-story-icon">▶</span><span><b>${d.esc(d.t('storyPlay'))}</b><small>${trip.segments.length} ${d.esc(d.t('segments'))}</small></span>`;

    if(!document.querySelector('#platformStoryHud')){
      const hud=document.createElement('section');
      hud.id='platformStoryHud';
      hud.className='platform-story-hud glass hidden';
      hud.setAttribute('aria-live','polite');
      hud.innerHTML=`<div class="platform-story-head"><div><span id="platformStoryKicker"></span><b id="platformStoryChapter"></b></div><button id="platformStoryExit" type="button">${d.esc(d.t('storyExit'))}</button></div><div id="platformStoryRoute" class="platform-story-route"></div><div class="platform-story-controls"><button id="platformStoryPrev" type="button" aria-label="${d.esc(d.t('previous'))}">‹</button><button id="platformStoryPlay" type="button" aria-label="${d.esc(d.t('storyPlay'))}">Ⅱ</button><button id="platformStoryNext" type="button" aria-label="${d.esc(d.t('next'))}">›</button><div class="platform-story-track"><i></i></div><strong id="platformStoryPct">0%</strong></div>`;
      stage.appendChild(hud);
      hud.querySelector('#platformStoryExit')?.addEventListener('click',stop);
      hud.querySelector('#platformStoryPrev')?.addEventListener('click',()=>step(-1));
      hud.querySelector('#platformStoryNext')?.addEventListener('click',()=>step(1));
      hud.querySelector('#platformStoryPlay')?.addEventListener('click',togglePlayback);
    }
  }

  function update(){
    const d=context(),trip=d.getTrip();
    if(!trip)return;
    const selected=d.getSelectedIndex();
    const seg=trip.segments[selected];
    const sm=d.stopMap(trip),pm=d.placeMap(trip);
    const a=pm.get(sm.get(seg?.fromStopId)?.placeId),b=pm.get(sm.get(seg?.toStopId)?.placeId);
    const chapter=d.chapterForSegment(selected);
    const kicker=document.querySelector('#platformStoryKicker');
    const title=document.querySelector('#platformStoryChapter');
    const route=document.querySelector('#platformStoryRoute');
    const pct=document.querySelector('#platformStoryPct');
    const bar=document.querySelector('#platformStoryHud .platform-story-track i');
    const progress=trip.segments.length<=1?100:Math.round(selected/(trip.segments.length-1)*100);
    if(kicker)kicker.textContent=chapter?`${d.t('chapter')} · ${d.local(chapter.title)}`:`${d.t('storyRoute')} · ${selected+1}/${trip.segments.length}`;
    if(title)title.textContent=chapter?d.local(chapter.title):d.local(trip.title);
    if(route)route.textContent=`${d.local(a?.name)} → ${d.local(b?.name)} · ${d.facetLabel(seg?.transport?.mode||'')}`;
    if(pct)pct.textContent=`${progress}%`;
    if(bar)bar.style.width=`${progress}%`;
  }

  function step(delta){
    const d=context(),trip=d.getTrip();
    if(!state.active||!trip)return;
    const selected=d.getSelectedIndex();
    const next=Math.max(0,Math.min(trip.segments.length-1,selected+delta));
    if(next===selected&&delta>0){
      pause();
      const title=document.querySelector('#platformStoryChapter');
      if(title)title.textContent=d.t('storyComplete');
      return;
    }
    d.selectSegment(next,true);
    update();
  }

  function pause(){
    clearInterval(state.timer);
    state.timer=null;
    state.playing=false;
    const button=document.querySelector('#platformStoryPlay');
    if(button)button.textContent='▶';
  }

  function play(){
    const d=context(),trip=d.getTrip();
    if(!trip)return;
    clearInterval(state.timer);
    state.playing=true;
    const button=document.querySelector('#platformStoryPlay');
    if(button)button.textContent='Ⅱ';
    state.timer=setInterval(()=>{
      const selected=d.getSelectedIndex();
      if(selected>=trip.segments.length-1){
        pause();
        const title=document.querySelector('#platformStoryChapter');
        if(title)title.textContent=d.t('storyComplete');
        return;
      }
      d.selectSegment(selected+1,true);
      update();
    },2200);
  }

  function togglePlayback(){
    state.playing?pause():play();
  }

  async function start(){
    const d=context(),trip=d.getTrip(),meta=d.getTripMeta();
    if(!trip||state.active||!d.hasCapability(meta,'story'))return;
    if(document.body.classList.contains('terrain-view'))await d.setTerrain(false);
    d.stopRoutePlayback();
    state.active=true;
    document.body.classList.add('platform-story-mode');
    document.querySelector('#platformStoryHud')?.classList.remove('hidden');
    update();
    play();
  }

  function stop(){
    if(!deps)return;
    const d=context();
    pause();
    state.active=false;
    document.body.classList.remove('platform-story-mode');
    document.querySelector('#platformStoryHud')?.classList.add('hidden');
    d.renderRoute();
  }

  const api={
    configure,
    ensureUi,
    update,
    step,
    start,
    stop,
    play,
    pause,
    togglePlayback,
    isActive:()=>state.active,
    isPlaying:()=>state.playing
  };
  root.story=api;
})();


/* ===== platform/terrain.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const state={map:null,ready:false,loading:null,maplibre:null,highDetailWasDisabled:null,autoRotateWasDisabled:null};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional terrain controller is not configured');
    return deps;
  }

  function routeGeoJson(){
    const d=context(),selected=d.getSelectedIndex();
    return {
      type:'FeatureCollection',
      features:d.routeGeometry().map(item=>({
        type:'Feature',
        properties:{id:item._index+1,active:item._index===selected?1:0,mode:item.transport?.mode||''},
        geometry:{type:'LineString',coordinates:[[Number(item.start.lng),Number(item.start.lat)],[Number(item.end.lng),Number(item.end.lat)]]}
      }))
    };
  }

  function stopGeoJson(){
    const d=context(),trip=d.getTrip();
    return {
      type:'FeatureCollection',
      features:[...d.placeMap(trip).values()]
        .filter(place=>place.coordinates)
        .map(place=>({
          type:'Feature',
          properties:{id:place.id,name:d.local(place.name)},
          geometry:{type:'Point',coordinates:[Number(place.coordinates.lng),Number(place.coordinates.lat)]}
        }))
    };
  }

  function focusRoute(){
    const d=context(),bounds=d.routeBounds();
    if(!state.map||!bounds)return;
    const padding=innerWidth<=820?{top:90,right:26,bottom:132,left:26}:{top:78,right:380,bottom:90,left:330};
    state.map.fitBounds(bounds,{padding,maxZoom:7.4,duration:d.settings().reducedMotion?0:750,essential:true});
  }

  async function loadMapLibre(){
    if(state.maplibre)return state.maplibre;
    if(!document.querySelector('link[data-platform-maplibre]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css';
      link.dataset.platformMaplibre='1';
      document.head.appendChild(link);
    }
    const module=await import('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs');
    if(typeof module?.Map!=='function')throw new Error('MapLibre unavailable');
    state.maplibre=module;
    return module;
  }

  async function style(){
    const d=context(),mapStyle=root.mapStyle;
    if(!mapStyle)throw new Error('ONE WORLD ROUTE map style module unavailable');
    let base;
    try{
      const response=await fetch('https://tiles.openfreemap.org/styles/liberty',{cache:'force-cache'});
      if(!response.ok)throw new Error(String(response.status));
      base=await response.json();
    }catch{
      base={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#d9e5e8'}}]};
    }
    base=mapStyle.brandDark(mapStyle.localize(base,d.locale()));
    base.version=8;
    base.projection={type:'globe'};
    base.sources={...(base.sources||{}),
      terrainSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
      regionalRoute:{type:'geojson',data:routeGeoJson()},
      regionalStops:{type:'geojson',data:stopGeoJson()}
    };
    base.terrain={source:'terrainSource',exaggeration:1.34};
    base.sky={'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.42,3.5,.13,7,0]};
    const selected=d.getSelectedIndex();
    base.layers.push(
      {id:'regional-route-shadow',type:'line',source:'regionalRoute',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(1,8,15,.68)','line-width':['interpolate',['linear'],['zoom'],2,3,7,6,12,9],'line-opacity':.58}},
      {id:'regional-route',type:'line',source:'regionalRoute',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#6c8eaa','line-width':['interpolate',['linear'],['zoom'],2,1.4,7,2.8,12,4.2],'line-opacity':.78}},
      {id:'regional-selected-shadow',type:'line',source:'regionalRoute',filter:['==',['get','id'],selected+1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(2,8,14,.88)','line-width':['interpolate',['linear'],['zoom'],2,6,7,10,12,15]}},
      {id:'regional-selected',type:'line',source:'regionalRoute',filter:['==',['get','id'],selected+1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#59ddff','line-width':['interpolate',['linear'],['zoom'],2,2.8,7,5.2,12,7.5]}},
      {id:'regional-route-hit',type:'line',source:'regionalRoute',paint:{'line-color':'rgba(0,0,0,.001)','line-width':18,'line-opacity':.001}},
      {id:'regional-stop-points',type:'circle',source:'regionalStops',paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,3,8,5,12,7],'circle-color':'#dff8ff','circle-stroke-width':2,'circle-stroke-color':'#1388a7'}}
    );
    return base;
  }

  async function ensure(){
    if(state.ready&&state.map)return state.map;
    if(state.loading)return state.loading;
    state.loading=(async()=>{
      const d=context();
      let host=document.querySelector('#terrainMap');
      if(!host){
        host=document.createElement('div');
        host.id='terrainMap';
        document.querySelector('.globe-stage')?.appendChild(host);
      }
      let badge=document.querySelector('.terrain-badge');
      if(!badge){
        badge=document.createElement('div');
        badge.className='terrain-badge';
        badge.innerHTML='<b>3D GLOBE TERRAIN</b><span></span>';
        document.querySelector('.globe-stage')?.appendChild(badge);
      }
      const [maplibre,mapStyle]=await Promise.all([loadMapLibre(),style()]);
      const cam=d.routeCamera();
      const map=new maplibre.Map({container:'terrainMap',style:mapStyle,center:[cam.lng,cam.lat],zoom:4.6,pitch:36,bearing:-5,minZoom:2.5,maxZoom:18,maxPitch:65,renderWorldCopies:false,attributionControl:false,canvasContextAttributes:{antialias:true}});
      map.on('style.load',()=>{try{map.setProjection({type:'globe'});map.setTerrain({source:'terrainSource',exaggeration:1.34})}catch{}});
      map.on('load',()=>{
        map.on('click','regional-route-hit',event=>{
          const id=Number(event.features?.[0]?.properties?.id);
          if(Number.isFinite(id))d.selectSegment(id-1,true);
        });
        map.on('mouseenter','regional-route-hit',()=>map.getCanvas().style.cursor='pointer');
        map.on('mouseleave','regional-route-hit',()=>map.getCanvas().style.cursor='');
      });
      map.addControl(new maplibre.AttributionControl({compact:true}),'bottom-left');
      if(innerWidth>820){
        map.addControl(new maplibre.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
        if(maplibre.TerrainControl)map.addControl(new maplibre.TerrainControl({source:'terrainSource',exaggeration:1.34}),'top-right');
        if(maplibre.GlobeControl)map.addControl(new maplibre.GlobeControl(),'top-right');
      }
      await new Promise(resolve=>{
        if(map.loaded?.())resolve();
        else map.once('load',resolve);
      });
      state.map=map;
      state.ready=true;
      window.__ONE_WORLD_REGIONAL_TERRAIN__=map;
      return map;
    })().finally(()=>{state.loading=null});
    return state.loading;
  }

  function update(){
    const d=context(),map=state.map;
    if(!map)return;
    map.getSource?.('regionalRoute')?.setData?.(routeGeoJson());
    map.getSource?.('regionalStops')?.setData?.(stopGeoJson());
    for(const id of ['regional-selected','regional-selected-shadow']){
      if(map.getLayer?.(id))map.setFilter(id,['==',['get','id'],d.getSelectedIndex()+1]);
    }
    const settings=d.settings();
    if(map.getLayer?.('regional-stop-points'))map.setLayoutProperty('regional-stop-points','visibility',settings.showPoints?'visible':'none');
    if(map.getLayer?.('regional-route'))map.setPaintProperty('regional-route','line-opacity',settings.routeGlow?.82:.48);
  }

  function focusSegment(index=context().getSelectedIndex()){
    const d=context(),seg=d.routeGeometry()[index];
    if(!state.map||!seg)return;
    const a=[Number(seg.start.lng),Number(seg.start.lat)],b=[Number(seg.end.lng),Number(seg.end.lat)];
    const lng=(a[0]+b[0])/2,lat=(a[1]+b[1])/2;
    const spread=Math.max(Math.abs(a[0]-b[0])*Math.cos(lat*Math.PI/180),Math.abs(a[1]-b[1]));
    const zoom=spread<.5?9.2:spread<1.5?7.9:spread<4?6.7:spread<9?5.5:4.6;
    state.map.easeTo({center:[lng,lat],zoom:innerWidth<=820?zoom-.25:zoom,pitch:spread<4?46:34,bearing:0,duration:d.settings().reducedMotion?0:700,essential:true});
  }

  function restoreControls(){
    const high=document.querySelector('#highDetailGlobe');
    const auto=document.querySelector('#autoRotate');
    if(high&&state.highDetailWasDisabled!==null){
      high.disabled=state.highDetailWasDisabled;
      state.highDetailWasDisabled=null;
    }
    if(auto&&state.autoRotateWasDisabled!==null){
      auto.disabled=state.autoRotateWasDisabled;
      state.autoRotateWasDisabled=null;
    }
  }

  async function setActive(active){
    const d=context(),trip=d.getTrip(),meta=d.getTripMeta();
    if(!trip||meta?.renderer==='legacy-world'||!d.hasCapability(meta,'terrain'))return;
    const toggle=document.querySelector('#terrainView');
    if(toggle)toggle.checked=Boolean(active);
    if(!active){
      document.body.classList.remove('terrain-loading','terrain-view');
      restoreControls();
      d.setViewParam(false);
      d.renderRoute();
      return;
    }
    if(d.isStoryActive())d.stopStory();
    const high=document.querySelector('#highDetailGlobe');
    const auto=document.querySelector('#autoRotate');
    if(high){
      if(state.highDetailWasDisabled===null)state.highDetailWasDisabled=high.disabled;
      high.disabled=true;
    }
    if(auto){
      if(state.autoRotateWasDisabled===null)state.autoRotateWasDisabled=auto.disabled;
      auto.disabled=true;
    }
    document.body.classList.add('terrain-loading');
    const badge=document.querySelector('.terrain-badge span');
    if(badge)badge.textContent=d.t('terrainLoading');
    try{
      const map=await ensure();
      map.resize();
      update();
      document.body.classList.remove('terrain-loading');
      document.body.classList.add('terrain-view');
      focusRoute();
      if(badge)badge.textContent=d.t('terrainHint');
      d.setViewParam(true);
    }catch(error){
      console.warn('Regional terrain unavailable',error);
      document.body.classList.remove('terrain-loading','terrain-view');
      if(toggle)toggle.checked=false;
      restoreControls();
      d.toast(d.t('terrainUnavailable'));
    }
  }

  const api={
    configure,
    routeGeoJson,
    stopGeoJson,
    focusRoute,
    style,
    ensure,
    update,
    focusSegment,
    setActive,
    isReady:()=>state.ready,
    getMap:()=>state.map
  };
  root.terrain=api;
})();


/* ===== platform/extensions.js ===== */
(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const runtime=root.runtime,model=root.model;
  if(!runtime||!model)throw new Error('Platform runtime/model must load before extensions');

  runtime.registerExtension('cruise',{
    tripOverview(ctx){
      const cruise=model.extension(ctx.trip,'cruise');
      if(!cruise)return null;
      return {
        cards:`<div class="data-card"><span>${ctx.esc(ctx.t('onboardNights'))}</span><b>${cruise.nights??'—'}</b></div><div class="data-card"><span>${ctx.esc(ctx.t('seaDays'))}</span><b>${cruise.seaDays??0}</b></div>`,
        notices:cruise.requiresSailingSelection?`<div class="platform-cruise-note">${ctx.esc(ctx.t('sailingNeeded'))}</div>`:''
      };
    },
    stopDetail(ctx){
      const call=model.extension(ctx.stop,'cruiseCall');
      const refs=model.extension(ctx.place,'port')?.sourceIds||[];
      if(!call&&!refs)return null;
      const callLabel=call?.kind==='embarkation'?ctx.t('embarkation'):(call?.kind==='disembarkation'?ctx.t('disembarkation'):(call?ctx.t('portCall'):null));
      return {
        cards:callLabel?`<div class="data-card"><span>${ctx.esc(ctx.t('portCall'))}</span><b>${ctx.esc(callLabel)}</b></div>`:'',
        notices:`<div class="platform-cruise-note">${ctx.esc(ctx.t('sailingNeeded'))}</div>`,
        sourceIds:refs
      };
    },
    segmentDetail(ctx){
      const cruise=model.extension(ctx.segment,'cruise');
      if(!cruise)return null;
      return {panels:`<div class="platform-cruise-leg"><div><span>${ctx.esc(ctx.t('onboardNights'))}</span><b>${cruise.onboardNights??0}</b></div><div><span>${ctx.esc(ctx.t('seaDays'))}</span><b>${(cruise.seaDayNumbers||[]).join(', ')||'—'}</b></div></div>`};
    }
  });

  runtime.registerExtension('road',{
    tripOverview(ctx){
      const road=model.extension(ctx.trip,'roadTrip');
      if(!road)return null;
      return {notices:road.vehicleContextRequired&&!ctx.profile?.vehicle?`<div class="platform-cruise-note">${ctx.esc(ctx.t('vehicleNeeded'))}</div>`:''};
    },
    segmentDetail(ctx){
      const road=model.extension(ctx.segment,'road');
      if(!road)return null;
      return {panels:`<div class="platform-road-context"><div><span>${ctx.esc(ctx.t('roadRules'))}</span><b>${road.crossBorder?ctx.esc(ctx.t('crossBorder')):ctx.esc(road.fromCountry||'')}</b></div><div><span>${ctx.esc(ctx.t('urbanAccess'))}</span><b>${ctx.esc((road.urbanAccessChecks||[]).join(' · ')||'—')}</b></div>${!ctx.profile?.vehicle?`<p>${ctx.esc(ctx.t('vehicleNeeded'))}</p>`:''}</div>`};
    }
  });

  runtime.registerExtension('border',{
    segmentDetail(ctx){
      const border=model.extension(ctx.segment,'border');
      if(!border||border.zoneTransition==='domestic')return null;
      const label=border.zoneTransition==='schengen-exit'?ctx.t('schengenExit'):(border.zoneTransition==='schengen-entry'?ctx.t('schengenEntry'):border.zoneTransition);
      return {panels:`<div class="platform-border ${border.personalizationRequired?'requires-context':''}"><b>${ctx.esc(ctx.t('border'))}</b><span>${ctx.esc(label||'—')} · ${ctx.esc(border.fromCountry)} → ${ctx.esc(border.toCountry)}</span></div>`};
    }
  });

  function compose(method,ctx){
    const result={cards:'',notices:'',panels:'',sourceIds:[]};
    for(const extension of runtime.listExtensions()){
      const fn=extension[method];
      if(typeof fn!=='function')continue;
      const part=fn(ctx);
      if(!part)continue;
      result.cards+=part.cards||'';
      result.notices+=part.notices||'';
      result.panels+=part.panels||'';
      if(Array.isArray(part.sourceIds))result.sourceIds.push(...part.sourceIds);
    }
    result.sourceIds=[...new Set(result.sourceIds)];
    return result;
  }
  root.extensions={
    composeTripOverview:ctx=>compose('tripOverview',ctx),
    composeStopDetail:ctx=>compose('stopDetail',ctx),
    composeSegmentDetail:ctx=>compose('segmentDetail',ctx)
  };
})();


/* ===== platform.js ===== */
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
  const Story=PLATFORM_MODULES.story;
  const Terrain=PLATFORM_MODULES.terrain;
  const Ui=PLATFORM_MODULES.ui;
  const Navigation=PLATFORM_MODULES.navigation;
  const LegacyLocalization=PLATFORM_MODULES.legacyLocalization;
  if(!LocaleData||!Model||!Traveller||!TravellerUi||!Discovery||!Extensions||!RouteLibrary||!RegionalShell||!RegionalDetail||!RegionalGlobe||!Story||!Terrain||!Ui||!Navigation||!LegacyLocalization)throw new Error('ONE WORLD ROUTE platform modules unavailable');
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

  function configureRegionalMethodology(){
    const modal=$('#infoModal'),card=$('.modal-card',modal);if(!modal||!card)return;
    const sourced=currentTrip.segments.filter(s=>(s.verification?.sourceIds||[]).length).length;
    card.innerHTML=`<button class="modal-close" aria-label="Close">×</button><div class="eyebrow">${esc(t('methodology').toUpperCase())}</div><h2>${esc(t('routeMethodTitle'))}</h2><p>${esc(t('routeMethodText'))}</p><div class="method-grid"><article><b>${currentTrip.stops.length}</b><span>${esc(t('stops'))}</span></article><article><b>${currentTrip.segments.length}</b><span>${esc(t('segments'))}</span></article><article><b>${currentTrip.planning?.days||'—'}</b><span>${esc(t('days'))}</span></article><article><b>${sourced}/${currentTrip.segments.length}</b><span>${esc(t('evidenceCoverage'))}</span></article></div><h3>${esc(t('editorialStatus'))}</h3><p>${esc(t('editorial'))}</p>`;
    $('.modal-close',card)?.addEventListener('click',()=>modal.classList.add('hidden'));
  }

  function configureRegionalSettings(){
    const actions=$('.top-actions');if(actions)actions.classList.add('platform-regional-actions');
    const brand=$('#brandBtn');if(brand)brand.onclick=()=>{selectedSegmentIndex=0;RegionalDetail.renderTripOverview();RegionalGlobe.render();if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(0);else RegionalGlobe.focusRoute()};
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
    bind('autoRotate','change',()=>RegionalGlobe.updateAutoRotate());
    bind('showPoints','change',()=>{RegionalGlobe.render();Terrain.update()});
    bind('routeGlow','change',()=>{RegionalGlobe.render();Terrain.update()});
    bind('arcWidth','input',()=>{RegionalGlobe.render();Terrain.update()});
    bind('reducedMotion','change',()=>{});
    configureRegionalMethodology();
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

  function selectSegmentIndex(index,focus=false){
    selectedSegmentIndex=Math.max(0,Math.min(currentTrip.segments.length-1,index));
    $$('.platform-stop').forEach(x=>x.classList.remove('active'));
    RegionalGlobe.render();updateTimelineRegional();RegionalDetail.renderSegmentDetail(currentTrip.segments[selectedSegmentIndex]);Terrain.update();
    if(Story.isActive())Story.update();
    if(focus){if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(selectedSegmentIndex);else RegionalGlobe.focusSegment(currentTrip.segments[selectedSegmentIndex])}
  }

  function selectStop(index,focus=false){
    const stop=currentTrip.stops[index],p=stopPlace(currentTrip,stop);if(!stop||!p)return;
    $$('.platform-stop').forEach((x,i)=>x.classList.toggle('active',i===index));
    RegionalDetail.renderStopDetail(stop,p);
    if(index<currentTrip.segments.length){selectedSegmentIndex=index;updateTimelineRegional();RegionalGlobe.render();Terrain.update()}
    if(focus){if(document.body.classList.contains('terrain-view'))Terrain.focusSegment(Math.min(index,currentTrip.segments.length-1));else RegionalGlobe.focusPlace(p)}
  }

  async function activateRegionalTrip(meta){
    currentTripMeta=meta;
    selectedSegmentIndex=0;
    currentTrip=await fetch(meta.dataset,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip dataset '+r.status);return r.json()});
    await waitForCore();
    configureRegionalGlobe();
    configureRegionalTerrain();
    configureRegionalStory();
    configureRegionalDetail();
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

