(() => {
  'use strict';
  const host=typeof window==='undefined'?globalThis:window;
  const usable=a=>a?.type==='image'&&a.status==='published'&&a.rightsStatus==='approved'&&Boolean(a.license&&a.attribution)&&/^\.\/assets\/[a-z0-9_./-]+$/i.test(a.asset||'')&&!a.asset.split('/').includes('..');
  function destinationCandidate(meta,assets=[],countries=[]){
    const anchor=meta.visualAnchor||meta.visual?.visualAnchor;
    const target=anchor||(countries.length===1?{type:'country',id:countries[0]}:null);
    if(!target)return null;
    return assets.find(a=>usable(a)&&a.destination?.type===target.type&&a.destination?.id===target.id)||null;
  }
  function resolveJourneyVisual(meta={},context={}){
    const {journeyCover,destinationAssets=[],autoRouteVisual,countries=[],purpose='discoveryCard',ratio='landscape'}=context;
    const broad=['CONTINENTAL','GLOBAL'].includes(autoRouteVisual?.scope);
    const destination=broad&&!(meta.visualAnchor||meta.visual?.visualAnchor)?null:destinationCandidate(meta,destinationAssets,countries);
    const choices=purpose==='planning'?[['auto',autoRouteVisual],['bespoke',journeyCover],['destination',destination]]:[['bespoke',journeyCover],['destination',destination],['auto',autoRouteVisual]];
    for(const [kind,entry] of choices){
      if(!usable(entry))continue;
      // Native vertical geometry is mandatory for automatic social visuals.
      if(kind==='auto'&&ratio!=='landscape'&&!entry.derivatives?.[ratio])continue;
      if(purpose==='social'&&ratio==='vertical'&&kind!=='auto'&&!entry.derivatives?.vertical&&entry.aspectRatio!=='9:16')continue;
      return {kind,entry,coverageLevel:usable(journeyCover)?'JOURNEY-BESPOKE':destination?'DESTINATION-ENRICHED':'AUTO'};
    }
    return {kind:'abstract',entry:null,coverageLevel:null};
  }
  const api={usable,destinationCandidate,resolveJourneyVisual};
  host.ONE_WORLD_VISUAL_POLICY=api;
  (host.ONE_WORLD_PLATFORM_MODULES=host.ONE_WORLD_PLATFORM_MODULES||{}).visualPolicy=api;
})();
