(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const runtime={
    globe:null,
    outlineReady:false,
    terrainMap:null,
    terrainReady:false,
    terrainActive:false,
    routeData:null,
    centroids:null,
    loadPromise:null,
    selectedId:1
  };

  const PHASE_COLORS={
    1:'#59ddff',2:'#4f7cff',3:'#42e6c4',4:'#7be495',5:'#9276ff',6:'#e47cff',
    7:'#ffcf62',8:'#ff9b55',9:'#ff704f',10:'#ff4d67',11:'#ff8acb',12:'#79a7ff'
  };

  function ensureStyles(){
    if($('#iteration9Styles'))return;
    const style=document.createElement('style');
    style.id='iteration9Styles';
    style.textContent=`
      #terrainMap{display:none;position:absolute;inset:0;z-index:2;background:#05070d}
      body.terrain-view #terrainMap{display:block}
      body.terrain-view #globe{visibility:hidden}
      body.terrain-view .journey-btn,body.terrain-view .floating-stats{opacity:0;pointer-events:none}
      .terrain-badge{display:none;position:absolute;z-index:24;left:50%;bottom:24px;transform:translateX(-50%);padding:8px 12px;border:1px solid rgba(89,221,255,.2);border-radius:12px;background:rgba(6,12,21,.78);backdrop-filter:blur(14px);font-size:8px;letter-spacing:.06em;color:#91a6be;white-space:nowrap;pointer-events:none}
      body.terrain-view .terrain-badge{display:block}
      .terrain-badge b{color:#dff8ff;margin-right:7px;letter-spacing:.12em}
      body.terrain-view .maplibregl-ctrl-group{background:rgba(7,13,22,.82);border:1px solid rgba(255,255,255,.1);box-shadow:none}
      body.terrain-view .maplibregl-ctrl button{filter:invert(1) brightness(1.35)}
      body.terrain-view .maplibregl-ctrl-attrib{background:rgba(5,8,14,.72);color:#7d91a9;font-size:9px}
      body.terrain-view .maplibregl-ctrl-attrib a{color:#a8bdd4}
      @media(max-width:820px){.terrain-badge{bottom:70px;font-size:7px}.terrain-badge span{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureTerrainUi(){
    const stage=$('.globe-stage');
    if(stage&&!$('#terrainMap')){
      const map=document.createElement('div');map.id='terrainMap';stage.appendChild(map);
      const badge=document.createElement('div');badge.className='terrain-badge';badge.innerHTML='<b>3D TERRAIN</b><span>Scroll to zoom · drag to rotate · Ctrl/right-drag to tilt</span>';stage.appendChild(badge);
    }
    const settings=$('#settingsPopover');
    if(settings&&!$('#terrainView')){
      const label=document.createElement('label');
      label.innerHTML='<span>Real 3D terrain</span><input id="terrainView" type="checkbox" title="Switch to streamed satellite imagery with real elevation terrain">';
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
    if(geometry.type==='Polygon') geometry.coordinates.forEach(pushRing);
    else if(geometry.type==='MultiPolygon') geometry.coordinates.forEach(poly=>poly.forEach(pushRing));
    return out;
  }

  async function installArtifactFreeBorders(globe){
    if(runtime.outlineReady||!globe)return;
    runtime.outlineReady=true;

    try{
      const native=globe.polygonsData?.bind(globe);
      if(native){
        native([]);
        globe.polygonsData=function(value){
          if(arguments.length===0)return [];
          return globe;
        };
      }
    }catch{}

    try{
      const response=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',{cache:'force-cache'});
      if(!response.ok)throw new Error(String(response.status));
      const geo=await response.json();
      const paths=(geo.features||[]).flatMap(geometryToPaths).filter(p=>p.points.length>1);
      globe
        .pathsData(paths)
        .pathPoints('points')
        .pathPointLat('lat')
        .pathPointLng('lng')
        .pathColor(()=>document.body.classList.contains('story-mode')?'rgba(133,159,190,.16)':'rgba(117,151,188,.30)')
        .pathStroke(.16)
        .pathAltitude(.0015)
        .pathResolution(1.5)
        .pathTransitionDuration(0);
    }catch(err){
      console.warn('Artifact-free country outlines unavailable',err);
    }
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
    const route=await routeRes.json();
    const centroids=await centroidRes.json();
    runtime.routeData=route;
    runtime.centroids=new Map((centroids||[]).map(c=>[normalize(c.name),c]));
  }

  function segmentFeature(s){
    const a=runtime.centroids.get(normalize(s.from));
    const b=runtime.centroids.get(normalize(s.to));
    if(!a||!b)return null;
    return {
      type:'Feature',
      properties:{id:Number(s.id),phaseId:Number(s.phaseId||0)},
      geometry:{type:'LineString',coordinates:[[Number(a.lng),Number(a.lat)],[Number(b.lng),Number(b.lat)]]}
    };
  }

  function phaseIdFor(id){
    const ranges=[[1,29],[30,39],[40,52],[53,64],[65,78],[79,95],[96,112],[113,120],[121,145],[146,169],[170,181],[182,194]];
    const i=ranges.findIndex(([a,b])=>id>=a&&id<=b);return i<0?1:i+1;
  }

  function routeGeoJson(){
    return {type:'FeatureCollection',features:(runtime.routeData?.segments||[]).map(s=>{
      const f=segmentFeature(s);if(f)f.properties.phaseId=phaseIdFor(Number(s.id));return f;
    }).filter(Boolean)};
  }

  function selectedPosition(){
    const p=new URLSearchParams(location.search);
    const country=p.get('country');
    if(country){
      const c=runtime.centroids.get(normalize(country));
      if(c)return [Number(c.lng),Number(c.lat)];
    }
    const id=Math.max(1,Math.min(194,Number($('#routeRange')?.value||p.get('segment')||1)));
    const s=runtime.routeData?.segments?.find(x=>Number(x.id)===id);
    const b=s&&runtime.centroids.get(normalize(s.to));
    return b?[Number(b.lng),Number(b.lat)]:[12,20];
  }

  function colorExpression(){
    const expr=['match',['get','phaseId']];
    Object.entries(PHASE_COLORS).forEach(([id,color])=>{expr.push(Number(id),color)});
    expr.push('#59ddff');
    return expr;
  }

  async function initTerrainMap(){
    if(runtime.terrainReady)return;
    await loadRouteContext();
    const maplibregl=await loadMapLibre();
    const center=selectedPosition();

    const map=new maplibregl.Map({
      container:'terrainMap',
      center,
      zoom:3.2,
      pitch:38,
      bearing:0,
      maxPitch:85,
      attributionControl:true,
      canvasContextAttributes:{antialias:true},
      style:{
        version:8,
        projection:{type:'globe'},
        sources:{
          satellite:{
            type:'raster',
            tiles:['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
            tileSize:256,
            attribution:'Satellite imagery: Sentinel-2 cloudless © EOX / ESA'
          },
          terrainSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
          routeSource:{type:'geojson',data:routeGeoJson()}
        },
        terrain:{source:'terrainSource',exaggeration:1.35},
        sky:{'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,3,0]},
        layers:[
          {id:'background',type:'background',paint:{'background-color':'#05070d'}},
          {id:'satellite',type:'raster',source:'satellite',paint:{'raster-opacity':.88,'raster-saturation':-.25,'raster-contrast':.18,'raster-brightness-max':.72}},
          {id:'hillshade',type:'hillshade',source:'terrainSource',paint:{'hillshade-exaggeration':.42,'hillshade-shadow-color':'#07101a','hillshade-highlight-color':'#bed9e8','hillshade-accent-color':'#406b84'}},
          {id:'route-shadow',type:'line',source:'routeSource',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(0,0,0,.72)','line-width':['interpolate',['linear'],['zoom'],2,2,7,5,12,8]}},
          {id:'routes',type:'line',source:'routeSource',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':.78,'line-width':['interpolate',['linear'],['zoom'],2,1.1,7,2.4,12,4]}},
          {id:'selected-route',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],2,2.2,7,4.5,12,7]}}
        ]
      }
    });

    map.on('style.load',()=>{
      try{map.setProjection({type:'globe'});}catch{}
      try{map.setTerrain({source:'terrainSource',exaggeration:1.35});}catch{}
    });
    map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
    if(maplibregl.TerrainControl)map.addControl(new maplibregl.TerrainControl({source:'terrainSource',exaggeration:1.35}),'top-right');
    if(maplibregl.GlobeControl)map.addControl(new maplibregl.GlobeControl(),'top-right');

    runtime.terrainMap=map;
    runtime.terrainReady=true;
  }

  function syncTerrainSelection({fly=false}={}){
    const map=runtime.terrainMap;if(!map)return;
    runtime.selectedId=Math.max(1,Math.min(194,Number($('#routeRange')?.value||1)));
    if(map.getLayer?.('selected-route'))map.setFilter('selected-route',['==',['get','id'],runtime.selectedId]);
    if(!fly)return;
    const s=runtime.routeData?.segments?.find(x=>Number(x.id)===runtime.selectedId);
    const c=s&&runtime.centroids.get(normalize(s.to));
    if(c){
      map.easeTo({center:[Number(c.lng),Number(c.lat)],zoom:Math.max(map.getZoom(),5.2),pitch:Math.max(map.getPitch(),58),duration:900,essential:true});
    }
  }

  function syncTerrainPhase(){
    const map=runtime.terrainMap;if(!map||!map.getLayer?.('routes'))return;
    const phase=new URLSearchParams(location.search).get('phase');
    const filter=phase&&phase!=='all'?['==',['get','phaseId'],Number(phase)]:null;
    map.setFilter('routes',filter);
    map.setFilter('route-shadow',filter);
  }

  async function setTerrainMode(active){
    if(active&&document.body.classList.contains('story-mode')){
      const toggle=$('#terrainView');if(toggle)toggle.checked=false;
      return;
    }
    runtime.terrainActive=active;
    document.body.classList.toggle('terrain-view',active);
    if(!active){runtime.terrainMap?.resize?.();return;}
    try{
      await initTerrainMap();
      runtime.terrainMap.resize();
      setTimeout(()=>{runtime.terrainMap.resize();syncTerrainSelection({fly:true});syncTerrainPhase();},120);
    }catch(err){
      console.error('3D terrain mode unavailable',err);
      runtime.terrainActive=false;
      document.body.classList.remove('terrain-view');
      const toggle=$('#terrainView');if(toggle)toggle.checked=false;
    }
  }

  function findGlobe(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    if(!globe)return setTimeout(findGlobe,100);
    runtime.globe=globe;
    installArtifactFreeBorders(globe);
  }

  function wire(){
    ensureStyles();ensureTerrainUi();findGlobe();
    $('#routeRange')?.addEventListener('input',()=>{runtime.selectedId=Number($('#routeRange')?.value||1);if(runtime.terrainActive)setTimeout(()=>syncTerrainSelection({fly:true}),0)});
    $('#phaseRail')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(syncTerrainPhase,80)});
    new MutationObserver(()=>{
      if(document.body.classList.contains('story-mode')&&runtime.terrainActive){
        const t=$('#terrainView');if(t)t.checked=false;setTerrainMode(false);
      }
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',()=>runtime.terrainMap?.resize?.(),{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
