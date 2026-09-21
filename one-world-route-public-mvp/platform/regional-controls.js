(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional controls are not configured');
    return deps;
  }

  const $=(s,r=document)=>r.querySelector(s);

  function renderMethodology(){
    const d=context(),trip=d.getTrip();
    const modal=$('#infoModal'),card=$('.modal-card',modal);
    if(!modal||!card)return;
    const sourced=trip.segments.filter(segment=>(segment.verification?.sourceIds||[]).length).length;
    card.innerHTML=`<button class="modal-close" aria-label="Close">×</button><div class="eyebrow">${d.esc(d.t('methodology').toUpperCase())}</div><h2>${d.esc(d.t('routeMethodTitle'))}</h2><p>${d.esc(d.t('routeMethodText'))}</p><div class="method-grid"><article><b>${trip.stops.length}</b><span>${d.esc(d.t('stops'))}</span></article><article><b>${trip.segments.length}</b><span>${d.esc(d.t('segments'))}</span></article><article><b>${trip.planning?.days||'—'}</b><span>${d.esc(d.t('days'))}</span></article><article><b>${sourced}/${trip.segments.length}</b><span>${d.esc(d.t('evidenceCoverage'))}</span></article></div><h3>${d.esc(d.t('editorialStatus'))}</h3><p>${d.esc(d.t('editorial'))}</p>`;
    $('.modal-close',card)?.addEventListener('click',()=>modal.classList.add('hidden'));
  }

  function bind(id,event,handler){
    const el=$('#'+id);
    if(!el||el.dataset.platformRegionalWired)return;
    el.dataset.platformRegionalWired='1';
    el.addEventListener(event,handler);
  }

  function apply(){
    const d=context(),meta=d.getTripMeta();
    const actions=$('.top-actions');
    if(actions)actions.classList.add('platform-regional-actions');

    const brand=$('#brandBtn');
    if(brand)brand.onclick=d.onHome;

    const settingsButton=$('#settingsBtn');
    if(settingsButton){
      settingsButton.title=d.t('settings');
      settingsButton.setAttribute('aria-label',d.t('settings'));
    }
    const infoButton=$('#infoBtn');
    if(infoButton){
      infoButton.title=d.t('methodology');
      infoButton.setAttribute('aria-label',d.t('methodology'));
    }
    const shareButton=$('#shareBtn');
    if(shareButton){
      shareButton.title=d.t('share');
      shareButton.setAttribute('aria-label',d.t('share'));
    }
    const search=$('#searchBtn');
    if(search)search.hidden=true;

    const labels=[
      ['autoRotate','autoRotate'],
      ['highDetailGlobe','highDetail'],
      ['terrainView','terrain'],
      ['showPoints','showPoints'],
      ['routeGlow','routeGlow'],
      ['arcWidth','arcThickness'],
      ['reducedMotion','reducedMotion']
    ];
    const terrainToggle=$('#terrainView');
    const terrainLabel=terrainToggle?.closest('label');
    if(terrainLabel)terrainLabel.hidden=!d.hasCapability(meta,'terrain');
    for(const [id,key] of labels){
      const span=$('#'+id)?.closest('label')?.querySelector('span');
      if(span)span.textContent=d.t(key);
    }

    const title=$('#settingsPopover .settings-head h3');
    if(title)title.textContent=d.t('settings');
    const share=$('#mobileShareBtn');
    if(share)share.textContent=d.t('share');
    const info=$('#mobileInfoBtn');
    if(info)info.textContent=d.t('methodology');

    let storyButton=$('#regionalStorySettingsBtn');
    if(!storyButton){
      storyButton=document.createElement('button');
      storyButton.id='regionalStorySettingsBtn';
      storyButton.type='button';
      storyButton.addEventListener('click',()=>{
        $('#settingsPopover')?.classList.add('hidden');
        d.onStoryStart();
      });
      $('#settingsPopover .mobile-settings-actions')?.appendChild(storyButton);
    }
    if(storyButton){
      storyButton.textContent=d.t('storyPlay');
      storyButton.hidden=!d.hasCapability(meta,'story');
    }

    bind('autoRotate','change',d.onAutoRotateChange);
    bind('showPoints','change',d.onVisualChange);
    bind('routeGlow','change',d.onVisualChange);
    bind('arcWidth','input',d.onVisualChange);
    bind('reducedMotion','change',()=>{});
    renderMethodology();
  }

  const api={configure,apply,renderMethodology};
  root.regionalControls=api;
})();
