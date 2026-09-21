(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const state={map:null,ready:false,loading:null,maplibre:null,highDetailWasDisabled:null,autoRotateWasDisabled:null};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional terrain controller is not configured');
    return deps;
  }

  function routeGeoJson(){
    const d=context(),selected=d.getSelectedIndex();
    return {
      type:'FeatureCollection',
      features:d.routeGeometry().map(item=>({
        type:'Feature',
        properties:{id:item._index+1,active:item._index===selected?1:0,mode:item.transport?.mode||''},
        geometry:{type:'LineString',coordinates:[[Number(item.start.lng),Number(item.start.lat)],[Number(item.end.lng),Number(item.end.lat)]]}
      }))
    };
  }

  function stopGeoJson(){
    const d=context(),trip=d.getTrip();
    return {
      type:'FeatureCollection',
      features:[...d.placeMap(trip).values()]
        .filter(place=>place.coordinates)
        .map(place=>({
          type:'Feature',
          properties:{id:place.id,name:d.local(place.name)},
          geometry:{type:'Point',coordinates:[Number(place.coordinates.lng),Number(place.coordinates.lat)]}
        }))
    };
  }

  function focusRoute(){
    const d=context(),bounds=d.routeBounds();
    if(!state.map||!bounds)return;
    const padding=innerWidth<=820?{top:90,right:26,bottom:132,left:26}:{top:78,right:380,bottom:90,left:330};
    state.map.fitBounds(bounds,{padding,maxZoom:7.4,duration:d.settings().reducedMotion?0:750,essential:true});
  }

  async function loadMapLibre(){
    if(state.maplibre)return state.maplibre;
    if(!document.querySelector('link[data-platform-maplibre]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css';
      link.dataset.platformMaplibre='1';
      document.head.appendChild(link);
    }
    const module=await import('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs');
    if(typeof module?.Map!=='function')throw new Error('MapLibre unavailable');
    state.maplibre=module;
    return module;
  }

  async function style(){
    const d=context(),mapStyle=root.mapStyle;
    if(!mapStyle)throw new Error('ONE WORLD ROUTE map style module unavailable');
    let base;
    try{
      const response=await fetch('https://tiles.openfreemap.org/styles/liberty',{cache:'force-cache'});
      if(!response.ok)throw new Error(String(response.status));
      base=await response.json();
    }catch{
      base={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#d9e5e8'}}]};
    }
    base=mapStyle.brandDark(mapStyle.localize(base,d.locale()));
    base.version=8;
    base.projection={type:'globe'};
    base.sources={...(base.sources||{}),
      terrainSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
      regionalRoute:{type:'geojson',data:routeGeoJson()},
      regionalStops:{type:'geojson',data:stopGeoJson()}
    };
    base.terrain={source:'terrainSource',exaggeration:1.34};
    base.sky={'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.42,3.5,.13,7,0]};
    const selected=d.getSelectedIndex();
    base.layers.push(
      {id:'regional-route-shadow',type:'line',source:'regionalRoute',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(1,8,15,.68)','line-width':['interpolate',['linear'],['zoom'],2,3,7,6,12,9],'line-opacity':.58}},
      {id:'regional-route',type:'line',source:'regionalRoute',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#6c8eaa','line-width':['interpolate',['linear'],['zoom'],2,1.4,7,2.8,12,4.2],'line-opacity':.78}},
      {id:'regional-selected-shadow',type:'line',source:'regionalRoute',filter:['==',['get','id'],selected+1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(2,8,14,.88)','line-width':['interpolate',['linear'],['zoom'],2,6,7,10,12,15]}},
      {id:'regional-selected',type:'line',source:'regionalRoute',filter:['==',['get','id'],selected+1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#59ddff','line-width':['interpolate',['linear'],['zoom'],2,2.8,7,5.2,12,7.5]}},
      {id:'regional-route-hit',type:'line',source:'regionalRoute',paint:{'line-color':'rgba(0,0,0,.001)','line-width':18,'line-opacity':.001}},
      {id:'regional-stop-points',type:'circle',source:'regionalStops',paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,3,8,5,12,7],'circle-color':'#dff8ff','circle-stroke-width':2,'circle-stroke-color':'#1388a7'}}
    );
    return base;
  }

  async function ensure(){
    if(state.ready&&state.map)return state.map;
    if(state.loading)return state.loading;
    state.loading=(async()=>{
      const d=context();
      let host=document.querySelector('#terrainMap');
      if(!host){
        host=document.createElement('div');
        host.id='terrainMap';
        document.querySelector('.globe-stage')?.appendChild(host);
      }
      let badge=document.querySelector('.terrain-badge');
      if(!badge){
        badge=document.createElement('div');
        badge.className='terrain-badge';
        badge.innerHTML='<b>3D GLOBE TERRAIN</b><span></span>';
        document.querySelector('.globe-stage')?.appendChild(badge);
      }
      const [maplibre,mapStyle]=await Promise.all([loadMapLibre(),style()]);
      const cam=d.routeCamera();
      const map=new maplibre.Map({container:'terrainMap',style:mapStyle,center:[cam.lng,cam.lat],zoom:4.6,pitch:36,bearing:-5,minZoom:2.5,maxZoom:18,maxPitch:65,renderWorldCopies:false,attributionControl:false,canvasContextAttributes:{antialias:true}});
      map.on('style.load',()=>{try{map.setProjection({type:'globe'});map.setTerrain({source:'terrainSource',exaggeration:1.34})}catch{}});
      map.on('load',()=>{
        map.on('click','regional-route-hit',event=>{
          const id=Number(event.features?.[0]?.properties?.id);
          if(Number.isFinite(id))d.selectSegment(id-1,true);
        });
        map.on('mouseenter','regional-route-hit',()=>map.getCanvas().style.cursor='pointer');
        map.on('mouseleave','regional-route-hit',()=>map.getCanvas().style.cursor='');
      });
      map.addControl(new maplibre.AttributionControl({compact:true}),'bottom-left');
      if(innerWidth>820){
        map.addControl(new maplibre.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
        if(maplibre.TerrainControl)map.addControl(new maplibre.TerrainControl({source:'terrainSource',exaggeration:1.34}),'top-right');
        if(maplibre.GlobeControl)map.addControl(new maplibre.GlobeControl(),'top-right');
      }
      await new Promise(resolve=>{
        if(map.loaded?.())resolve();
        else map.once('load',resolve);
      });
      state.map=map;
      state.ready=true;
      window.__ONE_WORLD_REGIONAL_TERRAIN__=map;
      return map;
    })().finally(()=>{state.loading=null});
    return state.loading;
  }

  function update(){
    const d=context(),map=state.map;
    if(!map)return;
    map.getSource?.('regionalRoute')?.setData?.(routeGeoJson());
    map.getSource?.('regionalStops')?.setData?.(stopGeoJson());
    for(const id of ['regional-selected','regional-selected-shadow']){
      if(map.getLayer?.(id))map.setFilter(id,['==',['get','id'],d.getSelectedIndex()+1]);
    }
    const settings=d.settings();
    if(map.getLayer?.('regional-stop-points'))map.setLayoutProperty('regional-stop-points','visibility',settings.showPoints?'visible':'none');
    if(map.getLayer?.('regional-route'))map.setPaintProperty('regional-route','line-opacity',settings.routeGlow?.82:.48);
  }

  function focusSegment(index=context().getSelectedIndex()){
    const d=context(),seg=d.routeGeometry()[index];
    if(!state.map||!seg)return;
    const a=[Number(seg.start.lng),Number(seg.start.lat)],b=[Number(seg.end.lng),Number(seg.end.lat)];
    const lng=(a[0]+b[0])/2,lat=(a[1]+b[1])/2;
    const spread=Math.max(Math.abs(a[0]-b[0])*Math.cos(lat*Math.PI/180),Math.abs(a[1]-b[1]));
    const zoom=spread<.5?9.2:spread<1.5?7.9:spread<4?6.7:spread<9?5.5:4.6;
    state.map.easeTo({center:[lng,lat],zoom:innerWidth<=820?zoom-.25:zoom,pitch:spread<4?46:34,bearing:0,duration:d.settings().reducedMotion?0:700,essential:true});
  }

  function restoreControls(){
    const high=document.querySelector('#highDetailGlobe');
    const auto=document.querySelector('#autoRotate');
    if(high&&state.highDetailWasDisabled!==null){
      high.disabled=state.highDetailWasDisabled;
      state.highDetailWasDisabled=null;
    }
    if(auto&&state.autoRotateWasDisabled!==null){
      auto.disabled=state.autoRotateWasDisabled;
      state.autoRotateWasDisabled=null;
    }
  }

  async function setActive(active){
    const d=context(),trip=d.getTrip(),meta=d.getTripMeta();
    if(!trip||meta?.renderer==='legacy-world'||!d.hasCapability(meta,'terrain'))return;
    const toggle=document.querySelector('#terrainView');
    if(toggle)toggle.checked=Boolean(active);
    if(!active){
      document.body.classList.remove('terrain-loading','terrain-view');
      restoreControls();
      d.setViewParam(false);
      d.renderRoute();
      return;
    }
    if(d.isStoryActive())d.stopStory();
    const high=document.querySelector('#highDetailGlobe');
    const auto=document.querySelector('#autoRotate');
    if(high){
      if(state.highDetailWasDisabled===null)state.highDetailWasDisabled=high.disabled;
      high.disabled=true;
    }
    if(auto){
      if(state.autoRotateWasDisabled===null)state.autoRotateWasDisabled=auto.disabled;
      auto.disabled=true;
    }
    document.body.classList.add('terrain-loading');
    const badge=document.querySelector('.terrain-badge span');
    if(badge)badge.textContent=d.t('terrainLoading');
    try{
      const map=await ensure();
      map.resize();
      update();
      document.body.classList.remove('terrain-loading');
      document.body.classList.add('terrain-view');
      focusRoute();
      if(badge)badge.textContent=d.t('terrainHint');
      d.setViewParam(true);
    }catch(error){
      console.warn('Regional terrain unavailable',error);
      document.body.classList.remove('terrain-loading','terrain-view');
      if(toggle)toggle.checked=false;
      restoreControls();
      d.toast(d.t('terrainUnavailable'));
    }
  }

  const api={
    configure,
    routeGeoJson,
    stopGeoJson,
    focusRoute,
    style,
    ensure,
    update,
    focusSegment,
    setActive,
    isReady:()=>state.ready,
    getMap:()=>state.map
  };
  root.terrain=api;
})();
