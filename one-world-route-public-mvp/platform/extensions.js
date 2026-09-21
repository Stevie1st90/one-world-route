(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const runtime=root.runtime,model=root.model;
  if(!runtime||!model)throw new Error('Platform runtime/model must load before extensions');

  runtime.registerExtension('cruise',{
    tripOverview(ctx){
      const cruise=model.extension(ctx.trip,'cruise');
      if(!cruise)return null;
      return {
        cards:`<div class="data-card"><span>${ctx.esc(ctx.t('onboardNights'))}</span><b>${cruise.nights??'—'}</b></div><div class="data-card"><span>${ctx.esc(ctx.t('seaDays'))}</span><b>${cruise.seaDays??0}</b></div>`,
        notices:cruise.requiresSailingSelection?`<div class="platform-cruise-note">${ctx.esc(ctx.t('sailingNeeded'))}</div>`:''
      };
    },
    stopDetail(ctx){
      const call=model.extension(ctx.stop,'cruiseCall');
      const refs=model.extension(ctx.place,'port')?.sourceIds||[];
      if(!call&&!refs)return null;
      const callLabel=call?.kind==='embarkation'?ctx.t('embarkation'):(call?.kind==='disembarkation'?ctx.t('disembarkation'):(call?ctx.t('portCall'):null));
      return {
        cards:callLabel?`<div class="data-card"><span>${ctx.esc(ctx.t('portCall'))}</span><b>${ctx.esc(callLabel)}</b></div>`:'',
        notices:`<div class="platform-cruise-note">${ctx.esc(ctx.t('sailingNeeded'))}</div>`,
        sourceIds:refs
      };
    },
    segmentDetail(ctx){
      const cruise=model.extension(ctx.segment,'cruise');
      if(!cruise)return null;
      return {panels:`<div class="platform-cruise-leg"><div><span>${ctx.esc(ctx.t('onboardNights'))}</span><b>${cruise.onboardNights??0}</b></div><div><span>${ctx.esc(ctx.t('seaDays'))}</span><b>${(cruise.seaDayNumbers||[]).join(', ')||'—'}</b></div></div>`};
    }
  });

  runtime.registerExtension('road',{
    tripOverview(ctx){
      const road=model.extension(ctx.trip,'roadTrip');
      if(!road)return null;
      return {notices:road.vehicleContextRequired&&!ctx.profile?.vehicle?`<div class="platform-cruise-note">${ctx.esc(ctx.t('vehicleNeeded'))}</div>`:''};
    },
    segmentDetail(ctx){
      const road=model.extension(ctx.segment,'road');
      if(!road)return null;
      return {panels:`<div class="platform-road-context"><div><span>${ctx.esc(ctx.t('roadRules'))}</span><b>${road.crossBorder?ctx.esc(ctx.t('crossBorder')):ctx.esc(road.fromCountry||'')}</b></div><div><span>${ctx.esc(ctx.t('urbanAccess'))}</span><b>${ctx.esc((road.urbanAccessChecks||[]).join(' · ')||'—')}</b></div>${!ctx.profile?.vehicle?`<p>${ctx.esc(ctx.t('vehicleNeeded'))}</p>`:''}</div>`};
    }
  });

  runtime.registerExtension('border',{
    segmentDetail(ctx){
      const border=model.extension(ctx.segment,'border');
      if(!border||border.zoneTransition==='domestic')return null;
      const label=border.zoneTransition==='schengen-exit'?ctx.t('schengenExit'):(border.zoneTransition==='schengen-entry'?ctx.t('schengenEntry'):border.zoneTransition);
      return {panels:`<div class="platform-border ${border.personalizationRequired?'requires-context':''}"><b>${ctx.esc(ctx.t('border'))}</b><span>${ctx.esc(label||'—')} · ${ctx.esc(border.fromCountry)} → ${ctx.esc(border.toCountry)}</span></div>`};
    }
  });

  function compose(method,ctx){
    const result={cards:'',notices:'',panels:'',sourceIds:[]};
    for(const extension of runtime.listExtensions()){
      const fn=extension[method];
      if(typeof fn!=='function')continue;
      const part=fn(ctx);
      if(!part)continue;
      result.cards+=part.cards||'';
      result.notices+=part.notices||'';
      result.panels+=part.panels||'';
      if(Array.isArray(part.sourceIds))result.sourceIds.push(...part.sourceIds);
    }
    result.sourceIds=[...new Set(result.sourceIds)];
    return result;
  }
  root.extensions={
    composeTripOverview:ctx=>compose('tripOverview',ctx),
    composeStopDetail:ctx=>compose('stopDetail',ctx),
    composeSegmentDetail:ctx=>compose('segmentDetail',ctx)
  };
})();
