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
      if(d.getMeta?.()&&d.ensureDialog)return openMenu();
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

  function openMenu(){
    const d=context(),meta=d.getMeta?.();if(!meta)return shareCurrent();
    const modal=d.ensureDialog('platformShareMenu'),e=d.esc;
    modal.innerHTML='<div class="platform-modal-card share-menu-card"><button type="button" class="platform-x" aria-label="'+e(d.t('close'))+'">×</button><h2>'+e(d.t('shareJourney'))+'</h2><p>'+e(d.title())+'</p><div class="platform-share-actions"><button type="button" data-share-native>'+e(d.t('share'))+'</button><button type="button" data-share-link>'+e(d.t('copyLink'))+'</button><button type="button" data-share-story>'+e(d.t('socialStory'))+'</button><button type="button" data-share-caption>'+e(d.t('copyCaption'))+'</button><button type="button" data-share-planning>'+e(d.t('chooseStartDate'))+'</button></div></div>';
    modal.querySelector('.platform-x').onclick=()=>modal.classList.add('hidden');
    modal.querySelector('[data-share-native]').onclick=shareCurrent;
    const copy=async value=>{try{await navigator.clipboard.writeText(value);d.toast(d.t('shareCopied'))}catch{d.toast(d.t('shareCopyFallback'))}};
    modal.querySelector('[data-share-link]').onclick=()=>copy(d.url(meta));
    modal.querySelector('[data-share-caption]').onclick=()=>copy(root.socialStory.caption(meta,d));
    modal.querySelector('[data-share-story]').onclick=()=>root.socialStory.open(meta,d.getTrip?.()).catch(()=>d.toast(d.t('socialUnavailable')));
    modal.querySelector('[data-share-planning]').onclick=d.onPlanning;
    modal.classList.remove('hidden');
  }

  const api={configure,shareCurrent,bind,openMenu};
  root.share=api;
})();
