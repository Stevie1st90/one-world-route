(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const runtime={launchSegment:null,launchTimer:null,exiting:false};

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
    const phase=$(`#phaseRail button[data-phase="${phaseFor(id)}"]`);
    if(phase&&!phase.classList.contains('active'))phase.click();
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
      one.dataset.speed='2400';
      one.title='Cinematic · 2.4 s per segment';
    }
    const auto=$('#autoRotate');
    if(auto)auto.checked=false;
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
    document.addEventListener('click',stopPlaybackBeforeExit,true);
    document.addEventListener('click',launchStoryFromCurrent,true);
    document.addEventListener('input',preserveLaunchPosition,true);
    new MutationObserver(syncPlayMeaning).observe(document.body,{attributes:true,attributeFilter:['class']});
    syncPlayMeaning();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();