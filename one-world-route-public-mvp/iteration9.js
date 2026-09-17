(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const runtime={
    globe:null,outlineReady:false,terrainMap:null,terrainReady:false,terrainBaseReady:false,
    terrainActive:false,routeData:null,centroids:null,loadPromise:null,selectedId:1,terrainFailTimer:null
  };

  const PHASE_COLORS={1:'#149fc4',2:'#315eea',3:'#12a887',4:'#2f9f5e',5:'#6743d9',6:'#b84ad8',7:'#d39418',8:'#dc6d22',9:'#de4f37',10:'#d9324d',11:'#cf4c98',12:'#3e78db'};

  function ensureStyles(){
    if($('#iteration9Styles'))return;
    const style=document.createElement('style');
    style.id='iteration9Styles';
    style.textContent=`
      #terrainMap{display:none;position:absolute;inset:0;z-index:2;background:#dfe7ec}
      body.terrain-view #terrainMap{display:block}
      body.terrain-view #globe{visibility:hidden}
      body.terrain-view .globe-stage:before{display:none!important}
      body.terrain-view .journey-btn,body.terrain-view .floating-stats{opacity:0;pointer-events:none}
      .terrain-badge{display:none;position:absolute;z-index:24;left:50%;bottom:24px;transform:translateX(-50%);padding:8px 12px;border:1px solid rgba(18,98,128,.25);border-radius:12px;background:rgba(246,250,252,.92);backdrop-filter:blur(14px);font-size:8px;letter-spacing:.06em;color:#52687a;white-space:nowrap;pointer-events:none;box-shadow:0 8px 28px rgba(0,0,0,.12)}
      body.terrain-view .terrain-badge{display:block}
      .terrain-badge b{color:#103a4a;margin-right:7px;letter-spacing:.12em}
      body.terrain-view .maplibregl-ctrl-group{background:rgba(250,252,253,.96);border:1px solid rgba(25,55,75,.14);box-shadow:0 4px 18px rgba(0,0,0,.12)}
      body.terrain-view .maplibregl-ctrl button{filter:none}
      body.terrain-view .maplibregl-ctrl-attrib{background:rgba(255,255,255,.9);color:#516779;font-size:9px}
      body.terrain-view .maplibregl-ctrl-attrib a{color:#27556c}
      body.terrain-view .phase-rail{background:rgba(246,250,252,.88);border-color:rgba(20,45,60,.14)}
      body.terrain-view .phase-rail button{color:#5b7183}
      body.terrain-view .phase-rail button.active{background:rgba(20,75,100,.1);color:#163b4d}
      @media(max-width:820px){.terrain-badge{bottom:70px;font-size:7px}.terrain-badge span{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureTerrainUi(){
    const stage=$('.globe-stage');
    if(stage&&!$('#terrainMap')){
      const map=document.createElement('div');map.id='terrainMap';stage.appendChild(map);
      const badge=document.createElement('div');badge.className='terrain-badge';badge.innerHTML='<b>3D TERRAIN</b><span>Scroll to zoom · drag to move · Ctrl/right-drag to tilt</span>';stage.appendChild(badge);
    }
    const settings=$('#settingsPopover');
    if(settings&&!$('#terrainView')){
      const label=document.createElement('label');
      label.innerHTML='<span>Real 3D terrain</span><input id="terrainView" type="checkbox" title="Switch to a bright regional 3D elevation view">';
      const high=$('#highDetailGlobe')?.closest('label');
      if(high)high.insertAdjacentElement('afterend',label);else settings.appendChild(label);
      $('#terrainView').addEventListener('change',e=>setTerrainMode(Boolean(e.target.checked)));
    }
  }

  function geometryToPaths(feature){
    const geometry=feature?.geometry;if(!geometry)return[];
    const out=[];
    const pushRing=ring=>{
      if(!Array.isArray(ring)||ring.length<2)return;
      out.push({name:feature.properties?.name||'',points:ring.map(c=>({lng:Number(c[0]),lat:Number(c[1])})).filter(p=>Number.isFinite(p.lng)&&Number.isFinite(p.lat))});
    };
    if(geometry.type==='Polygon')geometry.coordinates.forEach(pushRing);
    else if(geometry.type==='MultiPolygon')geometry.coordinates.forEach(poly=>poly.forEach(pushRing));
    return out;
  }

  async function installArtifactFreeBorders(globe){
    if(runtime.outlineReady||!globe)return;
    runtime.outlineReady=true;
    try{
      const native=globe.polygonsData?.bind(globe);
      if(native){native([]);globe.polygonsData=function(){return arguments.length===0?[]:globe;};}
    }catch{}
    try{
      const response=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',{cache:'force-cache'});
      if(!response.ok)throw new Error(String(response.status));
      const geo=await response.json();
      const paths=(geo.features||[]).flatMap(geometryToPaths).filter(p=>p.points.length>1);
      globe.pathsData(paths).pathPoints('points').pathPointLat('lat').pathPointLng('lng')
        .pathColor(()=>document.body.classList.contains('story-mode')?'rgba(133,159,190,.14)':'rgba(117,151,188,.27)')
        .pathStroke(.14).pathAltitude(.0015).pathResolution(1.5).pathTransitionDuration(0);
    }catch(err){console.warn('Artifact-free country outlines unavailable',err);}
  }

  function loadAsset(kind,url){
    return new Promise((resolve,reject)=>{
      if(kind==='style'){
        if(document.querySelector(`link[href="${url}"]`))return resolve();
        const el=document.createElement('link');el.rel='stylesheet';el.href=url;el.onload=resolve;el.onerror=reject;document.head.appendChild(el);
      }else{
        if(document.querySelector(`script[src="${url}"]`))return resolve();
        const el=document.createElement('script');el.src=url;el.onload=resolve;el.onerror=reject;document.head.appendChild(el);
      }
    });
  }

  async function loadMapLibre(){
    if(window.maplibregl)return window.maplibregl;
    if(runtime.loadPromise)return runtime.loadPromise;
    runtime.loadPromise=Promise.all([
      loadAsset('style','https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css'),
      loadAsset('script','https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.js')
    ]).then(()=>window.maplibregl);
    return runtime.loadPromise;
  }

  async function loadRouteContext(){
    if(runtime.routeData&&runtime.centroids)return;
    const [routeRes,centroidRes]=await Promise.all([
      fetch('./data/public-route.json',{cache:'force-cache'}),
      fetch('./data/country-centroids.json',{cache:'force-cache'})
    ]);
    runtime.routeData=await routeRes.json();
    const centroids=await centroidRes.json();
    runtime.centroids=new Map((centroids||[]).map(c=>[normalize(c.name),c]));
  }

  function phaseIdFor(id){
    const ranges=[[1,29],[30,39],[40,52],[53,64],[65,78],[79,95],[96,112],[113,120],[121,145],[146,169],[170,181],[182,194]];
    const i=ranges.findIndex(([a,b])=>id>=a&&id<=b);return i<0?1:i+1;
  }

  function segmentFeature(s){
    const a=runtime.centroids.get(normalize(s.from)),b=runtime.centroids.get(normalize(s.to));
    if(!a||!b)return null;
    return {type:'Feature',properties:{id:Number(s.id),phaseId:phaseIdFor(Number(s.id))},geometry:{type:'LineString',coordinates:[[Number(a.lng),Number(a.lat)],[Number(b.lng),Number(b.lat)]]}};
  }

  function routeGeoJson(){return {type:'FeatureCollection',features:(runtime.routeData?.segments||[]).map(segmentFeature).filter(Boolean)}}

  function selectedPosition(){
    const p=new URLSearchParams(location.search);
    const country=p.get('country');
    if(country){const c=runtime.centroids.get(normalize(country));if(c)return [Number(c.lng),Number(c.lat)];}
    const id=Math.max(1,Math.min(194,Number($('#routeRange')?.value||p.get('segment')||1)));
    const s=runtime.routeData?.segments?.find(x=>Number(x.id)===id),b=s&&runtime.centroids.get(normalize(s.to));
    return b?[Number(b.lng),Number(b.lat)]:[12,20];
  }

  function colorExpression(){
    const expr=['match',['get','phaseId']];
    Object.entries(PHASE_COLORS).forEach(([id,color])=>{expr.push(Number(id),color)});expr.push('#149fc4');return expr;
  }

  function firstSymbolLayer(map){return map.getStyle()?.layers?.find(l=>l.type==='symbol')?.id;}

  function installTerrainLayers(map){
    if(map.getSource('terrainSource'))return;
    map.addSource('terrainSource',{type:'raster-dem',url:'https://demotiles.maplibre.org/terrain-tiles/tiles.json',tileSize:256});
    map.addSource('hillshadeSource',{type:'raster-dem',url:'https://demotiles.maplibre.org/terrain-tiles/tiles.json',tileSize:256});
    map.addSource('routeSource',{type:'geojson',data:routeGeoJson()});
    map.setTerrain({source:'terrainSource',exaggeration:1.85});
    const before=firstSymbolLayer(map);

    map.addLayer({
      id:'oneworld-hillshade',type:'hillshade',source:'hillshadeSource',
      paint:{
        'hillshade-method':'multidirectional',
        'hillshade-exaggeration':.62,
        'hillshade-shadow-color':'#65727b',
        'hillshade-highlight-color':'#ffffff',
        'hillshade-accent-color':'#8da0aa'
      }
    },before);

    map.addLayer({id:'oneworld-route-shadow',type:'line',source:'routeSource',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(255,255,255,.9)','line-width':['interpolate',['linear'],['zoom'],3,3.4,8,6.2,13,9.2]}},before);
    map.addLayer({id:'oneworld-routes',type:'line',source:'routeSource',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':.94,'line-width':['interpolate',['linear'],['zoom'],3,1.7,8,3.5,13,5.4]}},before);
    map.addLayer({id:'oneworld-selected-route',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#09191f','line-width':['interpolate',['linear'],['zoom'],3,3,8,5.6,13,8.2]}},before);
  }

  function failTerrain(message){
    console.warn(message);
    runtime.terrainActive=false;
    document.body.classList.remove('terrain-view');
    const toggle=$('#terrainView');if(toggle)toggle.checked=false;
  }

  async function initTerrainMap(){
    if(runtime.terrainReady)return;
    await loadRouteContext();
    const maplibregl=await loadMapLibre();
    const center=selectedPosition();

    const map=new maplibregl.Map({
      container:'terrainMap',
      style:'https://demotiles.maplibre.org/style.json',
      center,zoom:8.2,pitch:72,bearing:-18,maxZoom:18,maxPitch:85,attributionControl:true,
      renderWorldCopies:false,
      canvasContextAttributes:{antialias:true}
    });

    clearTimeout(runtime.terrainFailTimer);
    runtime.terrainFailTimer=setTimeout(()=>{
      if(runtime.terrainActive&&!runtime.terrainBaseReady)failTerrain('3D terrain basemap did not finish loading; returning to standard globe.');
    },9000);

    map.on('load',()=>{
      try{
        installTerrainLayers(map);
        runtime.terrainBaseReady=true;
        clearTimeout(runtime.terrainFailTimer);
        syncTerrainSelection({fly:false});
        syncTerrainPhase();
      }catch(err){
        console.error('Terrain layers could not be installed',err);
        failTerrain('3D terrain layers failed; returning to standard globe.');
      }
    });

    map.on('error',e=>{
      const msg=String(e?.error?.message||'');
      if(/style|source|tile|terrain/i.test(msg))console.warn('Terrain map resource error',e.error);
    });

    map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
    if(maplibregl.TerrainControl)map.addControl(new maplibregl.TerrainControl({source:'terrainSource',exaggeration:1.85}),'top-right');

    runtime.terrainMap=map;
    runtime.terrainReady=true;
  }

  function syncTerrainSelection({fly=false}={}){
    const map=runtime.terrainMap;if(!map)return;
    runtime.selectedId=Math.max(1,Math.min(194,Number($('#routeRange')?.value||1)));
    if(map.getLayer?.('oneworld-selected-route'))map.setFilter('oneworld-selected-route',['==',['get','id'],runtime.selectedId]);
    if(!fly)return;
    const p=selectedPosition();
    map.easeTo({center:p,zoom:Math.max(map.getZoom(),8.2),pitch:Math.max(map.getPitch(),72),bearing:-18,duration:1050,essential:true});
  }

  function syncTerrainPhase(){
    const map=runtime.terrainMap;if(!map||!map.getLayer?.('oneworld-routes'))return;
    const phase=new URLSearchParams(location.search).get('phase');
    const filter=phase&&phase!=='all'?['==',['get','phaseId'],Number(phase)]:null;
    map.setFilter('oneworld-routes',filter);
    map.setFilter('oneworld-route-shadow',filter);
  }

  async function setTerrainMode(active){
    if(active&&document.body.classList.contains('story-mode')){const toggle=$('#terrainView');if(toggle)toggle.checked=false;return;}
    runtime.terrainActive=active;
    document.body.classList.toggle('terrain-view',active);

    const high=$('#highDetailGlobe');
    if(active&&high)high.disabled=true;
    if(!active&&high)high.disabled=false;

    if(!active){runtime.terrainMap?.resize?.();return;}

    try{
      await initTerrainMap();
      runtime.terrainMap.resize();
      setTimeout(()=>{
        runtime.terrainMap.resize();
        if(runtime.terrainBaseReady){syncTerrainSelection({fly:true});syncTerrainPhase();}
      },180);
    }catch(err){
      console.error('3D terrain mode unavailable',err);
      failTerrain('3D terrain initialization failed; returning to standard globe.');
    }
  }

  function findGlobe(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;if(!globe)return setTimeout(findGlobe,100);
    runtime.globe=globe;installArtifactFreeBorders(globe);
  }

  function wire(){
    ensureStyles();ensureTerrainUi();findGlobe();
    $('#routeRange')?.addEventListener('input',()=>{runtime.selectedId=Number($('#routeRange')?.value||1);if(runtime.terrainActive)setTimeout(()=>syncTerrainSelection({fly:true}),0)});
    $('#phaseRail')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(syncTerrainPhase,80)});
    new MutationObserver(()=>{
      if(document.body.classList.contains('story-mode')&&runtime.terrainActive){const t=$('#terrainView');if(t)t.checked=false;setTerrainMode(false);}
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',()=>runtime.terrainMap?.resize?.(),{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();