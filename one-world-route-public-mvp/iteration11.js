(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const PHASES=[
    {id:1,range:[1,29],title:'Europe I'},
    {id:2,range:[30,39],title:'North & Central America'},
    {id:3,range:[40,52],title:'Caribbean'},
    {id:4,range:[53,64],title:'South America'},
    {id:5,range:[65,78],title:'South Pacific'},
    {id:6,range:[79,95],title:'Southeast Asia & Indian Ocean'},
    {id:7,range:[96,112],title:'East & Central Asia'},
    {id:8,range:[113,120],title:'Levant & North Africa'},
    {id:9,range:[121,145],title:'West & Central Africa'},
    {id:10,range:[146,169],title:'Southern & East Africa'},
    {id:11,range:[170,181],title:'Gulf & Levant'},
    {id:12,range:[182,194],title:'Europe II · Finish'}
  ];

  const runtime={
    route:null,countries:[],countryByName:new Map(),countryByCca3:new Map(),
    syncing:false,lastCountry:null,lastContextId:null,historyWrapped:false,observer:null,globeTimer:null
  };

  function phaseFor(id){return PHASES.find(p=>id>=p.range[0]&&id<=p.range[1])||PHASES[0]}
  function flagUrl(country){
    const code=String(country?.cca2||'').toLowerCase();
    return /^[a-z]{2}$/.test(code)?`https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/${code}.svg`:'';
  }

  function ensureStyles(){
    if($('#iteration11Styles'))return;
    const style=document.createElement('style');style.id='iteration11Styles';
    style.textContent=`
      .country-title-wrap{display:inline-flex;align-items:center;gap:9px;min-width:0}
      .country-title-flag{width:24px;height:18px;display:block;object-fit:cover;flex:0 0 auto;filter:saturate(.92) contrast(1.04);box-shadow:0 0 0 1px rgba(255,255,255,.10)}
      .country-title-name{min-width:0;overflow:hidden;text-overflow:ellipsis}
      body.terrain-view .floating-stats{display:none!important}
      .country-context-note{margin-top:7px;font-size:9px;line-height:1.4;color:var(--muted,#7f91a8)}
      .country-context-note b{color:#bcd1e6;font-weight:650}
    `;
    document.head.appendChild(style);
  }

  async function loadData(){
    if(runtime.route&&runtime.countries.length)return;
    try{
      const [routeRes,countryRes]=await Promise.all([
        fetch('./data/public-route.json',{cache:'force-cache'}),
        fetch('./data/country-centroids.json',{cache:'force-cache'})
      ]);
      runtime.route=await routeRes.json();
      runtime.countries=await countryRes.json();
      runtime.countryByName=new Map(runtime.countries.map(c=>[c.name,c]));
      runtime.countryByCca3=new Map(runtime.countries.filter(c=>c.cca3).map(c=>[String(c.cca3).toUpperCase(),c]));
    }catch(err){console.warn('Iteration 11 context data unavailable',err);runtime.route={segments:[]};}
  }

  function countryFromUrl(){return new URLSearchParams(location.search).get('country')||''}

  function countryContext(name){
    const segments=runtime.route?.segments||[];
    const incoming=segments.find(s=>s.to===name);
    const outgoing=segments.find(s=>s.from===name);
    if(name==='Deutschland'){
      const current=Number($('#routeRange')?.value||1);
      return current>120?(incoming||outgoing):(outgoing||incoming);
    }
    return incoming||outgoing||null;
  }

  function activateCountry(name){
    const input=$('#inlineSearch');if(!input||!name)return false;
    input.value=name;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const hit=$$('#searchResults .search-hit').find(el=>{
      const first=el.childNodes?.[0]?.nodeValue?.trim();
      return first===name||el.textContent.trim().startsWith(name);
    });
    if(!hit)return false;
    hit.click();
    input.value='';
    $('#searchResults')?.classList.add('hidden');
    return true;
  }

  function resetPhaseFilter(){
    const active=$('#phaseRail button.active');
    if(active&&active.dataset.phase!=='all')$('#phaseRail button[data-phase="all"]')?.click();
  }

  function syncCountryState(){
    if(runtime.syncing)return;
    const name=countryFromUrl();
    if(!name){runtime.lastCountry=null;runtime.lastContextId=null;decorateUi();return;}
    const context=countryContext(name);if(!context){decorateUi();return;}
    const range=$('#routeRange');if(!range){decorateUi();return;}
    const contextId=clamp(Number(context.id)||1,1,194);

    if(Number(range.value)===contextId){
      runtime.lastCountry=name;runtime.lastContextId=contextId;decorateUi();return;
    }

    runtime.syncing=true;
    resetPhaseFilter();
    range.value=String(contextId);
    range.dispatchEvent(new Event('input',{bubbles:true}));

    setTimeout(()=>{
      activateCountry(name);
      runtime.lastCountry=name;runtime.lastContextId=contextId;
      runtime.syncing=false;
      setTimeout(decorateUi,0);
    },30);
  }

  function decorateCountryTitle(){
    const name=countryFromUrl();if(!name)return;
    const country=runtime.countryByName.get(name);if(!country)return;
    const title=$('#detailTitle');if(!title)return;
    const url=flagUrl(country);
    title.innerHTML=`<span class="country-title-wrap">${url?`<img class="country-title-flag" src="${url}" alt="" width="24" height="18">`:''}<span class="country-title-name">${esc(name)}</span></span>`;
  }

  function decorateJourneyContext(){
    const name=countryFromUrl();if(!name)return;
    const context=countryContext(name);if(!context)return;
    const card=$('#detailContent .journey-context');if(!card)return;
    const phase=phaseFor(Number(context.id));
    const pct=Math.max(0,Math.min(100,((Number(context.id)-1)/193)*100));
    card.innerHTML=`<div class="journey-context-top"><span>Route context</span><b>${context.id} / 194</b></div><div class="journey-context-track"><i style="width:${pct}%"></i></div><div class="journey-context-note"><span>Chapter</span><strong>${esc(phase.title)}</strong></div><div class="country-context-note"><b>${esc(context.from)} → ${esc(context.to)}</b> · route leg linked to ${esc(name)}</div>`;
  }

  function removeMisleadingSegmentIntel(){
    if(!countryFromUrl())return;
    $('#selectedOpsIntel')?.remove();
  }

  function stripFlagEmoji(text){
    return String(text||'').replace(/[\u{1F1E6}-\u{1F1FF}]/gu,'').replace(/^\s*[A-Z]{2}\s+(?=[\p{L}])/u,'').trim();
  }

  function tuneGlobeLabels(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    if(!globe){clearTimeout(runtime.globeTimer);runtime.globeTimer=setTimeout(tuneGlobeLabels,120);return;}
    if(globe.__oneWorldCountryLabelAssets)return;
    try{
      globe.labelText?.(d=>stripFlagEmoji(d?.text));
      globe.pointLabel?.(c=>{
        const geo=runtime.countryByCca3.get(String(c?.cca3||'').toUpperCase())||runtime.countryByName.get(c?.name);
        const url=flagUrl(geo);
        return `<div style="display:flex;align-items:center;gap:7px">${url?`<img src="${url}" alt="" width="22" height="16" style="display:block;object-fit:cover">`:''}<div><b>${esc(c?.name||'Country')}</b><br><span style="color:#8ba0b8">Country ${esc(c?.number||'—')}/195 · ${esc(c?.readiness||'')}</span></div></div>`;
      });
      globe.__oneWorldCountryLabelAssets=true;
    }catch(err){console.warn('Country label asset tuning unavailable',err);}
  }

  function decorateUi(){
    decorateCountryTitle();
    decorateJourneyContext();
    removeMisleadingSegmentIntel();
    tuneGlobeLabels();
  }

  function scheduleSync(){setTimeout(()=>{syncCountryState();decorateUi();},0)}

  function wrapHistory(){
    if(runtime.historyWrapped)return;runtime.historyWrapped=true;
    const nativeReplace=history.replaceState.bind(history);
    history.replaceState=function(state,title,url){
      const out=nativeReplace(state,title,url);
      scheduleSync();
      return out;
    };
    window.addEventListener('popstate',scheduleSync);
  }

  function wireObservers(){
    const detail=$('#rightPanel');
    if(detail){
      runtime.observer=new MutationObserver(()=>setTimeout(decorateUi,0));
      runtime.observer.observe(detail,{childList:true,subtree:true,characterData:true});
    }
    $('#routeRange')?.addEventListener('input',()=>setTimeout(decorateUi,0));
  }

  async function init(){
    ensureStyles();
    await loadData();
    wrapHistory();
    wireObservers();
    tuneGlobeLabels();
    scheduleSync();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();