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