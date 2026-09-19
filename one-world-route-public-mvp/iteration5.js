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
    if(document.querySelector('link[data-iteration5]'))return;
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