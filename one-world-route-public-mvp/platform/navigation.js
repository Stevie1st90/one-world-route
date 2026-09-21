(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  function buildTripUrl({id,defaultTripId='world-195',search=''}) {
    const params=new URLSearchParams(search);
    if(id===defaultTripId)params.delete('trip');
    else params.set('trip',id);
    for(const key of ['segment','country','phase','view'])params.delete(key);
    return `/${params.toString()?`?${params}`:''}`;
  }

  function regionalUrl({tripId,locale,search='',pathname='/',terrainActive=false}) {
    const existing=new URLSearchParams(search);
    const params=new URLSearchParams();
    params.set('trip',tripId);
    params.set('lang',locale);
    if(existing.get('view')==='terrain'||terrainActive)params.set('view','terrain');
    return `${pathname}?${params.toString()}`;
  }

  root.navigation={buildTripUrl,regionalUrl};
})();
