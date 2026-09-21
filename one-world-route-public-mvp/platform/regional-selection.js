(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;
  let selectedIndex=0;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional selection is not configured');
    return deps;
  }

  function clamp(index){
    const trip=context().getTrip();
    return Math.max(0,Math.min(Math.max(0,trip.segments.length-1),Number(index)||0));
  }

  function reset(index=0){
    selectedIndex=clamp(index);
    return selectedIndex;
  }

  function getIndex(){
    return selectedIndex;
  }

  function selectSegment(index,focus=false){
    const d=context(),trip=d.getTrip();
    selectedIndex=clamp(index);
    document.querySelectorAll('.platform-stop').forEach(node=>node.classList.remove('active'));
    d.renderGlobe();
    d.updateTimeline();
    d.renderSegmentDetail(trip.segments[selectedIndex]);
    d.updateTerrain();
    if(d.isStoryActive())d.updateStory();
    if(focus){
      if(d.isTerrainActive())d.focusTerrainSegment(selectedIndex);
      else d.focusGlobeSegment(trip.segments[selectedIndex]);
    }
    return selectedIndex;
  }

  function selectStop(index,focus=false){
    const d=context(),trip=d.getTrip();
    const stop=trip.stops[index];
    const place=d.stopPlace(trip,stop);
    if(!stop||!place)return selectedIndex;

    document.querySelectorAll('.platform-stop').forEach((node,nodeIndex)=>node.classList.toggle('active',nodeIndex===index));
    d.renderStopDetail(stop,place);

    if(index<trip.segments.length){
      selectedIndex=clamp(index);
      d.updateTimeline();
      d.renderGlobe();
      d.updateTerrain();
    }

    if(focus){
      if(d.isTerrainActive())d.focusTerrainSegment(Math.min(index,trip.segments.length-1));
      else d.focusGlobePlace(place);
    }
    return selectedIndex;
  }

  const api={configure,reset,getIndex,selectSegment,selectStop};
  root.regionalSelection=api;
})();
