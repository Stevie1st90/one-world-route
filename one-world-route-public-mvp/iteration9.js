(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const runtime={
    globe:null,outlineReady:false,terrainMap:null,terrainReady:false,terrainBaseReady:false,
    terrainActive:false,terrainRequested:false,routeData:null,centroids:null,routeWaypoints:new Map(),loadPromise:null,
    selectedId:1,terrainFailTimer:null,criticalIds:new Set(),highDetailWasDisabled:null,
    phaseFocusTimer:null,pendingPhaseFocus:null
  };

  const PHASE_COLORS={1:'#149fc4',2:'#315eea',3:'#12a887',4:'#2f9f5e',5:'#6743d9',6:'#b84ad8',7:'#d39418',8:'#dc6d22',9:'#de4f37',10:'#d9324d',11:'#cf4c98',12:'#3e78db'};
  const COLORS={cyan:'#59ddff',blue:'#4f7cff',violet:'#9276ff',amber:'#ffbf5a',orange:'#ff7a45',red:'#ff4d67',green:'#65e5a7',muted:'#526277'};

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
      @media(max-width:820px){
        body.terrain-loading .terrain-badge,body.terrain-view .terrain-badge{display:none!important}
        body.terrain-view .maplibregl-ctrl-top-right{display:none!important}
        body.terrain-view .maplibregl-ctrl-bottom-right{bottom:4px}
      }
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

  async function installArtifactFreeBorders(globe){
    if(runtime.outlineReady||!globe)return;
    runtime.outlineReady=true;
    globe.__oneWorldArtifactFreeBorders=true;
    try{
      const response=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',{cache:'force-cache'});
      if(!response.ok)throw new Error(String(response.status));
      const geo=await response.json();
      const paths=(geo.features||[]).flatMap(geometryToPaths).filter(p=>p.points.length>1);
      globe.pathsData(paths).pathPoints('points').pathPointLat('lat').pathPointLng('lng')
        .pathColor(()=>document.body.classList.contains('story-mode')?'rgba(166,192,221,.24)':'rgba(151,184,218,.62)')
        .pathStroke(.24).pathAltitude(.0018).pathResolution(1.25).pathTransitionDuration(0);
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
    const [routeRes,centroidRes,waypointRes]=await Promise.all([
      fetch('./data/public-route.json',{cache:'force-cache'}),
      fetch('./data/country-centroids.json',{cache:'force-cache'}),
      fetch('./data/route-waypoints.json',{cache:'force-cache'}).catch(()=>null)
    ]);
    runtime.routeData=await routeRes.json();
    const centroids=await centroidRes.json();
    if(waypointRes?.ok){
      const rows=await waypointRes.json();
      runtime.routeWaypoints=new Map(Object.entries(rows||{}).map(([id,points])=>[Number(id),points]));
    }
    runtime.centroids=new Map((centroids||[]).map(c=>[normalize(c.name),c]));
    runtime.criticalIds=new Set([...(runtime.routeData.segments||[])].sort((a,b)=>criticalScore(b)-criticalScore(a)).slice(0,20).map(s=>Number(s.id)));
  }

  function phaseIdFor(id){
    const ranges=[[1,29],[30,39],[40,52],[53,64],[65,78],[79,95],[96,112],[113,120],[121,145],[146,169],[170,181],[182,194]];
    const i=ranges.findIndex(([a,b])=>id>=a&&id<=b);return i<0?1:i+1;
  }

  function criticalScore(s){
    let x={A:30,B:20,C:10,D:5,E:4}[s.bookingTier]||5;
    if(s.feasibility==='Kritisch')x+=30;else if(s.feasibility==='Bedingt')x+=15;
    if(s.alertLevel==='RED')x+=35;else if(s.alertLevel==='ORANGE')x+=24;else if(s.alertLevel==='WATCH')x+=9;
    if(s.dataQuality&&!/verifiziert/i.test(s.dataQuality))x+=12;
    if(/Nauru|Tuvalu|Marshall|Mikronesien|Palau|Haiti|Syrien|Jemen|Sudan|Somalia/i.test(`${s.from} ${s.to}`))x+=9;
    return x;
  }

  function activeTerrainLayer(){
    return $('#layerGrid button.active')?.dataset.layer || new URLSearchParams(location.search).get('layer') || 'route';
  }

  function terrainSegmentVisible(s){
    const layer=activeTerrainLayer();
    const mode=$('#modeFilter')?.value||'all',tier=$('#tierFilter')?.value||'all',feasibility=$('#feasibilityFilter')?.value||'all',alert=$('#alertFilter')?.value||'all';
    if(mode!=='all'&&s.mode!==mode)return false;
    if(tier!=='all'&&s.bookingTier!==tier)return false;
    if(feasibility!=='all'&&s.feasibility!==feasibility)return false;
    if(alert!=='all'&&s.alertLevel!==alert)return false;
    if(layer==='critical'&&!runtime.criticalIds.has(Number(s.id)))return false;
    return true;
  }

  function terrainVisibleSegments(){
    return (runtime.routeData?.segments||[]).filter(terrainSegmentVisible);
  }

  function terrainColor(s){
    const layer=activeTerrainLayer();
    if(layer==='status')return ({RED:COLORS.red,ORANGE:COLORS.orange,WATCH:COLORS.amber,GREEN:COLORS.green}[s.alertLevel]||COLORS.muted);
    if(layer==='visa'){
      if(/block/i.test(s.visaStatusTarget||''))return COLORS.red;
      if(/pending/i.test(s.visaStatusTarget||''))return COLORS.orange;
      if(/N\/A|Approved|Completed/i.test(s.visaStatusTarget||''))return COLORS.green;
      return COLORS.amber;
    }
    if(layer==='health')return Number(s.healthPriorityTarget)>=4?COLORS.red:Number(s.healthPriorityTarget)>=2?COLORS.amber:COLORS.green;
    if(layer==='cost'){const v=Number(s.transportBudgetEur||0);return v>600?COLORS.red:v>350?COLORS.violet:v>150?COLORS.blue:COLORS.cyan;}
    if(layer==='risk')return s.feasibility==='Kritisch'?COLORS.red:s.feasibility==='Bedingt'?COLORS.orange:/verifiziert/i.test(s.dataQuality||'')?COLORS.green:COLORS.amber;
    if(layer==='progress')return COLORS.blue;
    if(layer==='critical')return COLORS.red;
    return PHASE_COLORS[phaseIdFor(Number(s.id))]||COLORS.cyan;
  }

  function activeTerrainPhase(){
    const raw=new URLSearchParams(location.search).get('phase');
    const allButton=$('#phaseRail button.active[data-phase="all"]');
    if(raw==='all'||allButton)return null;
    if(raw&&Number.isFinite(Number(raw)))return Number(raw);
    return phaseIdFor(runtime.selectedId||currentSegmentId());
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

  function segmentPathPoints(s){
    const id=Number(s.id),curated=runtime.routeWaypoints.get(id);
    if(Array.isArray(curated)&&curated.length>=2){
      const stitched=[];
      for(let i=1;i<curated.length;i++){
        const a={lng:Number(curated[i-1][0]),lat:Number(curated[i-1][1])};
        const b={lng:Number(curated[i][0]),lat:Number(curated[i][1])};
        const leg=greatCirclePoints(a,b,Math.max(10,Math.round(24/(curated.length-1))));
        if(stitched.length)leg.shift();
        stitched.push(...leg);
      }
      return stitched;
    }
    const a=runtime.centroids.get(normalize(s.from)),b=runtime.centroids.get(normalize(s.to));
    if(!a||!b)return[];
    return greatCirclePoints(a,b);
  }

  function segmentFeature(s){
    const points=segmentPathPoints(s);if(points.length<2)return null;
    const parts=splitDateline(points);
    const id=Number(s.id),visible=terrainSegmentVisible(s)||id===Number(runtime.selectedId);
    return {
      type:'Feature',properties:{id,phaseId:phaseIdFor(id),color:terrainColor(s),visible:visible?1:0,mode:String(s.mode||''),isFlight:/Flug/i.test(String(s.mode||''))?1:0},
      geometry:parts.length>1?{type:'MultiLineString',coordinates:parts}:{type:'LineString',coordinates:parts[0]||[]}
    };
  }

  function routeGeoJson(){
    const rows=runtime.routeData?.segments||[];
    return {type:'FeatureCollection',features:rows.map(segmentFeature).filter(Boolean)};
  }

  function countryGeoJson(){
    const meta=new Map((runtime.routeData?.countries||[]).map(c=>[normalize(c.name),c]));
    return {type:'FeatureCollection',features:[...runtime.centroids.values()].map(c=>{
      const m=meta.get(normalize(c.name))||{};
      return {type:'Feature',properties:{name:c.name,number:Number(c.number||m.number||0),cca2:c.cca2||'',readiness:m.readiness||''},geometry:{type:'Point',coordinates:[Number(c.lng),Number(c.lat)]}};
    }).filter(f=>Number.isFinite(f.geometry.coordinates[0])&&Number.isFinite(f.geometry.coordinates[1]))};
  }

  function selectedPosition(){
    const p=new URLSearchParams(location.search),country=p.get('country');
    if(country){const c=runtime.centroids.get(normalize(country));if(c)return [Number(c.lng),Number(c.lat)];}
    const id=currentSegmentId();
    const s=runtime.routeData?.segments?.find(x=>Number(x.id)===id),b=s&&runtime.centroids.get(normalize(s.to));
    return b?[Number(b.lng),Number(b.lat)]:[12,20];
  }

  function colorExpression(){return ['get','color'];}
  function widthExpr(a,b,c0){const scale=clamp(Number($('#arcWidth')?.value||.55)/.55,.35,2.4);return ['interpolate',['linear'],['zoom'],2,a*scale,6,b*scale,12,c0*scale];}

  async function terrainStyle(){
    const phase=activeTerrainPhase();
    const phaseFilter=phase===null?['==',['get','phaseId'],-1]:['==',['get','phaseId'],phase];
    let base;
    try{
      const response=await fetch('https://tiles.openfreemap.org/styles/liberty',{cache:'force-cache'});
      if(!response.ok)throw new Error('OpenFreeMap style '+response.status);
      base=await response.json();
    }catch(err){
      console.warn('OpenFreeMap basemap unavailable; using terrain-only fallback',err);
      base={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#d9e5e8'}}]};
    }

    base.version=8;
    base.projection={type:'globe'};
    base.sources={...(base.sources||{}),
      terrainSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
      hillshadeSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
      routeSource:{type:'geojson',data:routeGeoJson()},
      countrySource:{type:'geojson',data:countryGeoJson()}
    };
    base.terrain={source:'terrainSource',exaggeration:1.34};
    base.sky={'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.42,3.5,.13,7,0]};

    const hill={
      id:'oneworld-hills',type:'hillshade',source:'hillshadeSource',
      paint:{'hillshade-method':'multidirectional','hillshade-exaggeration':.32,'hillshade-shadow-color':'#66757d','hillshade-highlight-color':'#f6f8f7','hillshade-accent-color':'#82939d'}
    };
    const overlays=[
      {id:'route-hit',type:'line',source:'routeSource',filter:['==',['get','visible'],1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(0,0,0,.001)','line-opacity':.001,'line-width':['interpolate',['linear'],['zoom'],2,12,7,16,12,20]}},
      {id:'route-backbone-shadow',type:'line',source:'routeSource',filter:['==',['get','visible'],1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(2,8,15,.68)','line-opacity':['interpolate',['linear'],['zoom'],2,.38,5,.30,9,.22],'line-width':['interpolate',['linear'],['zoom'],2,2.6,5,2.25,9,1.8]}},
      {id:'route-backbone',type:'line',source:'routeSource',filter:['==',['get','visible'],1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':['interpolate',['linear'],['zoom'],2,.62,5,.54,9,.46],'line-width':['interpolate',['linear'],['zoom'],2,1.25,5,1.1,9,.95]}},
      {id:'route-world-shadow',type:'line',source:'routeSource',filter:['==',['get','isFlight'],0],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(3,10,18,.58)','line-opacity':.24,'line-width':widthExpr(2.1,3.2,4.6)}},
      {id:'route-world',type:'line',source:'routeSource',filter:['==',['get','isFlight'],0],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['case',['==',['get','visible'],1],colorExpression(),'#6f8295'],'line-opacity':['case',['==',['get','visible'],1],.72,.16],'line-width':widthExpr(1.05,1.65,2.45)}},
      {id:'route-flights-shadow',type:'line',source:'routeSource',filter:['all',['==',['get','isFlight'],1],['!=',['get','id'],runtime.selectedId]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(3,10,18,.72)','line-opacity':['interpolate',['linear'],['zoom'],2,.28,4,.20,6,.12,9,.05],'line-width':['interpolate',['linear'],['zoom'],2,1.5,4,1.15,6,.9,9,.65]}},
      {id:'route-flights-world',type:'line',source:'routeSource',filter:['all',['==',['get','isFlight'],1],['!=',['get','id'],runtime.selectedId]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['case',['==',['get','visible'],1],colorExpression(),'#718399'],'line-opacity':['interpolate',['linear'],['zoom'],2,.52,4,.40,6,.30,9,.20],'line-width':['interpolate',['linear'],['zoom'],2,1.0,4,.86,6,.74,9,.62]}},
      {id:'route-phase-shadow',type:'line',source:'routeSource',filter:['all',phaseFilter,['==',['get','visible'],1],['==',['get','isFlight'],0]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(4,10,16,.58)','line-opacity':$('#routeGlow')?.checked===false?.24:.64,'line-width':widthExpr(2.5,4.0,6.0)}},
      {id:'route-phase',type:'line',source:'routeSource',filter:['all',phaseFilter,['==',['get','visible'],1],['==',['get','isFlight'],0]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':colorExpression(),'line-opacity':.94,'line-width':widthExpr(1.55,2.65,4.1)}},
      {id:'selected-route-shadow',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(2,9,15,.74)','line-opacity':$('#routeGlow')?.checked===false?.34:.82,'line-width':widthExpr(4.0,6.4,9.0)}},
      {id:'selected-route',type:'line',source:'routeSource',filter:['==',['get','id'],runtime.selectedId],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#00ccef','line-opacity':1,'line-width':widthExpr(2.7,4.7,6.8)}},
      {id:'country-hit',type:'circle',source:'countrySource',layout:{visibility:$('#showPoints')?.checked===false?'none':'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,8,7,10,11,12],'circle-color':'rgba(0,0,0,.001)','circle-opacity':.001}},
      {id:'country-points',type:'circle',source:'countrySource',layout:{visibility:$('#showPoints')?.checked===false?'none':'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,1.55,7,2.7,11,4.1],'circle-color':'rgba(19,59,82,.82)','circle-stroke-color':'rgba(255,255,255,.92)','circle-stroke-width':1,'circle-opacity':['interpolate',['linear'],['zoom'],2,.52,5,.68,8,.88]}},
      {id:'country-selected',type:'circle',source:'countrySource',filter:['==',['get','name'],new URLSearchParams(location.search).get('country')||''],paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,4.8,7,6.6,11,8.4],'circle-color':'#17c9ed','circle-stroke-color':'#ffffff','circle-stroke-width':1.6,'circle-opacity':1}}
    ];

    const layers=Array.isArray(base.layers)?base.layers:[];
    const firstSymbol=layers.findIndex(l=>l.type==='symbol');
    if(firstSymbol>=0)layers.splice(firstSymbol,0,hill);else layers.push(hill);
    layers.push(...overlays);
    base.layers=layers;
    return base;
  }
  function deactivateTerrain({updateUrl=true}={}){
    runtime.terrainRequested=false;runtime.terrainActive=false;
    document.body.classList.remove('terrain-loading','terrain-view');setToggleState(false);setTerrainLabel('Real 3D globe terrain');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Drag to rotate · scroll to zoom · relief appears as you move closer';
    const high=$('#highDetailGlobe');if(high&&runtime.highDetailWasDisabled!==null){high.disabled=runtime.highDetailWasDisabled;runtime.highDetailWasDisabled=null;}const auto=$('#autoRotate');if(auto)auto.disabled=false;if(updateUrl)updateViewUrl(false);
  }

  function activateTerrain(){
    runtime.terrainRequested=false;runtime.terrainActive=true;
    document.body.classList.remove('terrain-loading');document.body.classList.add('terrain-view');setToggleState(true);setTerrainLabel('Real 3D globe terrain');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Drag to rotate · scroll to zoom · relief appears as you move closer';
    const high=$('#highDetailGlobe');if(high){if(runtime.highDetailWasDisabled===null)runtime.highDetailWasDisabled=high.disabled;high.disabled=true;}const auto=$('#autoRotate');if(auto)auto.disabled=true;updateViewUrl(true);syncTerrainSettings();
  }

  function failTerrain(message){console.warn(message);deactivateTerrain({updateUrl:true});notify(message)}

  async function initTerrainMap(){
    if(runtime.terrainReady)return;
    await loadRouteContext();
    runtime.selectedId=currentSegmentId();
    const maplibregl=await loadMapLibre(),center=selectedPosition(),style=await terrainStyle();
    const map=new maplibregl.Map({
      container:'terrainMap',style,center,zoom:3.9,pitch:32,bearing:-6,
      minZoom:2.9,maxZoom:18,maxPitch:65,renderWorldCopies:false,attributionControl:true,
      canvasContextAttributes:{antialias:true}
    });

    clearTimeout(runtime.terrainFailTimer);
    runtime.terrainFailTimer=setTimeout(()=>{
      if(runtime.terrainRequested&&!runtime.terrainBaseReady)failTerrain('3D globe terrain could not be loaded. Standard globe restored.');
    },10000);

    map.on('style.load',()=>{
      try{map.setProjection({type:'globe'});}catch(err){console.warn('Globe projection unavailable',err)}
      try{map.setTerrain({source:'terrainSource',exaggeration:1.34});}catch(err){console.warn('Terrain could not be attached to globe projection',err)}
    });

    map.on('load',()=>{
      runtime.terrainBaseReady=true;clearTimeout(runtime.terrainFailTimer);
      syncTerrainSelection({fly:false});syncTerrainSettings();if(runtime.terrainRequested)activateTerrain();

      const routeLayers=['route-hit','selected-route','route-phase','route-world'];
      map.on('click',e=>{
        const hit=map.queryRenderedFeatures(e.point,{layers:routeLayers}).find(f=>Number.isFinite(Number(f.properties?.id)));
        if(!hit)return;
        const id=Number(hit.properties.id);
        window.__ONE_WORLD_ROUTE_APP__?.selectSegment?.(id,false);
        runtime.selectedId=id;syncTerrainData();syncTerrainSelection({fly:true});
      });
      map.on('click','country-hit',e=>{
        const name=e.features?.[0]?.properties?.name;if(!name)return;
        window.__ONE_WORLD_ROUTE_APP__?.selectCountry?.(name,false);
        window.__ONE_WORLD_ROUTE_APP__?.openDetails?.();
        runtime.selectedId=currentSegmentId();syncTerrainSelection({fly:true});
      });
      map.on('mouseenter','country-hit',()=>{map.getCanvas().style.cursor='pointer'});
      map.on('mouseleave','country-hit',()=>{map.getCanvas().style.cursor=''});
    });

    map.on('error',e=>{
      const msg=String(e?.error?.message||'');
      if(/style|source|tile|terrain|projection/i.test(msg))console.warn('Globe terrain resource error',e.error);
    });

    if(!window.matchMedia('(max-width: 820px)').matches){
      map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
      if(maplibregl.TerrainControl)map.addControl(new maplibregl.TerrainControl({source:'terrainSource',exaggeration:1.34}),'top-right');
      if(maplibregl.GlobeControl)map.addControl(new maplibregl.GlobeControl(),'top-right');
    }
    runtime.terrainMap=map;runtime.terrainReady=true;window.__ONE_WORLD_TERRAIN__=map;
  }

  function syncTerrainData(){
    const map=runtime.terrainMap;if(!map)return;
    const source=map.getSource?.('routeSource');if(source?.setData)source.setData(routeGeoJson());
  }

  function syncTerrainCountry(){
    const map=runtime.terrainMap;if(!map)return;
    const name=new URLSearchParams(location.search).get('country')||'';
    if(map.getLayer?.('country-selected'))map.setFilter('country-selected',['==',['get','name'],name]);
  }

  function syncTerrainSettings(){
    const map=runtime.terrainMap;if(!map)return;
    const points=$('#showPoints')?.checked===false?'none':'visible';
    if(map.getLayer?.('country-points'))map.setLayoutProperty('country-points','visibility',points);
    if(map.getLayer?.('country-hit'))map.setLayoutProperty('country-hit','visibility',points);
    const glow=$('#routeGlow')?.checked!==false;
    if(map.getLayer?.('route-phase-shadow'))map.setPaintProperty('route-phase-shadow','line-opacity',glow?.58:.18);
    if(map.getLayer?.('selected-route-shadow'))map.setPaintProperty('selected-route-shadow','line-opacity',glow?.88:.22);
    const widths={'route-world-shadow':widthExpr(2.1,3.2,4.6),'route-world':widthExpr(1.05,1.65,2.45),'route-phase-shadow':widthExpr(2.5,4.0,6.0),'route-phase':widthExpr(1.55,2.65,4.1),'selected-route-shadow':widthExpr(4.0,6.4,9.0),'selected-route':widthExpr(2.7,4.7,6.8)};
    Object.entries(widths).forEach(([id,value])=>{if(map.getLayer?.(id))map.setPaintProperty(id,'line-width',value)});
    const auto=$('#autoRotate');if(auto)auto.disabled=runtime.terrainActive||runtime.terrainRequested;
  }

  function syncTerrainHierarchy(){
    const map=runtime.terrainMap;if(!map)return;
    const phase=activeTerrainPhase();
    const phaseFilter=phase===null?['==',['get','phaseId'],-1]:['==',['get','phaseId'],phase];
    if(map.getLayer?.('route-hit'))map.setFilter('route-hit',['==',['get','visible'],1]);
    if(map.getLayer?.('route-phase'))map.setFilter('route-phase',['all',phaseFilter,['==',['get','visible'],1],['==',['get','isFlight'],0]]);
    if(map.getLayer?.('route-phase-shadow'))map.setFilter('route-phase-shadow',['all',phaseFilter,['==',['get','visible'],1],['==',['get','isFlight'],0]]);
    if(map.getLayer?.('route-flights-world'))map.setFilter('route-flights-world',['all',['==',['get','isFlight'],1],['!=',['get','id'],runtime.selectedId]]);
    if(map.getLayer?.('selected-route'))map.setFilter('selected-route',['==',['get','id'],runtime.selectedId]);
    if(map.getLayer?.('selected-route-shadow'))map.setFilter('selected-route-shadow',['==',['get','id'],runtime.selectedId]);
  }

  function sphericalCenter(points){
    if(!points.length)return [12,20];
    let x=0,y=0,z=0;
    for(const [lng,lat] of points){
      const la=Number(lat)*Math.PI/180,lo=Number(lng)*Math.PI/180;
      x+=Math.cos(la)*Math.cos(lo);y+=Math.cos(la)*Math.sin(lo);z+=Math.sin(la);
    }
    const lng=Math.atan2(y,x)*180/Math.PI,lat=Math.atan2(z,Math.hypot(x,y))*180/Math.PI;
    return [lng,lat];
  }

  function angularDistance(a,b){
    const d2r=Math.PI/180;
    const la1=a[1]*d2r,la2=b[1]*d2r,dla=(b[1]-a[1])*d2r,dlo=(b[0]-a[0])*d2r;
    const h=Math.sin(dla/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlo/2)**2;
    return 2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))*180/Math.PI;
  }

  function focusTerrainPhase(raw){
    const map=runtime.terrainMap;if(!map||!runtime.terrainActive)return;
    if(String(raw)==='all'){
      map.easeTo({center:[12,18],zoom:2.35,pitch:8,bearing:0,duration:$('#reducedMotion')?.checked?0:950,essential:true});
      return;
    }
    const phase=Number(raw);if(!Number.isFinite(phase))return;
    const segments=(runtime.routeData?.segments||[]).filter(s=>phaseIdFor(Number(s.id))===phase);
    const points=[];
    for(const s of segments){
      const curated=runtime.routeWaypoints.get(Number(s.id));
      if(Array.isArray(curated))curated.forEach(p=>points.push([Number(p[0]),Number(p[1])]));
      else{
        const a=runtime.centroids.get(normalize(s.from)),b=runtime.centroids.get(normalize(s.to));
        if(a)points.push([Number(a.lng),Number(a.lat)]);if(b)points.push([Number(b.lng),Number(b.lat)]);
      }
    }
    if(!points.length)return;
    const center=sphericalCenter(points);
    const spread=Math.max(...points.map(p=>angularDistance(center,p)));
    let zoom=spread>100?2.25:spread>65?2.55:spread>40?2.9:spread>25?3.25:spread>14?3.7:4.15;
    if(window.innerWidth<=820)zoom-=.12;
    map.easeTo({center,zoom,pitch:spread>55?8:24,bearing:0,duration:$('#reducedMotion')?.checked?0:1050,essential:true});
  }

  function syncTerrainSelection({fly=false}={}){
    const map=runtime.terrainMap;if(!map)return;
    runtime.selectedId=currentSegmentId();
    syncTerrainData();syncTerrainHierarchy();syncTerrainCountry();syncTerrainSettings();
    if(!fly)return;
    const p=selectedPosition();
    map.easeTo({center:p,zoom:Math.max(map.getZoom(),4.5),pitch:Math.min(Math.max(map.getPitch(),32),55),bearing:-6,duration:$('#reducedMotion')?.checked?0:900,essential:true});
  }

  async function setTerrainMode(active){
    if(active&&document.body.classList.contains('story-mode')){setToggleState(false);notify('Exit Story before opening 3D globe terrain.');return;}
    if(!active){deactivateTerrain({updateUrl:true});return;}
    if(runtime.terrainActive){setToggleState(true);return;}
    runtime.terrainRequested=true;document.body.classList.add('terrain-loading');setToggleState(true);setTerrainLabel('Loading 3D globe terrain…');
    const badge=$('.terrain-badge span');if(badge)badge.textContent='Loading globe, map and elevation data…';
    try{
      await initTerrainMap();runtime.terrainMap.resize();
      if(runtime.terrainBaseReady){activateTerrain();syncTerrainSelection({fly:false});}
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
      if(runtime.terrainActive)setTimeout(()=>syncTerrainSelection({fly:!runtime.pendingPhaseFocus}),0);
    });
    $('#phaseRail')?.addEventListener('click',e=>{
      const btn=e.target.closest?.('button[data-phase]');if(!btn||!runtime.terrainActive)return;
      runtime.pendingPhaseFocus=btn.dataset.phase;
      clearTimeout(runtime.phaseFocusTimer);
      runtime.phaseFocusTimer=setTimeout(()=>{
        syncTerrainData();syncTerrainHierarchy();
        const phase=runtime.pendingPhaseFocus;runtime.pendingPhaseFocus=null;
        focusTerrainPhase(phase);
      },260);
    });
    $('#layerGrid')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainData();syncTerrainHierarchy();},80)});
    $('.mode-switch')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainData();syncTerrainHierarchy();},80)});
    ['modeFilter','tierFilter','feasibilityFilter','alertFilter'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainData();syncTerrainHierarchy();},0)}));
    $('#clearFilters')?.addEventListener('click',()=>{if(runtime.terrainActive)setTimeout(()=>{syncTerrainData();syncTerrainHierarchy();},80)});
    ['showPoints','routeGlow','arcWidth','reducedMotion'].forEach(id=>$('#'+id)?.addEventListener(id==='arcWidth'?'input':'change',()=>{if(runtime.terrainActive)syncTerrainSettings()}));
    new MutationObserver(()=>{
      if(document.body.classList.contains('story-mode')&&(runtime.terrainActive||runtime.terrainRequested))deactivateTerrain({updateUrl:true});
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',()=>runtime.terrainMap?.resize?.(),{passive:true});restoreViewState();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();