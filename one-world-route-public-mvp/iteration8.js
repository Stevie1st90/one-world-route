(() => {
  'use strict';

  const NASA_BMNG = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg';
  const STANDARD_EARTH = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';
  const runtime = { applied:false, retries:0, highDetail:true, preload:null };

  const $=(s,r=document)=>r.querySelector(s);

  function deviceSupportsHighDetail(){
    const saveData = navigator.connection?.saveData === true;
    const memory = Number(navigator.deviceMemory || 8);
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    return !saveData && !mobile && memory >= 4;
  }

  function highDetailEnabled(){
    const toggle=$('#highDetailGlobe');
    return Boolean(toggle?.checked && deviceSupportsHighDetail());
  }

  function tuneMaterial(globe){
    try{
      const material = globe.globeMaterial?.();
      if(!material) return;
      if('bumpMap' in material) material.bumpMap = null;
      if('bumpScale' in material) material.bumpScale = 0;
      material.color?.set?.(highDetailEnabled() ? '#8290a0' : '#ffffff');
      material.specular?.set?.('#101722');
      if('shininess' in material) material.shininess = highDetailEnabled() ? 2 : 4;
      material.needsUpdate = true;
    }catch(err){
      console.warn('Globe material tuning unavailable', err);
    }
  }

  function tuneControls(globe){
    try{
      const controls = globe.controls?.();
      if(!controls) return;
      controls.minDistance = highDetailEnabled() ? 132 : 170;
      controls.maxDistance = 520;
      controls.enableDamping = true;
      controls.dampingFactor = .075;
    }catch{}
  }

  function tuneRenderer(globe){
    try{
      const renderer = globe.renderer?.();
      if(!renderer) return;
      const cap = highDetailEnabled() ? 2 : 1.35;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    }catch{}
  }

  function applyTexture(globe){
    const useHigh=highDetailEnabled();
    runtime.highDetail=useHigh;
    tuneControls(globe);
    tuneRenderer(globe);
    tuneMaterial(globe);

    if(!useHigh){
      try{ globe.globeImageUrl?.(STANDARD_EARTH); }catch{}
      setTimeout(()=>tuneMaterial(globe),120);
      return;
    }

    const img = new Image();
    runtime.preload=img;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if(!highDetailEnabled()) return;
      try{
        globe.globeImageUrl?.(NASA_BMNG);
        setTimeout(() => tuneMaterial(globe), 120);
        setTimeout(() => tuneMaterial(globe), 700);
      }catch(err){
        console.warn('High-detail NASA globe texture could not be applied', err);
      }
    };
    img.onerror = () => console.warn('High-detail NASA globe texture unavailable; keeping standard globe texture.');
    img.src = NASA_BMNG;
  }

  function wireToggle(globe){
    const toggle=$('#highDetailGlobe');
    if(!toggle || toggle.dataset.iteration8Wired) return;
    toggle.dataset.iteration8Wired='1';
    if(!deviceSupportsHighDetail()){
      toggle.checked=false;
      toggle.disabled=true;
      toggle.title='High detail is disabled on this device to protect performance';
    }
    toggle.addEventListener('change',()=>applyTexture(globe));
  }

  function applyHighDetail(globe){
    if(!globe) return;
    runtime.applied = true;
    wireToggle(globe);
    applyTexture(globe);
  }

  function findGlobe(){
    const globe = window.__ONE_WORLD_ROUTE_GLOBE__;
    if(globe){
      applyHighDetail(globe);
      return;
    }
    if(runtime.retries++ < 80) setTimeout(findGlobe, 100);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(findGlobe, 0));
  } else {
    setTimeout(findGlobe, 0);
  }
})();
