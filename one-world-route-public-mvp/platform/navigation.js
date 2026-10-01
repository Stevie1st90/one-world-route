(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  function isHomeRequest({pathname='/',search=''}={}){
    const p=new URLSearchParams(search);
    return pathname==='/'&&!p.has('trip')&&!['segment','country','phase','mode','story','view'].some(key=>p.has(key));
  }

  function buildTripUrl({id,defaultTripId='world-195',search=''}) {
    const params=new URLSearchParams(search);
    params.set('trip',id);
    for(const key of ['segment','country','phase','view','variant'])params.delete(key);
    return `/${params.toString()?`?${params}`:''}`;
  }

  function regionalUrl({tripId,locale,search='',pathname='/',terrainActive=false,variantId=null}) {
    const existing=new URLSearchParams(search);
    const params=new URLSearchParams();
    params.set('trip',tripId);
    params.set('lang',locale);
    if(existing.get('view')==='terrain'||terrainActive)params.set('view','terrain');
    if(variantId&&variantId!=='base')params.set('variant',variantId);
    return `${pathname}?${params.toString()}`;
  }

  root.navigation={buildTripUrl,regionalUrl,isHomeRequest};
})();
