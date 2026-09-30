(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  function open(meta,d){
    if(!meta)return;
    const modal=d.ensureDialog('platformPlanningContext'),e=d.esc,date=d.tripTools.getStartDate(d.storage,meta.id),scenario=meta.defaultPlanningScenario;
    modal.innerHTML='<form class="platform-modal-card planning-context-card"><button class="platform-x" type="button" aria-label="'+e(d.t('close'))+'">×</button><h2>'+e(d.t('chooseStartDate'))+'</h2><p>'+e(d.local(meta.title))+'</p><p class="platform-lead">'+e(d.t('planningDateLead'))+'</p><label>'+e(d.t('startDate'))+'<input type="date" name="startDate" value="'+e(date||'')+'"></label>'+(scenario?'<details><summary>'+e(d.t('historicalScenario'))+'</summary><p>'+e(scenario.startDate)+' · '+e(d.t('snapshotOnly'))+'</p></details>':'')+'<p class="platform-privacy">'+e(d.t('dateRecheckLead'))+'</p><div class="platform-form-actions"><button type="submit" class="primary">'+e(d.t('save'))+'</button></div></form>';
    modal.querySelector('.platform-x').onclick=()=>modal.classList.add('hidden');
    modal.querySelector('form').onsubmit=event=>{event.preventDefault();d.tripTools.setStartDate(d.storage,meta.id,new FormData(event.currentTarget).get('startDate'));location.reload()};
    modal.classList.remove('hidden');
  }
  root.planningContext={open};
})();
