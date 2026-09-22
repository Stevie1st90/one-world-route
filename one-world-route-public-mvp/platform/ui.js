(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const $=(s,r=document)=>r.querySelector(s);

  function ensureDialog(id,cls='platform-modal'){
    let modal=$('#'+id);
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id=id;
    modal.className=`${cls} hidden`;
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});
    document.body.appendChild(modal);
    return modal;
  }

  function ensureGlobalActions({t,esc,onHome,onRoutes,onTraveller}){
    const top=$('.topbar');
    if(!top||$('#platformRouteBtn'))return;
    const actions=$('.top-actions',top);
    const wrap=document.createElement('div');
    wrap.className='platform-actions';
    wrap.innerHTML=`<button id="platformHomeBtn" class="platform-pill secondary" type="button" aria-label="${esc(t('home'))}" title="${esc(t('home'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/></svg></span><span class="platform-pill-label">${esc(t('home'))}</span></button><button id="platformRouteBtn" class="platform-pill" type="button" aria-label="${esc(t('routes'))}" title="${esc(t('routes'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg></span><span class="platform-pill-label">${esc(t('routes'))}</span></button><button id="platformTravellerBtn" class="platform-pill secondary" type="button" aria-label="${esc(t('traveller'))}" title="${esc(t('traveller'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-4.2 3-6.3 6.5-6.3s5.7 2.1 6.5 6.3"/></svg></span><span class="platform-pill-label">${esc(t('traveller'))}</span></button>`;
    top.insertBefore(wrap,actions||null);
    $('#platformHomeBtn').onclick=onHome;
    $('#platformRouteBtn').onclick=onRoutes;
    $('#platformTravellerBtn').onclick=onTraveller;
  }

  function toast(message){
    const node=$('#toast');
    if(!node)return;
    node.textContent=message;
    node.classList.add('show');
    clearTimeout(node._platformTimer);
    node._platformTimer=setTimeout(()=>node.classList.remove('show'),2600);
  }

  function regionalSettings(){
    return {
      autoRotate:$('#autoRotate')?.checked===true,
      showPoints:$('#showPoints')?.checked!==false,
      routeGlow:$('#routeGlow')?.checked!==false,
      arcWidth:Number($('#arcWidth')?.value||.55),
      reducedMotion:$('#reducedMotion')?.checked===true
    };
  }

  root.ui={ensureDialog,ensureGlobalActions,toast,regionalSettings};
})();
