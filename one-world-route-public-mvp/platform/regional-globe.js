(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional globe renderer is not configured');
    return deps;
  }

  function getGlobe(){
    return window.__ONE_WORLD_ROUTE_GLOBE__||null;
  }

  function routeCamera(){
    const d=context(),trip=d.getTrip();
    const places=[...d.placeMap(trip).values()].filter(place=>Number.isFinite(Number(place.coordinates?.lat))&&Number.isFinite(Number(place.coordinates?.lng)));
    if(!places.length)return trip.rendering?.camera||{lat:20,lng:12,altitude:.8};
    const lats=places.map(place=>Number(place.coordinates.lat));
    const lngs=places.map(place=>Number(place.coordinates.lng));
    const lat=(Math.min(...lats)+Math.max(...lats))/2;
    const lng=(Math.min(...lngs)+Math.max(...lngs))/2;
    const latSpan=Math.max(...lats)-Math.min(...lats);
    const lngSpan=(Math.max(...lngs)-Math.min(...lngs))*Math.max(.35,Math.cos(lat*Math.PI/180));
    const span=Math.max(latSpan,lngSpan);
    let altitude=span<7?.15:span<13?.21:span<22?.30:span<34?.40:.54;
    if(innerWidth<=820)altitude+=.07;
    return {lat,lng,altitude};
  }

  function isolate(){
    document.body.classList.add('platform-regional-trip');
    document.body.classList.remove('story-mode','story-launching');
    window.ONE_WORLD_MOVEMENTS?.clear?.();
    const globe=getGlobe();
    if(!globe)return;
    try{
      if(typeof globe.ringsData==='function')globe.ringsData([]);
      if(typeof globe.labelsData==='function')globe.labelsData([]);
      if(typeof globe.htmlElementsData==='function')globe.htmlElementsData([]);
      if(typeof globe.onPolygonClick==='function')globe.onPolygonClick(()=>{});
      if(typeof globe.onPolygonHover==='function')globe.onPolygonHover(()=>{});
      if(typeof globe.polygonLabel==='function')globe.polygonLabel(()=> '');
      if(typeof globe.polygonCapColor==='function')globe.polygonCapColor(()=> 'rgba(16,31,46,.10)');
      if(typeof globe.polygonSideColor==='function')globe.polygonSideColor(()=> 'rgba(7,13,22,.08)');
      if(typeof globe.polygonStrokeColor==='function')globe.polygonStrokeColor(()=> 'rgba(135,166,201,.16)');
      if(typeof globe.polygonAltitude==='function')globe.polygonAltitude(()=> .001);
    }catch(error){console.warn('Regional isolation failed',error)}
  }

  function htmlLabel(place){
    const d=context();
    const anchor=document.createElement('div');
    anchor.className=`platform-globe-label-anchor ${place?._labelRole==='from'?'label-from':'label-to'}`;
    const el=document.createElement('div');
    el.className='platform-globe-label';
    const dot=document.createElement('i');
    el.appendChild(dot);
    const text=document.createElement('span');
    text.textContent=d.local(place?.name);
    el.appendChild(text);
    anchor.appendChild(el);
    return anchor;
  }

  function routeGeometry(){
    const d=context(),trip=d.getTrip();
    const stops=d.stopMap(trip),places=d.placeMap(trip);
    return d.modelRouteGeometry(trip).map(segment=>({
      ...segment,
      fromName:d.local(places.get(stops.get(segment.fromStopId)?.placeId)?.name),
      toName:d.local(places.get(stops.get(segment.toStopId)?.placeId)?.name)
    }));
  }

  function render(){
    const d=context(),trip=d.getTrip(),selected=d.getSelectedIndex();
    const globe=getGlobe();
    if(!globe)return;
    const arcs=routeGeometry();
    const places=[...d.placeMap(trip).values()];
    const active=arcs[selected];
    const fromPlaceId=active?.start&&trip.stops.find(stop=>stop.id===active.fromStopId)?.placeId;
    const toPlaceId=active?.end&&trip.stops.find(stop=>stop.id===active.toStopId)?.placeId;
    const activeIds=new Set([fromPlaceId,toPlaceId].filter(Boolean));
    const byId=d.placeMap(trip);
    const fromPlace=fromPlaceId?byId.get(fromPlaceId):null;
    const toPlace=toPlaceId?byId.get(toPlaceId):null;
    const labelPlaces=[
      ...(fromPlace?[{...fromPlace,_labelRole:'from'}]:[]),
      ...(toPlace&&toPlace.id!==fromPlace?.id?[{...toPlace,_labelRole:'to'}]:[])
    ];

    try{
      isolate();
      const settings=d.settings();
      const story=d.isStoryActive();
      const scale=Math.max(.45,settings.arcWidth/.55);
      globe.arcsData(arcs)
        .arcStartLat(item=>item.start.lat).arcStartLng(item=>item.start.lng)
        .arcEndLat(item=>item.end.lat).arcEndLng(item=>item.end.lng)
        .arcAltitude(item=>item._index===selected?.075:.045)
        .arcStroke(item=>(item._index===selected?.42:.18)*scale)
        .arcColor(item=>item._index===selected?(settings.routeGlow?['#59ddff','#ffffff']:'#59ddff'):(story?'rgba(92,124,151,.18)':'rgba(113,151,190,.62)'))
        .arcLabel(()=> '')
        .arcDashLength(item=>item._index===selected&&story?.62:1)
        .arcDashGap(item=>item._index===selected&&story?.16:0)
        .arcDashAnimateTime(item=>item._index===selected&&story&&!settings.reducedMotion?1200:0)
        .onArcClick(item=>{if(!d.isStoryActive())d.selectSegment(item._index,true)});

      globe.pointsData(settings.showPoints?places:[])
        .pointLat(place=>place.coordinates.lat).pointLng(place=>place.coordinates.lng)
        .pointAltitude(.012)
        .pointRadius(place=>activeIds.has(place.id)?.11:.065)
        .pointColor(place=>activeIds.has(place.id)?'#dff8ff':'rgba(130,185,214,.68)')
        .onPointClick(place=>{
          const index=trip.stops.findIndex(stop=>stop.placeId===place.id);
          if(index>=0)d.selectStop(index,true);
        });

      if(typeof globe.labelsData==='function')globe.labelsData([]);
      if(typeof globe.ringsData==='function')globe.ringsData([]);
      if(typeof globe.htmlElementsData==='function'){
        globe.htmlElementsData(labelPlaces)
          .htmlLat(place=>place.coordinates.lat)
          .htmlLng(place=>place.coordinates.lng)
          .htmlAltitude(.018)
          .htmlElement(htmlLabel)
          .htmlTransitionDuration(0);
      }
      if(typeof globe.onPolygonClick==='function')globe.onPolygonClick(()=>{});
      if(typeof globe.polygonLabel==='function')globe.polygonLabel(()=> '');
      if(globe.controls())globe.controls().enableZoom=true;
      updateAutoRotate();
      if(!document.body.dataset.regionalCameraReady){
        document.body.dataset.regionalCameraReady='1';
        globe.pointOfView(routeCamera(),settings.reducedMotion?0:700);
      }
    }catch(error){console.warn('Regional globe render failed',error)}
  }

  function updateAutoRotate(){
    const d=context(),controls=getGlobe()?.controls?.();
    if(!controls)return;
    controls.autoRotate=d.settings().autoRotate&&!d.isStoryActive()&&!document.body.classList.contains('terrain-view');
    controls.autoRotateSpeed=.28;
  }

  function focusRoute(){
    const d=context(),globe=getGlobe();
    if(!globe)return;
    globe.pointOfView(routeCamera(),d.settings().reducedMotion?0:650);
  }

  function focusPlace(place,altitude=.48){
    const d=context(),globe=getGlobe();
    if(!globe||!place?.coordinates)return;
    globe.pointOfView({lat:place.coordinates.lat,lng:place.coordinates.lng,altitude},d.settings().reducedMotion?0:650);
  }

  function focusSegment(segment){
    const d=context(),trip=d.getTrip();
    const stopMap=d.stopMap(trip),placeMap=d.placeMap(trip);
    const from=placeMap.get(stopMap.get(segment.fromStopId)?.placeId);
    const to=placeMap.get(stopMap.get(segment.toStopId)?.placeId);
    if(!from||!to)return;
    const lng=(from.coordinates.lng+to.coordinates.lng)/2;
    const lat=(from.coordinates.lat+to.coordinates.lat)/2;
    const spread=Math.max(
      Math.abs(Number(from.coordinates.lat)-Number(to.coordinates.lat)),
      Math.abs(Number(from.coordinates.lng)-Number(to.coordinates.lng))*Math.max(.35,Math.cos(lat*Math.PI/180))
    );
    let altitude=spread<1?.09:spread<2.5?.13:spread<5?.18:spread<10?.25:.34;
    if(innerWidth<=820)altitude+=.055;
    const globe=getGlobe();
    if(globe)globe.pointOfView({lat,lng,altitude},d.settings().reducedMotion?0:650);
  }

  const api={configure,routeCamera,isolate,routeGeometry,render,updateAutoRotate,focusRoute,focusPlace,focusSegment};
  root.regionalGlobe=api;
})();
