(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const runtime=root.runtime,model=root.model;
  if(!runtime||!model)throw new Error('Platform runtime/model must load before cruise extension');

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
      if(!call&&!refs.length)return null;
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
})();
