(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;

  function configure(next){deps=next;return api}
  function context(){return deps||{}}
  async function shareCurrent(){
    const d=context();
    const title=String(d.title?.()||document.title||'ONE WORLD ROUTE');
    const url=String(location.href);
    if(typeof navigator.share==='function'){
      try{
        await navigator.share({title,url});
        return {ok:true,method:'native'};
      }catch(error){
        if(error?.name==='AbortError')return {ok:false,method:'native',reason:'cancelled'};
        console.warn('Native share failed, falling back to clipboard',error);
      }
    }
    if(navigator.clipboard?.writeText){
      try{
        await navigator.clipboard.writeText(url);
        d.toast?.(d.t?.('shareCopied')||'Share link copied');
        return {ok:true,method:'clipboard'};
      }catch(error){console.warn('Clipboard share failed',error)}
    }
    d.toast?.(d.t?.('shareCopyFallback')||'Copy the URL from your browser');
    return {ok:false,method:'manual'};
  }
  function bind(){
    const d=context();
    const handler=async()=>{
      const result=await shareCurrent();
      if(result.reason==='cancelled')return;
    };
    const desktop=document.querySelector('#shareBtn');
    if(desktop){
      desktop.title=d.t?.('share')||'Share';
      desktop.setAttribute('aria-label',d.t?.('share')||'Share');
      desktop.onclick=handler;
    }
    const mobile=document.querySelector('#mobileShareBtn');
    if(mobile){
      const label=d.t?.('share')||'Share';
      mobile.textContent=label;
      mobile.title=label;
      mobile.setAttribute('aria-label',label);
      mobile.onclick=()=>{
        document.querySelector('#settingsPopover')?.classList.add('hidden');
        return handler();
      };
    }
    return Boolean(desktop||mobile);
  }

  const api={configure,shareCurrent,bind};
  root.share=api;
})();
