(() => {
  'use strict';

  const runtime={data:null,segments:[],selectedId:1,observer:null,renderFrame:null};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const excelDate=v=>v?new Date(Date.UTC(1899,11,30)+Number(v)*86400000):null;
  const euro=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v||0));
  const now=new Date(Date.UTC(2026,8,17));

  function ensureStyles(){
    if(document.querySelector('link[data-iteration6]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='./iteration6.css';link.dataset.iteration6='1';document.head.appendChild(link);
  }

  async function loadData(){
    if(runtime.data)return runtime.data;
    try{
      const r=await fetch('./data/public-route.json',{cache:'force-cache'});runtime.data=await r.json();runtime.segments=runtime.data.segments||[];return runtime.data;
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
      ${high?`<button class="ops-hotspot" data-segment="${high.id}"><span>HIGHEST ROUTE CONSTRAINT</span><b>#${high.id} ${esc(high.from)} → ${esc(high.to)}</b><small>${esc(riskReasons(high).slice(0,2).join(' · ')||'Review route')}</small></button>`:''}
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
      <div class="ops-dependencies">${deps.length?deps.map(({s:x,reasons:r})=>`<button data-segment="${x.id}"><b>#${x.id} ${esc(x.from)} → ${esc(x.to)}</b><small>${esc(r.slice(0,2).join(' · '))}</small></button>`).join(''):'<div class="ops-empty">No adjacent flagged dependency in this window.</div>'}</div>
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