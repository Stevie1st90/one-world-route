(() => {
  'use strict';

  const LOCAL_PREVIEW=['127.0.0.1','localhost','::1'].includes(location.hostname);

  async function cacheUrls(urls){
    if(LOCAL_PREVIEW||!('serviceWorker' in navigator))return {ok:false,reason:LOCAL_PREVIEW?'local-preview':'unsupported'};
    const registration=await navigator.serviceWorker.ready;
    const worker=navigator.serviceWorker.controller||registration.active;
    if(!worker)return {ok:false,reason:'inactive'};
    const list=[...new Set((urls||[]).map(value=>String(value||'')).filter(value=>value.startsWith('/')))];
    if(!list.length)return {ok:true,cached:0,total:0};
    return new Promise(resolve=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>resolve({ok:false,reason:'timeout',cached:0,total:list.length}),8000);
      channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||{ok:false,reason:'empty-response'})};
      worker.postMessage({type:'CACHE_URLS',urls:list},[channel.port2]);
    });
  }

  async function cacheTrip(meta){
    const dataset=String(meta?.dataset||'').replace(/^\.\//,'/');
    const urls=['/data/platform/trips.json','/data/platform/place-experiences/index.json'];
    if(dataset.startsWith('/')){
      urls.push(dataset);
      try{
        const response=await fetch(dataset,{cache:'no-cache'});
        if(response.ok){
          const trip=await response.json();
          const countries=[...new Set((trip.places||[]).map(place=>String(place.experienceRef||'').split(':')[0]).filter(code=>/^[A-Z]{2}$/.test(code)))];
          for(const code of countries)urls.push('/data/platform/place-experiences/'+code+'.json');
        }
      }catch{}
    }
    return cacheUrls(urls);
  }

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

  const api={register,cacheUrls,cacheTrip};
  window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  window.ONE_WORLD_PLATFORM_MODULES.serviceWorker=api;

  const start=()=>register().catch(error=>console.warn('ONE WORLD ROUTE service worker unavailable',error));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
