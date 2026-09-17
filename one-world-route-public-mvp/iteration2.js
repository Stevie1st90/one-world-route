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

  const story = { active:false, phaseId:null, completionTimer:null, restore:{arcWidth:null,showPoints:null,autoRotate:null} };

  function phaseFor(id){
    return PHASES.find(p => id >= p.range[0] && id <= p.range[1]) || PHASES[0];
  }

  function ensureStoryStyles(){
    if(document.querySelector('link[data-story-route]'))return;
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

  function syncMode(){
    const active=$('.mode-switch button.active');
    document.body.dataset.mode=active?.dataset.mode||'explore';
  }

  function syncProgress(){
    const r=$('#routeRange'); if(!r)return;
    const min=Number(r.min||1), max=Number(r.max||194), v=Number(r.value||1);
    const pct=((v-min)/(max-min))*100;
    document.documentElement.style.setProperty('--journey-progress',`${Math.max(0,Math.min(100,pct))}%`);
    const j=$('#journeyBtn'), p=$('#playBtn');
    if(j&&p){
      const running=p.textContent.trim()!=='▶';
      j.classList.toggle('active',running || story.active);
      const i=j.querySelector('.journey-icon'); if(i)i.textContent=running?'Ⅱ':'▶';
    }
    updateJourneyContext(v,pct);
    if(story.active) updateStory(v,pct);
  }

  function updateJourneyContext(v,pct){
    const box=$('#detailContent'); if(!box)return;
    let card=$('.journey-context',box);
    if(!card){
      card=document.createElement('div'); card.className='journey-context'; box.appendChild(card);
    }
    const phase=phaseFor(v);
    card.innerHTML=`<div class="journey-context-top"><span>Journey position</span><b>${v} / 194</b></div><div class="journey-context-track"><i></i></div><div class="journey-context-note"><span>Current chapter</span><strong>${phase.title}</strong></div>`;
  }

  function ensureExploreRoute(){
    const explore=$('.mode-switch button[data-mode="explore"]');
    if(explore && !explore.classList.contains('active')) explore.click();
    const route=$('#layerGrid button[data-layer="route"]');
    if(route && !route.classList.contains('active')) route.click();
  }

  function setPhaseFilter(phaseId){
    const button=$(`#phaseRail button[data-phase="${phaseId}"]`);
    if(button && !button.classList.contains('active')) button.click();
  }

  function setControlValue(selector,value,eventName){
    const el=$(selector); if(!el)return;
    if(el.type==='checkbox')el.checked=Boolean(value); else el.value=String(value);
    el.dispatchEvent(new Event(eventName,{bubbles:true}));
  }

  function startStory(){
    clearTimeout(story.completionTimer);
    story.active=true;
    story.phaseId=null;
    document.body.classList.add('story-mode');
    ensureExploreRoute();
    const width=$('#arcWidth'), points=$('#showPoints'), rotate=$('#autoRotate');
    story.restore.arcWidth=width?.value ?? null;
    story.restore.showPoints=points?.checked ?? null;
    story.restore.autoRotate=rotate?.checked ?? null;
    setControlValue('#arcWidth',0.18,'input');
    setControlValue('#showPoints',false,'change');
    setControlValue('#autoRotate',false,'change');

    const range=$('#routeRange');
    if(range){
      range.value='1';
      range.dispatchEvent(new Event('input',{bubbles:true}));
    }
    setTimeout(()=>{
      setPhaseFilter(1);
      updateStory(1,0);
      const play=$('#playBtn');
      if(play && play.textContent.trim()==='▶') play.click();
    },80);
  }

  function stopStory(){
    clearTimeout(story.completionTimer);
    story.active=false; story.phaseId=null;
    document.body.classList.remove('story-mode');
    const play=$('#playBtn');
    if(play && play.textContent.trim()!=='▶') play.click();
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
    const route=$('#timelineTitle')?.textContent?.trim() || `Segment ${id}`;
    const kicker=$('#storyKicker'), title=$('#storyTitle'), routeEl=$('#storyRoute'), note=$('#storyNote'), pctEl=$('#storyPct');
    if(kicker) kicker.textContent=`CHAPTER ${String(phase.id).padStart(2,'0')} / 12`;
    if(title) title.textContent=phase.title;
    if(routeEl) routeEl.textContent=route;
    if(note) note.textContent=phase.note;
    if(pctEl) pctEl.textContent=`${Math.round(pct)}%`;

    if(id===194){
      clearTimeout(story.completionTimer);
      story.completionTimer=setTimeout(()=>{
        if(!story.active)return;
        const play=$('#playBtn'); if(play && play.textContent.trim()!=='▶') play.click();
        if(kicker) kicker.textContent='JOURNEY COMPLETE';
        if(title) title.textContent='195 countries. One route.';
        if(note) note.textContent='The planned continuous route returns to Germany.';
        if(pctEl) pctEl.textContent='100%';
      },140);
    }
  }

  function wireObservers(){
    $$('.mode-switch button').forEach(b=>b.addEventListener('click',()=>setTimeout(syncMode,0)));
    $('#routeRange')?.addEventListener('input',syncProgress);
    $('#playBtn')?.addEventListener('click',()=>setTimeout(syncProgress,0));
    const p=$('#playBtn'); if(p)new MutationObserver(syncProgress).observe(p,{childList:true,characterData:true,subtree:true});

    const detail=$('#detailContent');
    if(detail)new MutationObserver(()=>setTimeout(syncProgress,0)).observe(detail,{childList:true});

    document.addEventListener('keydown',e=>{
      if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
      if(e.key==='ArrowLeft'){e.preventDefault();$('#prevBtn')?.click();}
      if(e.key==='ArrowRight'){e.preventDefault();$('#nextBtn')?.click();}
      if(e.key==='Escape' && story.active){e.preventDefault();stopStory();}
    });
  }

  function tuneGlobeDensity(){
    const width=$('#arcWidth');
    if(width && !width.dataset.iteration2Tuned){
      width.dataset.iteration2Tuned='1';
      width.value='0.34';
      width.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }

  function init(){ ensureStoryStyles(); ensureControls(); syncMode(); syncProgress(); wireObservers(); setTimeout(tuneGlobeDensity,300); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();