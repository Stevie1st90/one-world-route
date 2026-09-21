(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const runtime=root.runtime;
  if(!runtime)throw new Error('Platform runtime must load before extension composition');

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
