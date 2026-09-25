(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;
  const $=(s,r=document)=>r.querySelector(s);

  function configure(next){deps=next;return api}
  function context(){if(!deps)throw new Error('My Trips is not configured');return deps}

  function money(value,currency,locale){
    if(!Number.isFinite(Number(value)))return '—';
    try{return new Intl.NumberFormat(locale||'en',{style:'currency',currency:currency||'EUR',maximumFractionDigits:0}).format(Number(value))}
    catch{return String(Math.round(Number(value)))+' '+String(currency||'EUR')}
  }

  async function loadTrip(meta){
    const response=await fetch(meta.dataset,{cache:'no-cache'});
    if(!response.ok)throw new Error('Trip dataset '+response.status);
    return response.json();
  }

  function fitMarkup(meta,profile){
    const d=context(),fit=d.TravellerFit.evaluate(meta,profile),items=[];
    items.push('<span class="'+(fit.partyListed?'ok':'check')+'">'+d.esc(d.facetLabel(fit.party))+' · '+d.esc(fit.partyListed?d.t('contextListed'):d.t('contextCheckNeeded'))+'</span>');
    if(fit.reducedMobility)items.push('<span class="check">'+d.esc(d.t('mobilityCheck'))+' · '+d.esc(d.facetLabel(fit.accessibility||'standard-check'))+'</span>');
    if(fit.vehicleContextMissing)items.push('<span class="check">'+d.esc(d.t('vehicleContextMissing'))+'</span>');
    if(fit.originKnown)items.push('<span>'+d.esc(d.t('planningOrigin'))+': '+d.esc(fit.origin)+'</span>');
    return items.join('');
  }

  async function buildCard(meta,profile){
    const d=context(),id=meta.id,start=d.TripTools.getStartDate(d.storage,id),season=d.TripTools.getSeason(d.storage,id);
    const listedSeasons=meta.discovery?.fit?.seasons||[];
    const seasonListed=!season||listedSeasons.includes(season)||listedSeasons.includes('multi-season');
    let trip=null,snapshot=null,budget=null;
    try{
      trip=await loadTrip(meta);
      if((meta.capabilities||[]).includes('trip-planning')){
        snapshot=d.TripPlanning.snapshot(trip,meta);
        const assumptions=d.TripTools.getBudget(d.storage,id);
        if(d.TripTools.hasBudgetAssumptions(assumptions))budget=d.TripTools.estimate({snapshot,profile,assumptions});
      }
    }catch(error){console.warn('My Trips dataset unavailable',id,error)}
    const currency=snapshot?.currency||trip?.planning?.currency||meta.metrics?.budget?.currency||'EUR';
    const setup=[
      '<span class="'+(start?'ok':'')+'">'+d.esc(d.t('startDate'))+': <b>'+d.esc(start||d.t('notSet'))+'</b></span>',
      '<span class="'+(season?(seasonListed?'ok':'check'):'')+'">'+d.esc(d.t('fitSeason'))+': <b>'+d.esc(season?d.facetLabel(season)+(seasonListed?'':' · '+d.t('contextCheckNeeded')):d.t('notSet'))+'</b></span>',
      '<span class="'+(budget?'ok':'')+'">'+d.esc(d.t('budgetEstimate'))+': <b>'+d.esc(budget?money(budget.total,currency,d.locale()):d.t('notSet'))+'</b></span>'
    ].join('');
    return '<article class="platform-mytrip-card" data-mytrip="'+d.esc(id)+'">'+
      '<div class="platform-mytrip-head"><div><span>'+d.esc(d.statusLabel(meta))+'</span><h3>'+d.esc(d.local(meta.title))+'</h3></div><button type="button" data-mytrip-remove="'+d.esc(id)+'">×</button></div>'+
      '<p>'+d.esc(d.local(meta.subtitle))+'</p>'+
      '<div class="platform-mytrip-setup">'+setup+'</div>'+
      '<div class="platform-mytrip-fit">'+fitMarkup(meta,profile)+'</div>'+
      '<div class="platform-mytrip-actions"><button type="button" data-mytrip-open="'+d.esc(id)+'">'+d.esc(d.t('open'))+' →</button></div>'+
    '</article>';
  }

  async function render(modal){
    const d=context(),profile=d.loadProfile(),saved=d.TripTools.load(d.storage).savedTrips;
    const metas=(d.catalog.trips||[]).filter(meta=>saved.includes(meta.id));
    const body=$('[data-mytrips-body]',modal);
    const count=$('[data-mytrips-count]',modal);
    if(count)count.textContent=String(metas.length);
    if(!metas.length){
      body.innerHTML='<div class="platform-mytrips-empty"><b>'+d.esc(d.t('myTripsEmptyTitle'))+'</b><span>'+d.esc(d.t('myTripsEmptyLead'))+'</span></div>';
      return;
    }
    body.innerHTML='<div class="platform-mytrips-loading">'+d.esc(d.t('loading'))+'</div>';
    body.innerHTML=(await Promise.all(metas.map(meta=>buildCard(meta,profile)))).join('');
  }

  async function open(){
    const d=context(),modal=d.ensureDialog('platformMyTripsModal');
    modal.innerHTML='<div class="platform-modal-card platform-mytrips-card glass"><button class="platform-x" type="button" aria-label="'+d.esc(d.t('close'))+'">×</button>'+
      '<div class="platform-eyebrow">'+d.esc(d.t('myTrips'))+'</div><div class="platform-mytrips-title"><h2>'+d.esc(d.t('myTrips'))+' <span data-mytrips-count></span></h2><button type="button" data-mytrips-export>'+d.esc(d.t('exportWorkspace'))+'</button></div><p class="platform-lead">'+d.esc(d.t('myTripsLead'))+'</p>'+
      '<div data-mytrips-body></div></div>';
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    modal.onclick=async event=>{
      const exportBtn=event.target.closest('[data-mytrips-export]');
      if(exportBtn){d.TripTools.download('one-world-route-planning-workspace.json',d.TripTools.workspaceJson(d.storage),'application/json');return}
      const openBtn=event.target.closest('[data-mytrip-open]');
      if(openBtn){d.onOpenTrip(openBtn.dataset.mytripOpen);return}
      const removeBtn=event.target.closest('[data-mytrip-remove]');
      if(removeBtn){
        if(d.TripTools.isSaved(d.storage,removeBtn.dataset.mytripRemove))d.TripTools.toggleSaved(d.storage,removeBtn.dataset.mytripRemove);
        await render(modal);
      }
    };
    await render(modal);
    return modal;
  }

  const api={configure,open,render};
  root.myTrips=api;
})();
