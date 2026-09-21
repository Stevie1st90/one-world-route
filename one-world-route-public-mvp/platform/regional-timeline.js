(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;
  let playTimer=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional timeline is not configured');
    return deps;
  }

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function stopPlayback(){
    if(playTimer){
      clearInterval(playTimer);
      playTimer=null;
    }
    const button=$('#regionalPlayBtn');
    if(button)button.textContent='▶';
  }

  function togglePlayback(){
    const d=context(),trip=d.getTrip();
    if(playTimer){
      stopPlayback();
      return;
    }
    const button=$('#regionalPlayBtn');
    if(button)button.textContent='Ⅱ';
    playTimer=setInterval(()=>{
      const selected=d.getSelectedIndex();
      if(selected>=trip.segments.length-1){
        stopPlayback();
        return;
      }
      d.selectSegment(selected+1,true);
    },1400);
  }

  function replace(){
    const d=context(),trip=d.getTrip();
    const timeline=$('#timeline');
    if(!timeline)return;
    timeline.innerHTML=`<div class="timeline-top platform-regional-timeline-top"><div class="platform-regional-playback"><button class="timeline-step" id="regionalPrevBtn" type="button" aria-label="${d.esc(d.t('previous'))}">‹</button><button class="play-btn" id="regionalPlayBtn" type="button" aria-label="Play">▶</button><button class="timeline-step" id="regionalNextBtn" type="button" aria-label="${d.esc(d.t('next'))}">›</button></div><div class="timeline-meta"><strong id="regionalTimelineTitle"></strong><span id="regionalTimelineMeta"></span></div></div><div class="range-wrap"><input id="regionalRouteRange" type="range" min="1" max="${Math.max(1,trip.segments.length)}" value="1" step="1" aria-label="${d.esc(d.t('segments'))}"/><div class="range-labels" id="regionalRangeLabels"><span></span><span></span><span></span></div></div>`;
    $('#regionalPlayBtn')?.addEventListener('click',togglePlayback);
    $('#regionalPrevBtn')?.addEventListener('click',()=>d.selectSegment(d.getSelectedIndex()-1,true));
    $('#regionalNextBtn')?.addEventListener('click',()=>d.selectSegment(d.getSelectedIndex()+1,true));
    $('#regionalRouteRange')?.addEventListener('input',event=>d.selectSegment(Number(event.currentTarget.value)-1,true));
    update();
  }

  function update(){
    const d=context(),trip=d.getTrip(),selected=d.getSelectedIndex();
    const segment=trip.segments[selected];
    if(!segment)return;
    const stops=d.stopMap(trip),places=d.placeMap(trip);
    const from=places.get(stops.get(segment.fromStopId)?.placeId);
    const to=places.get(stops.get(segment.toStopId)?.placeId);

    const title=$('#regionalTimelineTitle');
    if(title)title.textContent=`${d.local(from?.name)} → ${d.local(to?.name)}`;
    const meta=$('#regionalTimelineMeta');
    if(meta)meta.textContent=`${d.t('segment')} ${segment.sequence} / ${trip.segments.length} · ${d.facetLabel(String(segment.transport?.mode||''))}`;
    const range=$('#regionalRouteRange');
    if(range){
      range.value=String(selected+1);
      range.style.setProperty('--range-progress',`${trip.segments.length<=1?100:(selected/(trip.segments.length-1))*100}%`);
    }

    const labels=$$('#regionalRangeLabels span');
    if(labels[0])labels[0].innerHTML=`<b>${d.esc(d.t('start').toUpperCase())}</b> · ${d.esc(d.local(d.stopPlace(trip,trip.stops[0])?.name))}`;
    if(labels[1])labels[1].textContent=`${trip.planning?.days||'—'} ${d.t('days')}`;
    if(labels[2])labels[2].innerHTML=`<b>${d.esc(d.t('finish').toUpperCase())}</b> · ${d.esc(d.local(d.stopPlace(trip,trip.stops.at(-1))?.name))}`;
  }

  const api={configure,replace,update,togglePlayback,stopPlayback,isPlaying:()=>Boolean(playTimer)};
  root.regionalTimeline=api;
})();
