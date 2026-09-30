(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deferred=null;
  let installed=window.matchMedia?.('(display-mode: standalone)')?.matches===true;
  const listeners=new Set();

  function emit(){
    const state=status();
    for(const listener of listeners){
      try{listener(state)}catch(error){console.warn('PWA install listener failed',error)}
    }
  }

  function status(){
    return {available:Boolean(deferred)&&!installed,installed};
  }

  async function prompt(){
    if(installed)return {ok:true,outcome:'installed'};
    if(!deferred)return {ok:false,outcome:'unavailable'};
    const request=deferred;
    deferred=null;
    emit();
    try{
      await request.prompt();
      const choice=await request.userChoice;
      if(choice?.outcome==='accepted')installed=true;
      emit();
      return {ok:choice?.outcome==='accepted',outcome:choice?.outcome||'dismissed'};
    }catch(error){
      console.warn('PWA install prompt failed',error);
      emit();
      return {ok:false,outcome:'error'};
    }
  }

  function subscribe(listener){
    if(typeof listener!=='function')return ()=>{};
    listeners.add(listener);
    listener(status());
    return ()=>listeners.delete(listener);
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferred=event;
    installed=false;
    emit();
  });

  window.addEventListener('appinstalled',()=>{
    deferred=null;
    installed=true;
    emit();
  });

  root.pwaInstall={status,prompt,subscribe};
})();
