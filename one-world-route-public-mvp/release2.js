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