(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const runtime=root.runtime,model=root.model;
  if(!runtime||!model)throw new Error('Platform runtime/model must load before road extension');

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
})();
