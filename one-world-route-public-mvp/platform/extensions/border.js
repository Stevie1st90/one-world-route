(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const runtime=root.runtime,model=root.model;
  if(!runtime||!model)throw new Error('Platform runtime/model must load before border extension');

  runtime.registerExtension('border',{
    segmentDetail(ctx){
      const border=model.extension(ctx.segment,'border');
      if(!border||border.zoneTransition==='domestic')return null;
      const label=border.zoneTransition==='schengen-exit'?ctx.t('schengenExit'):(border.zoneTransition==='schengen-entry'?ctx.t('schengenEntry'):border.zoneTransition);
      return {panels:`<div class="platform-border ${border.personalizationRequired?'requires-context':''}"><b>${ctx.esc(ctx.t('border'))}</b><span>${ctx.esc(label||'—')} · ${ctx.esc(border.fromCountry)} → ${ctx.esc(border.toCountry)}</span></div>`};
    }
  });
})();
