(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional shell is not configured');
    return deps;
  }

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function stopButton(stop,index){
    const d=context(),trip=d.getTrip(),place=d.stopPlace(trip,stop);
    return `<button type="button" data-stop-index="${index}" class="platform-stop ${index===0?'active':''}"><span>${String(stop.sequence).padStart(2,'0')}</span><div><b>${d.esc(d.local(place?.name))}</b><small>${d.esc(d.t('day'))} ${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''} · ${stop.nights||0} ${d.esc(d.t('nights'))}</small></div></button>`;
  }

  function buildLeftNavigation(){
    const d=context(),trip=d.getTrip();
    const panel=$('#leftPanel');
    if(!panel)return;
    panel.scrollTop=0;
    $('.platform-regional-nav',panel)?.remove();
    const nav=document.createElement('div');
    nav.className='platform-regional-nav';
    nav.innerHTML=`<div class="section-title"><span>${d.esc(d.t('stops'))}</span><span class="pill">${trip.stops.length}</span></div><div class="platform-stop-list">${trip.stops.map((stop,index)=>stopButton(stop,index)).join('')}</div>`;
    panel.appendChild(nav);
    $$('[data-stop-index]',nav).forEach(button=>{
      button.onclick=()=>d.selectStop(Number(button.dataset.stopIndex),true);
    });
  }

  function buildChapterRail(){
    const d=context(),trip=d.getTrip();
    const rail=$('#phaseRail');
    if(!rail)return;
    const chapters=trip.chapters||[];
    rail.classList.toggle('platform-empty-rail',chapters.length===0);
    rail.innerHTML=chapters.map((chapter,index)=>`<button type="button" data-trip-chapter="${index}" class="${index===0?'active':''}"><span class="phase-dot"></span>${d.esc(d.local(chapter.title))}</button>`).join('');
    $$('[data-trip-chapter]',rail).forEach(button=>{
      button.onclick=()=>{
        $$('[data-trip-chapter]',rail).forEach(item=>item.classList.toggle('active',item===button));
        const chapter=trip.chapters[Number(button.dataset.tripChapter)];
        const index=trip.stops.findIndex(stop=>stop.id===chapter.stopIds?.[0]);
        if(index>=0)d.selectStop(index,true);
      };
    });
  }

  function apply(){
    const d=context(),trip=d.getTrip();
    d.isolateRegionalRuntime();
    d.syncRegionalUrl();
    document.documentElement.lang=d.getLocale();
    document.title=`${d.local(trip.title)} — ONE WORLD ROUTE`;
    const meta=$('meta[name="description"]');
    if(meta)meta.content=d.local(trip.summary);
    const brandSmall=$('.brand small');
    if(brandSmall)brandSmall.textContent=d.local(trip.title);
    const hero=$('.hero-copy');
    if(hero){
      hero.innerHTML=`<div class="eyebrow"><span class="live-dot"></span>${d.esc(d.facetLabel(trip.kind))} · ${trip.planning?.days||''} ${d.esc(d.t('days'))}</div><h1>${d.esc(d.local(trip.title))}</h1><p>${d.esc(d.local(trip.summary))}</p><div class="platform-template-note">${d.esc(d.t('editorial'))}</div>`;
    }
    const kpis=$('#topKpis');
    if(kpis)kpis.innerHTML=`<div class="kpi"><b>${trip.planning?.days||'—'}</b><span>${d.esc(d.t('days'))}</span></div><div class="kpi"><b>${trip.stops?.length||0}</b><span>${d.esc(d.t('stops'))}</span></div><div class="kpi"><b>${trip.segments?.length||0}</b><span>${d.esc(d.t('segments'))}</span></div>`;
    const mobileFilters=$('#mobileFilters');
    if(mobileFilters)mobileFilters.textContent=d.t('stops');
    const mobileDetails=$('#mobileDetails');
    if(mobileDetails)mobileDetails.textContent=d.t('details');

    buildLeftNavigation();
    buildChapterRail();
    d.replaceTimeline();
    d.ensureStoryUi();
    d.configureRegionalSettings();
    d.renderTripOverview();
  }

  const api={configure,apply,buildLeftNavigation,buildChapterRail};
  root.regionalShell=api;
})();
