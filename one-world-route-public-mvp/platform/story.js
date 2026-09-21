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
