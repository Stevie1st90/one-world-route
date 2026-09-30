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
  function dateLabel(value,locale){
    if(!value)return '';
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return '';
    try{return new Intl.DateTimeFormat(locale||'en',{year:'numeric',month:'short',day:'numeric'}).format(date)}
    catch{return String(value).slice(0,10)}
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

  function planningLabel(id){
    const d=context();
    return {
      origin:d.t('planningOrigin'),
      routeStart:d.t('routeStart'),
      startDate:d.t('startDate'),
      budget:d.t('budgetEstimate'),
      access:d.t('planningAccessCheck')
    }[id]||id;
  }

  function planningMarkup({meta,trip,profile,budget,currency,start}){
    const d=context(),id=meta.id,hasPlanning=(meta.capabilities||[]).includes('trip-planning');
    const eligible=trip?(d.journeyAdapter?.eligibleStartStops?.(trip)||[trip?.stops?.[0]].filter(Boolean)):[];
    const routeStartRequired=eligible.length>1;
    const plan=d.TripTools.planningStatus({storage:d.storage,tripId:id,profile,hasPlanning,routeStartRequired});
    const routeStartId=d.TripTools.getRouteStart(d.storage,id);
    const places=new Map((trip?.places||[]).map(place=>[place.id,place]));
    const routeStop=eligible.find(stop=>stop.id===routeStartId)||null;
    const routeName=routeStop?d.local(places.get(routeStop.placeId)?.name):'';
    const checks=d.TripTools.getPlanningChecks(d.storage,id);
    const origin=String(profile?.origin||profile?.originCountry||'').trim();
    const values={
      origin:origin||d.t('notSet'),
      routeStart:routeName||d.t('notSet'),
      startDate:start||d.t('notSet'),
      budget:budget?money(budget.total,currency,d.locale()):d.t('notSet'),
      access:checks.accessCheckedAt?(d.t('manualCheckRecorded')+' · '+dateLabel(checks.accessCheckedAt,d.locale())):d.t('currentCheck')
    };
    const steps=plan.items.map(item=>
      '<span class="platform-mytrip-plan-step '+(item.complete?'ok':'pending')+'" data-planning-step="'+d.esc(item.id)+'">'+
        '<i aria-hidden="true">'+(item.complete?'✓':'·')+'</i><span><b>'+d.esc(planningLabel(item.id))+'</b><small>'+d.esc(values[item.id]||d.t('notSet'))+'</small></span>'+
      '</span>'
    ).join('');
    const next=plan.complete?d.t('planningCoreRecorded'):(d.t('nextPlanningStep')+': '+planningLabel(plan.next));
    const actionText=checks.accessCheckedAt?d.t('markForRecheck'):d.t('recordCurrentCheck');
    return '<section class="platform-mytrip-plan">'+
      '<div class="platform-mytrip-plan-head"><div><span>'+d.esc(d.t('planningStatus'))+'</span><b>'+d.esc(next)+'</b></div><strong>'+d.esc(String(plan.completed))+' / '+d.esc(String(plan.total))+'</strong></div>'+
      '<div class="platform-mytrip-plan-list">'+steps+'</div>'+
      '<div class="platform-mytrip-plan-foot"><small>'+d.esc(d.t('planningStatusLead'))+'</small><button type="button" data-mytrip-access-check="'+d.esc(id)+'" data-checked="'+(checks.accessCheckedAt?'true':'false')+'">'+d.esc(actionText)+'</button></div>'+
    '</section>';
  }

  async function buildCard(meta,profile){
    const d=context(),id=meta.id,start=d.TripTools.getStartDate(d.storage,id),season=d.TripTools.getSeason(d.storage,id);
    const listedSeasons=meta.discovery?.fit?.seasons||[];
    const seasonListed=!season||listedSeasons.includes(season)||listedSeasons.includes('multi-season');
    let trip=null,snapshot=null,budget=null;
    try{
      trip=await loadTrip(meta);
      const variantId=d.TripTools.getVariant(d.storage,id);
      if(d.journeyVariants?.apply)trip=d.journeyVariants.apply(trip,variantId);
      if((meta.capabilities||[]).includes('trip-planning')){
        snapshot=d.TripPlanning.snapshot(trip,meta);
        const assumptions=d.TripTools.getBudget(d.storage,id);
        if(d.TripTools.hasBudgetAssumptions(assumptions))budget=d.TripTools.estimate({snapshot,profile,assumptions});
      }
    }catch(error){console.warn('My Trips dataset unavailable',id,error)}
    const currency=snapshot?.currency||trip?.planning?.currency||meta.metrics?.budget?.currency||'EUR';
    const activeVariant=trip?._variant?.id||'base';
    const setup=[
      '<span class="'+(activeVariant!=='base'?'ok':'')+'">'+d.esc(d.t('journeyVariant'))+': <b>'+d.esc(activeVariant==='base'?d.t('fullJourney'):d.local(trip?.title))+'</b></span>',
      '<span class="'+(start?'ok':'')+'">'+d.esc(d.t('startDate'))+': <b>'+d.esc(start||d.t('notSet'))+'</b></span>',
      '<span class="'+(season?(seasonListed?'ok':'check'):'')+'">'+d.esc(d.t('fitSeason'))+': <b>'+d.esc(season?d.facetLabel(season)+(seasonListed?'':' · '+d.t('contextCheckNeeded')):d.t('notSet'))+'</b></span>',
      '<span class="'+(budget?'ok':'')+'">'+d.esc(d.t('budgetEstimate'))+': <b>'+d.esc(budget?money(budget.total,currency,d.locale()):d.t('notSet'))+'</b></span>'
    ].join('');
    return '<article class="platform-mytrip-card" data-mytrip="'+d.esc(id)+'">'+
      '<div class="platform-mytrip-head"><div><span>'+d.esc(d.statusLabel(meta))+'</span><h3>'+d.esc(d.local(trip?.title||meta.title))+'</h3></div><button type="button" data-mytrip-remove="'+d.esc(id)+'" aria-label="'+d.esc(d.t('removeSaved'))+'">×</button></div>'+
      '<p>'+d.esc(d.local((trip?._variant?.id&&trip._variant.id!=='base')?trip.summary:meta.subtitle))+'</p>'+
      '<div class="platform-mytrip-setup">'+setup+'</div>'+
      planningMarkup({meta,trip,profile,budget,currency,start})+
      '<div class="platform-mytrip-fit">'+fitMarkup(meta,profile)+'</div>'+
      '<div class="platform-mytrip-actions"><button type="button" data-mytrip-offline="'+d.esc(id)+'">'+d.esc(d.t('saveOffline'))+'</button><button type="button" data-mytrip-open="'+d.esc(id)+'">'+d.esc(d.t('continuePlanning'))+' →</button></div>'+
    '</article>';
  }

  function recentCard(meta){
    const d=context(),id=meta.id;
    return '<article class="platform-mytrip-recent" data-mytrip-recent="'+d.esc(id)+'">'+
      '<div><span>'+d.esc(d.facetLabel(meta.kind))+'</span><b>'+d.esc(d.local(meta.title))+'</b><small>'+d.esc(d.local(meta.subtitle))+'</small></div>'+
      '<div><button type="button" data-mytrip-save="'+d.esc(id)+'">'+d.esc(d.t('saveTrip'))+'</button><button type="button" data-mytrip-open="'+d.esc(id)+'">'+d.esc(d.t('open'))+' →</button></div>'+
    '</article>';
  }

  async function render(modal){
    const d=context(),profile=d.loadProfile(),state=d.TripTools.load(d.storage),saved=state.savedTrips,recent=d.TripTools.getRecent(d.storage);
    const metas=(d.catalog.trips||[]).filter(meta=>saved.includes(meta.id)).sort((a,b)=>{
      const aDate=d.TripTools.getStartDate(d.storage,a.id)||'9999-12-31';
      const bDate=d.TripTools.getStartDate(d.storage,b.id)||'9999-12-31';
      return aDate.localeCompare(bDate)||d.local(a.title).localeCompare(d.local(b.title));
    });
    const recentMetas=recent.map(id=>(d.catalog.trips||[]).find(meta=>meta.id===id)).filter(meta=>meta&&!saved.includes(meta.id)).slice(0,6);
    const body=$('[data-mytrips-body]',modal);
    const count=$('[data-mytrips-count]',modal);
    if(count)count.textContent=String(metas.length);
    if(!metas.length&&!recentMetas.length){
      body.innerHTML='<div class="platform-mytrips-empty"><b>'+d.esc(d.t('myTripsEmptyTitle'))+'</b><span>'+d.esc(d.t('myTripsEmptyLead'))+'</span></div>';
      return;
    }
    body.innerHTML='<div class="platform-mytrips-loading">'+d.esc(d.t('loading'))+'</div>';
    const savedMarkup=metas.length?'<section class="platform-mytrips-group"><h3>'+d.esc(d.t('savedJourneys'))+'</h3>'+(await Promise.all(metas.map(meta=>buildCard(meta,profile)))).join('')+'</section>':'';
    const recentMarkup=recentMetas.length?'<section class="platform-mytrips-group platform-mytrips-recent-group"><h3>'+d.esc(d.t('recentlyViewed'))+'</h3>'+recentMetas.map(recentCard).join('')+'</section>':'';
    body.innerHTML=savedMarkup+recentMarkup;
  }

  async function open(){
    const d=context(),modal=d.ensureDialog('platformMyTripsModal');
    modal.innerHTML='<div class="platform-modal-card platform-mytrips-card glass"><button class="platform-x" type="button" aria-label="'+d.esc(d.t('close'))+'">×</button>'+
      '<div class="platform-eyebrow">'+d.esc(d.t('myTrips'))+'</div><div class="platform-mytrips-title"><h2>'+d.esc(d.t('myTrips'))+' <span data-mytrips-count></span></h2><div class="platform-mytrips-portability"><button type="button" data-mytrips-install hidden>'+d.esc(d.t('installApp'))+'</button><button type="button" data-mytrips-import>'+d.esc(d.t('importWorkspace'))+'</button><button type="button" data-mytrips-export>'+d.esc(d.t('exportWorkspace'))+'</button><input type="file" accept="application/json,.json" data-mytrips-import-file hidden></div></div><p class="platform-lead">'+d.esc(d.t('myTripsLead'))+'</p>'+
      '<div data-mytrips-body></div></div>';
    modal.classList.remove('hidden');
    const installBtn=$('[data-mytrips-install]',modal);
    const refreshInstall=state=>{
      if(!installBtn)return;
      const next=state||d.pwaInstall?.status?.()||{};
      installBtn.hidden=!next.available;
      installBtn.disabled=false;
      installBtn.textContent=d.t('installApp');
    };
    const unsubscribeInstall=d.pwaInstall?.subscribe?.(refreshInstall)||(()=>{});
    $('.platform-x',modal).onclick=()=>{unsubscribeInstall();modal.classList.add('hidden')};
    const importFile=$('[data-mytrips-import-file]',modal);
    $('[data-mytrips-import]',modal).onclick=()=>importFile?.click();
    if(importFile)importFile.onchange=async()=>{
      const file=importFile.files?.[0];
      if(!file)return;
      const result=d.TripTools.importWorkspace(d.storage,await file.text(),(d.catalog.trips||[]).map(item=>item.id));
      importFile.value='';
      d.toast(result.ok?d.t('workspaceImported'):d.t('workspaceImportFailed'));
      if(result.ok)await render(modal);
    };
    modal.onclick=async event=>{
      const installTarget=event.target.closest('[data-mytrips-install]');
      if(installTarget){
        if(!d.pwaInstall?.prompt){d.toast(d.t('installAppUnavailable'));return}
        installTarget.disabled=true;
        installTarget.textContent=d.t('installingApp');
        const result=await d.pwaInstall.prompt();
        if(result?.ok)d.toast(d.t('installAppDone'));
        else if(result?.outcome==='unavailable'||result?.outcome==='error')d.toast(d.t('installAppUnavailable'));
        refreshInstall();
        return;
      }
      const exportBtn=event.target.closest('[data-mytrips-export]');
      if(exportBtn){d.TripTools.download('one-world-route-planning-workspace.json',d.TripTools.workspaceJson(d.storage),'application/json');return}
      const checkBtn=event.target.closest('[data-mytrip-access-check]');
      if(checkBtn){
        d.TripTools.setAccessChecked(d.storage,checkBtn.dataset.mytripAccessCheck,checkBtn.dataset.checked!=='true');
        await render(modal);
        return;
      }
      const saveBtn=event.target.closest('[data-mytrip-save]');
      if(saveBtn){
        if(!d.TripTools.isSaved(d.storage,saveBtn.dataset.mytripSave))d.TripTools.toggleSaved(d.storage,saveBtn.dataset.mytripSave);
        await render(modal);
        return;
      }
      const offlineBtn=event.target.closest('[data-mytrip-offline]');
      if(offlineBtn){
        const meta=(d.catalog.trips||[]).find(item=>item.id===offlineBtn.dataset.mytripOffline);
        if(!meta||!d.serviceWorker?.cacheTrip){d.toast(d.t('offlineUnavailable'));return}
        offlineBtn.disabled=true;
        const original=offlineBtn.textContent;
        offlineBtn.textContent=d.t('offlineSaving');
        try{
          const result=await d.serviceWorker.cacheTrip(meta);
          d.toast(result?.ok?d.t('offlineReady'):d.t('offlineUnavailable'));
        }catch(error){
          console.warn('Offline trip cache failed',error);
          d.toast(d.t('offlineUnavailable'));
        }finally{
          offlineBtn.disabled=false;
          offlineBtn.textContent=original;
        }
        return;
      }
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
