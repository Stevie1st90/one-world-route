(() => {
  'use strict';

  const NASA_BMNG = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg';
  const runtime = { applied:false, retries:0 };

  function prefersHighDetail(){
    const saveData = navigator.connection?.saveData === true;
    const memory = Number(navigator.deviceMemory || 8);
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    return !saveData && !mobile && memory >= 4;
  }

  function tuneMaterial(globe){
    try{
      const material = globe.globeMaterial?.();
      if(!material) return;

      // The old low-resolution topology bump map produced black polygon-like artifacts
      // at close zoom. BMNG already contains shaded topography, so a second bump layer
      // is not needed for the public explorer.
      if('bumpMap' in material) material.bumpMap = null;
      if('bumpScale' in material) material.bumpScale = 0;

      // Keep the natural NASA texture inside the established dark visual language.
      material.color?.set?.('#8290a0');
      material.specular?.set?.('#101722');
      if('shininess' in material) material.shininess = 2;
      material.needsUpdate = true;
    }catch(err){
      console.warn('High-detail globe material tuning unavailable', err);
    }
  }

  function tuneControls(globe){
    try{
      const controls = globe.controls?.();
      if(!controls) return;
      controls.minDistance = prefersHighDetail() ? 132 : 155;
      controls.maxDistance = 520;
      controls.enableDamping = true;
      controls.dampingFactor = .075;
    }catch{}
  }

  function tuneRenderer(globe){
    try{
      const renderer = globe.renderer?.();
      if(!renderer) return;
      const cap = prefersHighDetail() ? 2 : 1.35;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    }catch{}
  }

  function applyHighDetail(globe){
    if(runtime.applied || !globe) return;
    runtime.applied = true;

    tuneControls(globe);
    tuneRenderer(globe);
    tuneMaterial(globe);

    if(!prefersHighDetail()) return;

    // Preload before swapping so a slow/failing external image never blanks the globe.
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try{
        globe.globeImageUrl?.(NASA_BMNG);
        // Re-apply after texture replacement because Globe.gl may refresh the material map.
        setTimeout(() => tuneMaterial(globe), 120);
        setTimeout(() => tuneMaterial(globe), 700);
      }catch(err){
        console.warn('High-detail NASA globe texture could not be applied', err);
      }
    };
    img.onerror = () => console.warn('High-detail NASA globe texture unavailable; keeping standard globe texture.');
    img.src = NASA_BMNG;
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
