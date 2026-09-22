(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  function create(){
    let node=document.querySelector('#platformHome');
    if(node)return node;
    node=document.createElement('section');
    node.id='platformHome';
    node.className='platform-home hidden';
    node.setAttribute('aria-label','ONE WORLD ROUTE');
    document.body.appendChild(node);
    return node;
  }

  function show({catalog,t,local,esc,facetLabel,statusLabel,onOpenTrip,locale}){
    const home=create();
    const trips=catalog?.trips||[];
    const localBuilder=location.hostname==='127.0.0.1'&&location.port==='4175';
    const flagship=trips.find(item=>item.id===catalog.defaultTripId);
    const regional=trips.filter(item=>item.id!==catalog.defaultTripId);
    const card=item=>{
      const m=item.metrics||{};
      const metric=item.id===catalog.defaultTripId
        ? `${m.countries||195} ${esc(t('countriesUnit'))} · ${m.internationalLegs||194} ${esc(t('segments'))}`
        : `${m.days??'—'} ${esc(t('days'))} · ${m.stops??'—'} ${esc(t('stops'))}`;
      return `<article class="platform-home-card ${item.id===catalog.defaultTripId?'flagship':''}">
        <div class="platform-home-card-top"><span>${esc(statusLabel(item))}</span><span>${esc(facetLabel(item.kind))}</span></div>
        <h2>${esc(local(item.title))}</h2>
        <p>${esc(local(item.subtitle||item.summary)||metric)}</p>
        <div class="platform-home-card-meta">${metric}</div>
        <button type="button" data-home-trip="${esc(item.id)}">${esc(t('open'))} →</button>
      </article>`;
    };
    home.innerHTML=`<div class="platform-home-bg"></div>
      <div class="platform-home-shell">
        <header class="platform-home-head">
          <div class="platform-home-brand"><span class="brand-orbit"><i></i></span><div><strong>ONE WORLD ROUTE</strong><small>${esc(t('routeLibraryLead'))}</small></div></div>
          <div class="platform-home-head-actions">${localBuilder?'<a href="/__builder/">Internal Trip Builder</a>':''}<button type="button" id="platformHomeTraveller">${esc(t('traveller'))}</button></div>
        </header>
        <main class="platform-home-main">
          <div class="platform-home-hero">
            <span>${esc(t('routeLibrary'))}</span>
            <h1>${esc(t('homeTitle'))}</h1>
            <p>${esc(t('homeLead'))}</p>
          </div>
          <div class="platform-home-featured">${flagship?card(flagship):''}</div>
          <div class="platform-home-section-head"><div><span>${esc(t('homeMore'))}</span><b>${regional.length} ${esc(regional.length===1?t('resultOne'):t('results'))}</b></div></div>
          <div class="platform-home-grid">${regional.map(card).join('')}</div>
        </main>
        <footer class="platform-home-foot">ONE WORLD ROUTE · ${esc(String(locale||'en').toUpperCase())}</footer>
      </div>`;
    document.body.classList.add('platform-home-active');
    home.classList.remove('hidden');
    home.querySelectorAll('[data-home-trip]').forEach(button=>button.addEventListener('click',()=>onOpenTrip(button.dataset.homeTrip)));
    return home;
  }

  function hide(){
    document.body.classList.remove('platform-home-active');
    document.querySelector('#platformHome')?.classList.add('hidden');
  }

  root.home={show,hide};
})();