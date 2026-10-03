(() => {
  'use strict';
  const host=typeof window==='undefined'?globalThis:window;
  const root=host.ONE_WORLD_PLATFORM_MODULES=host.ONE_WORLD_PLATFORM_MODULES||{};
  function capabilities(meta={},trip={}){
    const c=new Set(meta.capabilities||[]),modes=['explore'];
    if(c.has('trip-planning')||c.has('plan-vs-actual')||trip.planning)modes.push('plan');
    for(const id of ['story','terrain','operations'])if(c.has(id))modes.push(id);
    return modes;
  }
  function mount({meta,trip,t,esc,onPlan,onStory,onTerrain,onExplore,onOperations}){
    const modes=capabilities(meta,trip),legacy=meta.renderer==='legacy-world';
    const panel=document.querySelector('#leftPanel');if(!panel)return;
    document.querySelectorAll('.platform-journey-modes').forEach(node=>node.remove());
    const nav=document.createElement('nav');nav.className='platform-journey-modes';nav.setAttribute('aria-label',t('journeyModes'));
    nav.innerHTML=modes.map(mode=>'<button type="button" data-journey-mode="'+mode+'" aria-pressed="'+(mode==='explore')+'">'+esc(t({explore:'exploreMode',plan:'planMode',story:'story',terrain:'terrain',operations:'operationsMode'}[mode]))+'</button>').join('');
    panel.querySelector('.hero-copy')?.after(nav);
    const isStory=()=>document.body.classList.contains('story-mode')||document.body.classList.contains('platform-story-mode');
    const mobile=matchMedia('(max-width:820px)');
    const position=()=>{if(mobile.matches||isStory())document.querySelector('.globe-stage')?.appendChild(nav);else panel.querySelector('.hero-copy')?.after(nav)};
    position();mobile.addEventListener('change',position);
    nav.addEventListener('click',event=>{
      const button=event.target.closest('[data-journey-mode]');if(!button)return;
      const mode=button.dataset.journeyMode;
      const actions={explore:onExplore,plan:onPlan,story:onStory,terrain:onTerrain,operations:onOperations};
      if(actions[mode])actions[mode]();
      if(mode==='plan')return; // Dialog is transient; the explorer remains the active mode.
      sync(mode);
    });
    const sync=active=>nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.journeyMode===active)));
    const legacyMode=()=>{
      if(!legacy)return null;
      const appMode=host.__ONE_WORLD_ROUTE_APP__?.getState?.().mode;
      if(appMode)return appMode;
      return panel.querySelector('.mode-switch [data-mode].active')?.dataset.mode||'explore';
    };
    const update=()=>{position();sync(isStory()?'story':document.body.classList.contains('terrain-view')?'terrain':legacy?legacyMode():'explore')};
    const observer=new MutationObserver(update);
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    let legacyObserver=null;
    // Keep legacy mode controls as the adapter's event targets, not a second visible navigation.
    if(legacy){
      const old=panel.querySelector('.mode-switch');
      if(old){
        old.classList.add('platform-legacy-mode-adapter');
        legacyObserver=new MutationObserver(update);
        legacyObserver.observe(old,{subtree:true,attributes:true,attributeFilter:['class']});
      }
    }
    update();
    return {modes,sync,dispose:()=>{observer.disconnect();legacyObserver?.disconnect();mobile.removeEventListener('change',position);nav.remove()}};
  }
  root.journeyShell={capabilities,mount};
})();
