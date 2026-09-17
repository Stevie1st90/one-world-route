(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const runtime={
    globe:null,outlineReady:false,terrainMap:null,terrainReady:false,terrainBaseReady:false,
    terrainActive:false,terrainRequested:false,routeData:null,centroids:null,loadPromise:null,
    selectedId:1,terrainFailTimer:null,countryFeatures:[],countryNames:new Map()
  };

  const PHASE_COLORS={1:'#149fc4',2:'#315eea',3:'#12a887',4:'#2f9f5e',5:'#6743d9',6:'#b84ad8',7:'#d39418',8:'#dc6d22',9:'#de4f37',10:'#d9324d',11:'#cf4c98',12:'#3e78db'};

  function ensureStyles(){
    if($('#iteration9Styles'))return;
    const style=document.createElement('style');
    style.id='iteration9Styles';
    style.textContent=`
      #terrainMap{display:none;position:absolute;inset:0;z-index:3;background:#071019}
      body.terrain-loading #terrainMap{display:block;opacity:0;pointer-events:none}
      body.terrain-view #terrainMap{display:block;opacity:1}
      body.terrain-view #globe{visibility:hidden}
      body.terrain-view .globe-stage:before,body.terrain-view .globe-stage:after{display:none!important}
      body.terrain-view .journey-btn,body.terrain-view .floating-stats{opacity:0;pointer-events:none}
      body.terrain-view .left-panel,body.terrain-view .right-panel{background:rgba(7,14,24,.88);border-color:rgba(145,179,211,.18);backdrop-filter:blur(22px)}
      body.terrain-view .settings-popover{background:rgba(7,14,24,.94);border-color:rgba(145,179,211,.18)}
      .terrain-badge{display:none;position:absolute;z-index:24;left:50%;bottom:24px;transform:translateX(-50%);padding:8px 12px;border:1px solid rgba(89,221,255,.22);border-radius:12px;background:rgba(7,14,24,.9);backdrop-filter:blur(14px);font-size:8px;letter-spacing:.06em;color:#92a8bd;white-space:nowrap;pointer-events:none;box-shadow:0 8px 28px rgba(0,0,0,.2)}
      body.terrain-loading .terrain-badge,body.terrain-view .terrain-badge{display:block}
      .terrain-badge b{color:#dff8ff;margin-right:7px;letter-spacing:.12em}
      body.terrain-view .maplibregl-ctrl-group{background:rgba(248,250,251,.97);border:1px solid rgba(25,55,75,.14);box-shadow:0 4px 18px rgba(0,0,0,.12)}
      body.terrain-view .maplibregl-ctrl button{filter:none}
      body.terrain-view .maplibregl-ctrl-attrib{background:rgba(7,14,24,.82);color:#91a6ba;font-size:9px}
      body.terrain-view .maplibregl-ctrl-attrib a{color:#b7d0e4}
      body.terrain-view .phase-rail{background:rgba(7,14,24,.82);border-color:rgba(145,179,211,.16);box-shadow:0 8px 24px rgba(0,0,0,.16)}
      body.terrain-view .phase-rail button{color:#8499af}
      body.terrain-view .phase-rail button.active{background:rgba(255,255,255,.08);color:#eef8ff}
      @media(max-width:820px){.terrain-badge{bottom:70px;font-size:7px}.terrain-badge span{display:none}}
    `;
    document.head.appendChild(style);
  }

  function setToggleState(active){const t=$('#terrainView');if(t)t.checked=Boolean(active)}
  function setTerrainLabel(text){const t=$('#terrainView');const span=t?.closest('label')?.querySelector('span');if(span)span.textContent=text}

  function notify(message){
    const toast=$('#toast');if(!toast)return;
    toast.textContent=message;toast.classList.add('show');clearTimeout(toast._terrainTimer);
    toast._terrainTimer=setTimeout(()=>toast.classList.remove('show'),3200);
  }

  function updateViewUrl(active){
    const p=new URLSearchParams(location.search);
    if(active)p.set('view','terrain');else p.delete('view');
    history.replaceState(null,'',`${location.pathname}${p.toString()?`?${p}`:''}`);
  }

  function urlSegmentId(){
    const raw=new URLSearchParams(location.search).get('segment');
    if(raw===null)return null;
    const n=Number(raw);return Number.isFinite(n)?clamp(Math.round(n),1,194):null;
  }

  function currentSegmentId(){
    const range=$('#routeRange');
    if(range&&range.value!=='')return clamp(Number(range.value)||1,1,194);
    const fromUrl=urlSegmentId();
    return fromUrl!==null?fromUrl:1;
  }

  function syncSliderFromUrl(){
    const id=urlSegmentId(),range=$('#routeRange');
    if(id===null||!range||Number(range.value)===id)return;
    range.value=String(id);range.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function ensureTerrainUi(){
    const stage=$('.globe-stage');
    if(stage&&!$('#terrainMap')){
      const map=document.createElement('div');map.id='terrainMap';stage.appendChild(map);
      const badge=document.createElement('div');badge.className='terrain-badge';badge.innerHTML='<b>3D GLOBE TERRAIN</b><span>Loading terrain…</span>';stage.appendChild(badge);
    }
    const settings=$('#settingsPopover');
    if(settings&&!$('#terrainView')){
      const label=document.createElement('label');
      label.innerHTML='<span>Real 3D globe terrain</span><input id="terrainView" type="checkbox" title="Switch to a spherical globe with real elevation terrain">';
      const high=$('#highDetailGlobe')?.closest('label');
      if(high)high.insertAdjacentElement('afterend',label);else settings.appendChild(label);
    }
    const toggle=$('#terrainView');
    if(toggle&&!toggle.dataset.terrainWired){
      toggle.dataset.terrainWired='1';toggle.checked=false;
      toggle.addEventListener('change',()=>setTerrainMode(toggle.checked));
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

  function unwrapLng(value,reference){
    let v=Number(value);
    while(v-reference>180)v-=360;
    while(v-reference<-180)v+=360;
    return v;
  }

  function ringContains(lng,lat,ring){
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const xi=unwrapLng(ring[i][0],lng),yi=Number(ring[i][1]);
      const xj=unwrapLng(ring[j][0],lng),yj=Number(ring[j][1]);
      const crosses=((yi>lat)!==(yj>lat))&&(lng<(xj-xi)*(lat-yi)/((yj-yi)||1e-12)+xi);
      if(crosses)inside=!inside;
    }
    return inside;
  }

  function polygonContains(lng,lat,polygon){
    if(!polygon?.length||!ringContains(lng,lat,polygon[0]))return false;
    for(let i=1;i<polygon.length;i++)if(ringContains(lng,lat,polygon[i]))return false;
    return true;
  }

  function featureContains(feature,lng,lat){
    const g=feature?.geometry;if(!g)return false;
    if(g.type==='Polygon')return polygonContains(lng,lat,g.coordinates);
    if(g.type==='MultiPolygon')return g.coordinates.some(poly=>polygonContains(lng,lat,poly));
    return false;
  }

  function activateCountry(name){
    const input=$('#inlineSearch');if(!input||!name)return;
    input.value=name;input.dispatchEvent(new Event('input',{bubbles:true}));
    requestAnimationFrame(()=>{
      const hit=[...document.querySelectorAll('#searchResults .search-hit')].find(el=>{
        const first=el.childNodes?.[0]?.nodeValue?.trim();
        return first===name||el.textContent.trim().startsWith(name);
      });
      hit?.click();
    });
  }

  function installCountryPicking(globe){
    if(!globe||typeof globe.onGlobeClick!=='function')return;
    globe.onGlobeClick(({lat,lng})=>{
      if(document.body.classList.contains('terrain-view')||document.body.classList.contains('story-mode'))return;
      const feature=runtime.countryFeatures.find(f=>featureContains(f,Number(lng),Number(lat)));
      if(!feature)return;
      const name=runtime.countryNames.get(String(feature.id||'').toUpperCase());
      if(name)activateCountry(name);
    });
  }

  async function installArtifactFreeBorders(globe){
    if(runtime.outlineReady||!globe)return;
    runtime.outlineReady=true;
    try{
      const native=globe.polygonsData?.bind(globe);
      if(native){native([]);globe.polygonsData=function(){return arguments.length===0?[]:globe;};}
    }catch{}
    try{
      const [response,centroidResponse]=await Promise.all([
        fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',{cache:'force-cache'}),
        fetch('./data/country-centroids.json',{cache:'force-cache'})
      ]);
      if(!response.ok)throw new Error(String(response.status));
      const geo=await response.json();
      const centroids=centroidResponse.ok?await centroidResponse.json():[];
      runtime.countryFeatures=geo.features||[];
      runtime.countryNames=new Map((centroids||[]).filter(c=>c.cca3&&c.name).map(c=>[String(c.cca3).toUpperCase(),c.name]));
      const paths=runtime.countryFeatures.flatMap(geometryToPaths).filter(p=>p.points.length>1);
      globe.pathsData(paths).pathPoints('points').pathPointLat('lat').pathPointLng('lng')
        .pathColor(()=>document.body.classList.contains('story-mode')?'rgba(166,192,221,.24)':'rgba(151,184,218,.62)')
        .pathStroke(.24).pathAltitude(.0018).pathResolution(1.25).pathTransitionDuration(0);
      installCountryPicking(globe);
    }catch(err){console.warn('Artifact-free country outlines unavailable',err);}
  }

  function loadStyle(url){
    return new Promise((resolve,reject)=>{
      if(document.querySelector(`link[href="${url}"]`))return resolve();
      const el=document.createElement('link');el.rel='stylesheet';el.href=url;el.onload=resolve;
      el.onerror=()=>reject(new Error('MapLibre stylesheet failed to load'));document.head.appendChild(el);
    });
  }

  async function loadMapLibre(){
    if(runtime.loadPromise)return runtime.loadPromise;
    runtime.loadPromise=(async()=>{
      await loadStyle('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css');
      const module=await import('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs');
      if(typeof module?.Map!=='function')throw new Error('MapLibre ES module did not expose Map');
      return module;
    })();
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

  function greatCirclePoints(a,b,steps=72){
    const d2r=Math.PI/180,r2d=180/Math.PI;
    const lat1=Number(a.lat)*d2r,lon1=Number(a.lng)*d2r,lat2=Number(b.lat)*d2r,lon2=Number(b.lng)*d2r;
    const v1=[Math.cos(lat1)*Math.cos(lon1),Math.cos(lat1)*Math.sin(lon1),Math.sin(lat1)];
    const v2=[Math.cos(lat2)*Math.cos(lon2),Math.cos(lat2)*Math.sin(lon2),Math.sin(lat2)];
    const dot=clamp(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2],-1,1);
    const omega=Math.acos(dot),sinOmega=Math.sin(omega);
    if(omega<1e-6||Math.abs(sinOmega)<1e-6)return [[Number(a.lng),Number(a.lat)],[Number(b.lng),Number(b.lat)]];
    const points=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps,A=Math.sin((1-t)*omega)/sinOmega,B=Math.sin(t*omega)/sinOmega;
      const x=A*v1[0]+B*v2[0],y=A*v1[1]+B*v2[1],z=A*v1[2]+B*v2[2];
      const lat=Math.atan2(z,Math.hypot(x,y))*r2d,lng=Math.atan2(y,x)*r2d;
      points.push([lng,lat]);
    }
    return points;
  }

  function splitDateline(points){
    if(points.length<2)return [points];
    const parts=[[points[0]]];
    for(let i=1;i<points.length;i++){
      const prev=points[i-1],cur=points[i];
      if(Math.abs(cur[0]-prev[0])>180){
        if(parts[parts.length-1].length<2)parts[parts.length-1].push(prev);
        parts.push([cur]);
      }else parts[parts.length-1].push(cur);
    }
    return parts.filter(p=>p.length>1);
  }

  function segmentFeature(s){
    const a=runtime.centroids.get(normalize(s.from)),b=runtime.centroids.get(normalize(s.to));
    if(!a||!b)return null;
    const parts=splitDateline(greatCirclePoints(a,b));
    return {
      type:'Feature',properties:{id:Number(s.id),phaseId:phaseIdFor(Number(s.id))},
      geometry:parts.length>1?{type:'MultiLineString',coordinates:parts}:{type:'LineString',coordinates:parts[0]||[]}
    };
  }

  function routeGeoJson(selectedId=currentSegmentId()){
    const id=clamp(Number(selectedId)||1,1,194);
    const local=(runtime.routeData?.segments||[]).filter(s=>Math.abs(Number(s.id)-id)<=1);
    return {type:'FeatureCollection',features:local.map(segmentFeature).filter(Boolean)};
  }

  function selectedPosition(){
    const p=new URLSearchParams(location.search),country=p.get('country');
    if(country){const c=runtime.centroids.get(normalize(country));if(c)return [Number(c.lng),Number(c.lat)];}
    const id=currentSegmentId();
    const s=runtime.routeData?.segments?.find(x=>Number(x.id)===id),b=s&&runtime.centroids.get(normalize(s.to));
    return b?[Number(b.lng),Number(b.lat)]:[12,20];
  }

  function colorExpression(){
    const expr=['match',['get','phaseId']];
    Object.entries(PHASE_COLORS).forEach(([id,color])=>{expr.push(Number(id),color)});expr.push('#149fc4');return expr;
  }

  function terrainStyle(){
    return {
      version:8,projection:{type:'globe'},
      sources:{
        osm:{type:'raster',tiles:['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'},
        terrainSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
        hillshadeSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
        routeSource:{type:'geojson',data:routeGeoJson(runtime.selectedId||currentSegmentId())}
      },
      terrain:{source:'terrainSource',exaggeration:1.42},
      sky:{'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.52,3.5,.16,7,0]},
      layers:[
        {id:'background',type:'background',paint:{'background-color':'#071019'}},
        {id:'osm',type:'raster',source:'osm',paint:{'raster-opacity':1,'raster-saturation':-.06,'raster-contrast':.08,'raster-brightness-min':.01,'raster-brightness-max':.76}},
        {id:'hills',type:'hillshade',source:'hillshadeSource',paint:{'hillshade-method':'multidirectional','hillshade-exaggeration':.42,'hillshade-shadow-color':'#6a7780','hillshade-highlight-color':'#f5f8fa','hillshade-accent-color':'#8c9ca6'}},
        {id:'route-shadow',type:'line',source:'routeSource',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(4,10,16,.52)','line-opacity':.72,'line-width':['interpolate',['linear'],['zoom'],2,2.2,6,4,12,6.4]}},
        {id:'routes',type:'line',source:'routeSource',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':.62,'line-width':['interpolate',['linear'],['zoom'],2,1.2,6,2.2,12,3.4]}},
        {id:'selected-route',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#00b8e6','line-opacity':1,'line-width':['interpolate',['linear'],['zoom'],2,2.6,6,4.6,12,6.8]}}
      ]
    };
  }

  function deactivateTerrain({updateUrl=true}={}){
    runtime.terrainRequested=false;runtime.terrainActive=false;
    document.body.classList.remove('terrain-loading','terrain-view');setToggleState(false);setTerrainLabel('Real 3D globe terrain');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Drag to rotate · scroll to zoom · relief appears as you move closer';
    const high=$('#highDetailGlobe');if(high)high.disabled=false;if(updateUrl)updateViewUrl(false);
  }

  function activateTerrain(){
    runtime.terrainRequested=false;runtime.terrainActive=true;
    document.body.classList.remove('terrain-loading');document.body.classList.add('terrain-view');setToggleState(true);setTerrainLabel('Real 3D globe terrain');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Drag to rotate · scroll to zoom · relief appears as you move closer';
    const high=$('#highDetailGlobe');if(high)high.disabled=true;updateViewUrl(true);
  }

  function failTerrain(message){console.warn(message);deactivateTerrain({updateUrl:true});notify(message)}

  async function initTerrainMap(){
    if(runtime.terrainReady)return;
    await loadRouteContext();
    runtime.selectedId=currentSegmentId();
    const maplibregl=await loadMapLibre(),center=selectedPosition();
    const map=new maplibregl.Map({
      container:'terrainMap',style:terrainStyle(),center,zoom:3.9,pitch:32,bearing:-6,
      minZoom:2.9,maxZoom:18,maxPitch:65,renderWorldCopies:false,attributionControl:true,
      canvasContextAttributes:{antialias:true}
    });

    clearTimeout(runtime.terrainFailTimer);
    runtime.terrainFailTimer=setTimeout(()=>{
      if(runtime.terrainRequested&&!runtime.terrainBaseReady)failTerrain('3D globe terrain could not be loaded. Standard globe restored.');
    },10000);

    map.on('style.load',()=>{
      try{map.setProjection({type:'globe'});}catch(err){console.warn('Globe projection unavailable',err)}
      try{map.setTerrain({source:'terrainSource',exaggeration:1.42});}catch(err){console.warn('Terrain could not be attached to globe projection',err)}
    });

    map.on('load',()=>{
      runtime.terrainBaseReady=true;clearTimeout(runtime.terrainFailTimer);
      syncTerrainSelection({fly:false});syncTerrainPhase();if(runtime.terrainRequested)activateTerrain();
    });

    map.on('error',e=>{
      const msg=String(e?.error?.message||'');
      if(/style|source|tile|terrain|projection/i.test(msg))console.warn('Globe terrain resource error',e.error);
    });

    map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
    if(maplibregl.TerrainControl)map.addControl(new maplibregl.TerrainControl({source:'terrainSource',exaggeration:1.42}),'top-right');
    if(maplibregl.GlobeControl)map.addControl(new maplibregl.GlobeControl(),'top-right');
    runtime.terrainMap=map;runtime.terrainReady=true;
  }

  function syncTerrainSelection({fly=false}={}){
    const map=runtime.terrainMap;if(!map)return;
    runtime.selectedId=currentSegmentId();
    const source=map.getSource?.('routeSource');
    if(source?.setData)source.setData(routeGeoJson(runtime.selectedId));
    if(map.getLayer?.('selected-route'))map.setFilter('selected-route',['==',['get','id'],runtime.selectedId]);
    syncTerrainPhase();
    if(!fly)return;
    const p=selectedPosition();
    map.easeTo({center:p,zoom:Math.max(map.getZoom(),4.5),pitch:Math.min(Math.max(map.getPitch(),32),55),bearing:-6,duration:900,essential:true});
  }

  function syncTerrainPhase(){
    const map=runtime.terrainMap;if(!map||!map.getLayer?.('routes'))return;
    const phase=new URLSearchParams(location.search).get('phase');
    const filter=phase&&phase!=='all'?['==',['get','phaseId'],Number(phase)]:null;
    map.setFilter('routes',filter);map.setFilter('route-shadow',filter);
  }

  async function setTerrainMode(active){
    if(active&&document.body.classList.contains('story-mode')){setToggleState(false);notify('Exit Story before opening 3D globe terrain.');return;}
    if(!active){deactivateTerrain({updateUrl:true});return;}
    if(runtime.terrainActive){setToggleState(true);return;}
    runtime.terrainRequested=true;document.body.classList.add('terrain-loading');setToggleState(true);setTerrainLabel('Loading 3D globe terrain…');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Loading globe, map and elevation data…';
    try{
      await initTerrainMap();runtime.terrainMap.resize();
      if(runtime.terrainBaseReady){activateTerrain();syncTerrainSelection({fly:false});syncTerrainPhase();}
    }catch(err){console.error('3D globe terrain mode unavailable',err);failTerrain('3D globe terrain could not be initialized. Standard globe restored.');}
  }

  function findGlobe(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;if(!globe)return setTimeout(findGlobe,100);
    runtime.globe=globe;installArtifactFreeBorders(globe);
  }

  async function restoreViewState(){
    const wantsTerrain=new URLSearchParams(location.search).get('view')==='terrain';setToggleState(false);
    if(wantsTerrain)await setTerrainMode(true);
  }

  function wire(){
    ensureStyles();ensureTerrainUi();syncSliderFromUrl();findGlobe();
    $('#routeRange')?.addEventListener('input',()=>{
      if(runtime.terrainActive)setTimeout(()=>syncTerrainSelection({fly:true}),0);
    });
    $('#phaseRail')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainSelection({fly:false});syncTerrainPhase();},80)});
    new MutationObserver(()=>{
      if(document.body.classList.contains('story-mode')&&(runtime.terrainActive||runtime.terrainRequested))deactivateTerrain({updateUrl:true});
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',()=>runtime.terrainMap?.resize?.(),{passive:true});restoreViewState();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();