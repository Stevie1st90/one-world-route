(() => {
  'use strict';

  const LOCAL_PREVIEW=['127.0.0.1','localhost','::1'].includes(location.hostname);

  async function register(){
    if(LOCAL_PREVIEW||!('serviceWorker' in navigator))return {supported:false,reason:LOCAL_PREVIEW?'local-preview':'unsupported'};
    const hadController=Boolean(navigator.serviceWorker.controller);
    let reloading=false;
    const registration=await navigator.serviceWorker.register('/sw.js',{
      scope:'/',
      updateViaCache:'none'
    });

    const activateWaiting=worker=>{
      if(worker?.state==='installed')worker.postMessage({type:'SKIP_WAITING'});
    };

    if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>activateWaiting(worker));
    });

    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!hadController||reloading)return;
      reloading=true;
      location.reload();
    });

    registration.update().catch(error=>console.warn('ONE WORLD ROUTE update check failed',error));
    return {supported:true,registration};
  }

  const api={register};
  window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  window.ONE_WORLD_PLATFORM_MODULES.serviceWorker=api;

  const start=()=>register().catch(error=>console.warn('ONE WORLD ROUTE service worker unavailable',error));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
