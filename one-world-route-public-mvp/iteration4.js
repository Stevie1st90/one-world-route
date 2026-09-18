(() => {
  'use strict';

  const PHASES = [
    {id:1, range:[1,29]}, {id:2, range:[30,39]}, {id:3, range:[40,52]},
    {id:4, range:[53,64]}, {id:5, range:[65,78]}, {id:6, range:[79,95]},
    {id:7, range:[96,112]}, {id:8, range:[113,120]}, {id:9, range:[121,145]},
    {id:10, range:[146,169]}, {id:11, range:[170,181]}, {id:12, range:[182,194]}
  ];

  const runtime = {
    globe:null,
    lastSegment:null,
    lastPhase:null,
    lockedPhase:null,
    normalArcTransition:null,
    applyingHierarchy:false,
    applyingCamera:false,
    applyingSceneData:false,
    focusTimer:null,
    syncFrame:null,
    chapterTimer:null,
    active:false
  };

  const $ = (s, root=document) => root.querySelector(s);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const phaseFor = id => PHASES.find(p => id >= p.range[0] && id <= p.range[1]) || PHASES[0];
  const isStory = () => document.body.classList.contains('story-mode');
  const segmentId = () => clamp(Number($('#routeRange')?.value || 1),1,194);
  const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

  function createStoryGlobeStub(){
    let stub;
    const controls = {enabled:false,autoRotate:false};
    stub = new Proxy({}, {
      get(_target,prop){
        if(prop === 'controls') return () => controls;
        if(prop === 'globeMaterial') return () => null;
        if(prop === 'width' || prop === 'height') return () => stub;
        return () => stub;
      }
    });
    return stub;
  }

  function installPersistentStoryRenderer(instance){
    if(!instance || instance.__oneWorldPersistentStory) return;

    const nativeArcsData = instance.arcsData?.bind(instance);
    if(nativeArcsData){
      instance.arcsData = function(value){
        if(arguments.length === 0) return nativeArcsData();
        if(!isStory()){
          runtime.lockedPhase=null;
          return nativeArcsData(value);
        }

        const phase=phaseFor(segmentId());
        const current=nativeArcsData() || [];
        const currentIsChapter=current.length>0 && current.every(s=>Number(s?.id)>=phase.range[0] && Number(s?.id)<=phase.range[1]);
        if(currentIsChapter && runtime.lockedPhase===phase.id) return instance;

        const incoming=Array.isArray(value)?value:[];
        const chapter=incoming.filter(s=>Number(s?.id)>=phase.range[0] && Number(s?.id)<=phase.range[1]);
        if(!chapter.length) return instance;

        runtime.lockedPhase=phase.id;
        const result=nativeArcsData(chapter);
        setTimeout(()=>syncStoryScene({focus:true}),0);
        return result;
      };
    }

    ['arcColor','arcStroke','arcDashLength','arcDashGap','arcDashAnimateTime','arcCurveResolution'].forEach(name=>{
      const method=instance[name];
      if(typeof method!=='function') return;
      const native=method.bind(instance);
      instance[name]=function(...args){
        if(!args.length) return native();
        if(isStory() && !runtime.applyingHierarchy) return instance;
        return native(...args);
      };
    });

    ['pointsData','labelsData','ringsData','polygonsData'].forEach(name=>{
      const method=instance[name];
      if(typeof method!=='function') return;
      const native=method.bind(instance);
      instance[name]=function(...args){
        if(!args.length) return native();
        if(isStory() && !runtime.applyingSceneData) return instance;
        return native(...args);
      };
    });

    const pointOfView=instance.pointOfView;
    if(typeof pointOfView==='function'){
      const nativePointOfView=pointOfView.bind(instance);
      instance.pointOfView=function(...args){
        if(isStory() && !runtime.applyingCamera) return instance;
        return nativePointOfView(...args);
      };
    }

    instance.__oneWorldPersistentStory=true;
  }

  function captureMainGlobe(){
    const NativeGlobe = window.Globe;
    if(typeof NativeGlobe !== 'function' || NativeGlobe.__oneWorldIteration4) return;

    function WrappedGlobe(el,...args){
      if(el?.id === 'storyOverlay') return createStoryGlobeStub();
      const instance = Reflect.construct(NativeGlobe,[el,...args]);
      if(el?.id === 'globe' || !runtime.globe){
        runtime.globe = instance;
        window.__ONE_WORLD_ROUTE_GLOBE__ = instance;
        installPersistentStoryRenderer(instance);
      }
      return instance;
    }

    try{ Object.setPrototypeOf(WrappedGlobe,NativeGlobe); }catch{}
    WrappedGlobe.prototype = NativeGlobe.prototype;
    WrappedGlobe.__oneWorldIteration4 = true;
    window.Globe = WrappedGlobe;
  }

  captureMainGlobe();

  function getGlobe(){
    return runtime.globe || window.__ONE_WORLD_ROUTE_GLOBE__ || null;
  }

  function currentChapterSegments(){
    const globe = getGlobe();
    if(!globe || typeof globe.arcsData !== 'function') return [];
    let data=[];
    try{ data = globe.arcsData() || []; }catch{return []}
    const phase = phaseFor(segmentId());
    return data.filter(s => Number(s?.id) >= phase.range[0] && Number(s?.id) <= phase.range[1]);
  }

  function hierarchyColor(s,id){
    const delta = Number(s.id) - id;
    if(delta === 0) return ['rgba(255,255,255,.98)','rgba(89,221,255,1)'];
    if(delta < 0) return 'rgba(89,221,255,.055)';
    if(delta === 1) return ['rgba(89,221,255,.74)','rgba(146,118,255,.68)'];
    if(delta === 2) return 'rgba(126,170,255,.28)';
    if(delta === 3) return 'rgba(146,118,255,.16)';
    return 'rgba(129,151,181,.055)';
  }

  function hierarchyStroke(s,id){
    const delta = Number(s.id) - id;
    const mobileScale = isMobile() ? .86 : 1;
    if(delta === 0) return 1.62 * mobileScale;
    if(delta < 0) return .12;
    if(delta === 1) return .58 * mobileScale;
    if(delta === 2) return .30 * mobileScale;
    if(delta === 3) return .20 * mobileScale;
    return .11;
  }

  function applyRouteHierarchy(){
    if(!isStory()) return;
    const globe=getGlobe();
    if(!globe) return;
    const id=segmentId();

    runtime.applyingHierarchy=true;
    try{
      globe
        .arcColor(s=>hierarchyColor(s,id))
        .arcStroke(s=>hierarchyStroke(s,id))
        .arcDashLength(()=>1)
        .arcDashGap(()=>0)
        .arcDashAnimateTime(()=>0)
        .arcCurveResolution(isMobile()?24:36);
    }catch{}
    finally{ runtime.applyingHierarchy=false; }
  }

  function sphericalMidpoint(s){
    const d2r=Math.PI/180, r2d=180/Math.PI;
    const lat1=Number(s.startLat)*d2r, lon1=Number(s.startLng)*d2r;
    const lat2=Number(s.endLat)*d2r, lon2=Number(s.endLng)*d2r;
    const a=[Math.cos(lat1)*Math.cos(lon1),Math.cos(lat1)*Math.sin(lon1),Math.sin(lat1)];
    const b=[Math.cos(lat2)*Math.cos(lon2),Math.cos(lat2)*Math.sin(lon2),Math.sin(lat2)];
    const v=[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
    const mag=Math.hypot(v[0],v[1],v[2]);
    if(mag<.0001) return {lat:Number(s.endLat)||0,lng:Number(s.endLng)||0};
    return {lat:Math.asin(v[2]/mag)*r2d,lng:Math.atan2(v[1],v[0])*r2d};
  }

  function angularDistance(s){
    const d2r=Math.PI/180;
    const lat1=Number(s.startLat)*d2r, lat2=Number(s.endLat)*d2r;
    const dLon=(Number(s.endLng)-Number(s.startLng))*d2r;
    const cos=Math.sin(lat1)*Math.sin(lat2)+Math.cos(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return Math.acos(clamp(cos,-1,1))*180/Math.PI;
  }

  function activeSpeed(){
    const b=$('.speed-control button.active');
    return clamp(Number(b?.dataset.speed || 700),220,1600);
  }

  function focusCurrentSegment(force=false){
    if(!isStory()) return;
    const globe=getGlobe();
    if(!globe || typeof globe.pointOfView!=='function') return;
    const id=segmentId();
    if(!force && runtime.lastSegment===id) return;
    const chapter=currentChapterSegments();
    const seg=chapter.find(s=>Number(s.id)===id);
    if(!seg) return;

    const phase=phaseFor(id);
    const chapterChanged=runtime.lastPhase!==null && runtime.lastPhase!==phase.id;
    const midpoint=sphericalMidpoint(seg);
    const distance=angularDistance(seg);
    let altitude=clamp(1.36+(distance/110)*.72,1.36,2.18);
    if(isMobile()) altitude+=.16;
    if(id===phase.range[0] || chapterChanged) altitude=Math.max(altitude,1.92);
    const duration=$('#reducedMotion')?.checked ? 0 : clamp(Math.round(activeSpeed()*.68),180,920);

    clearTimeout(runtime.focusTimer);
    runtime.applyingCamera=true;
    try{ globe.pointOfView({lat:midpoint.lat,lng:midpoint.lng,altitude},duration); }catch{}
    finally{ runtime.applyingCamera=false; }
    runtime.lastSegment=id;
    if(runtime.lastPhase!==phase.id){
      runtime.lastPhase=phase.id;
      animateChapterShift();
    }
  }

  function ensurePreview(){
    const route=$('#storyRoute');
    const hud=$('#storyHud');
    if(!route || !hud) return null;
    let preview=$('#storyPreview',hud);
    if(!preview){
      preview=document.createElement('div');
      preview.id='storyPreview';
      preview.className='story-preview';
      route.insertAdjacentElement('afterend',preview);
    }
    return preview;
  }

  function updatePreview(){
    if(!isStory()) return;
    const preview=ensurePreview();
    if(!preview) return;
    const id=segmentId();
    const chapter=currentChapterSegments();
    const next=chapter.filter(s=>Number(s.id)>id).sort((a,b)=>a.id-b.id).slice(0,isMobile()?1:3);
    if(!next.length){
      preview.innerHTML='<span class="story-preview-label">CHAPTER END</span><b>Next chapter incoming</b>';
      return;
    }
    preview.innerHTML='<span class="story-preview-label">NEXT</span>'+next.map((s,i)=>`<span class="story-preview-leg ${i===0?'is-next':''}"><i>+${i+1}</i>${escapeText(s.from)} → ${escapeText(s.to)}</span>`).join('');
  }

  function escapeText(value){
    return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function animateChapterShift(){
    const hud=$('#storyHud');
    if(!hud) return;
    if($('#reducedMotion')?.checked){hud.classList.remove('chapter-shift');return;}
    hud.classList.remove('chapter-shift');
    void hud.offsetWidth;
    hud.classList.add('chapter-shift');
    clearTimeout(runtime.chapterTimer);
    runtime.chapterTimer=setTimeout(()=>hud.classList.remove('chapter-shift'),650);
  }

  function syncStoryScene({focus=true}={}){
    if(!isStory()) return;
    cancelAnimationFrame(runtime.syncFrame);
    runtime.syncFrame=requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        applyRouteHierarchy();
        updatePreview();
        if(focus) focusCurrentSegment();
      });
    });
  }

  function enterStory(){
    runtime.active=true;
    runtime.lastSegment=null;
    runtime.lastPhase=null;
    runtime.lockedPhase=null;
    const globe=getGlobe();
    if(globe && typeof globe.arcsTransitionDuration==='function'){
      try{
        if(runtime.normalArcTransition===null) runtime.normalArcTransition=globe.arcsTransitionDuration();
        globe.arcsTransitionDuration(0);
      }catch{}
    }

    runtime.applyingSceneData=true;
    try{
      globe?.pointsData?.([]);
      globe?.labelsData?.([]);
      globe?.ringsData?.([]);
    }catch{}
    finally{ runtime.applyingSceneData=false; }

    runtime.applyingHierarchy=true;
    try{ globe?.arcCurveResolution?.(isMobile()?24:36); }catch{}
    finally{ runtime.applyingHierarchy=false; }
    syncStoryScene({focus:true});
  }

  function exitStory(){
    runtime.active=false;
    runtime.lastSegment=null;
    runtime.lastPhase=null;
    runtime.lockedPhase=null;
    runtime.applyingCamera=false;
    runtime.applyingSceneData=false;
    clearTimeout(runtime.focusTimer);
    clearTimeout(runtime.chapterTimer);
    const globe=getGlobe();
    if(globe && typeof globe.arcsTransitionDuration==='function' && runtime.normalArcTransition!==null){
      try{ globe.arcsTransitionDuration(runtime.normalArcTransition); }catch{}
    }
    try{ globe?.arcCurveResolution?.(48); }catch{}
    const preview=$('#storyPreview');
    if(preview) preview.innerHTML='';
  }

  function wire(){
    const bodyObserver=new MutationObserver(()=>{
      const active=isStory();
      if(active && !runtime.active) enterStory();
      else if(!active && runtime.active) exitStory();
    });
    bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});

    $('#routeRange')?.addEventListener('input',()=>setTimeout(()=>syncStoryScene({focus:true}),0));
    $('#playBtn')?.addEventListener('click',()=>setTimeout(()=>syncStoryScene({focus:false}),0));
    document.addEventListener('click',e=>{
      if(e.target.closest('.speed-control button')) setTimeout(()=>syncStoryScene({focus:false}),0);
    });

    const timeline=$('#timelineTitle');
    if(timeline){
      new MutationObserver(()=>setTimeout(()=>syncStoryScene({focus:true}),0)).observe(timeline,{childList:true,characterData:true,subtree:true});
    }

    window.addEventListener('resize',()=>{
      if(!isStory()) return;
      setTimeout(()=>syncStoryScene({focus:true}),80);
    },{passive:true});

    if(isStory()) enterStory();
  }

  setTimeout(wire,0);
})();
