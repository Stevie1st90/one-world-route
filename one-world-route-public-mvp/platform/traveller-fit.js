(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  function partyKey(profile){
    const adults=Math.max(0,Number(profile?.party?.adults||0));
    const children=Math.max(0,Number(profile?.party?.children||0));
    if(children>0)return 'families';
    if(adults<=1)return 'solo';
    if(adults===2)return 'couples';
    return 'friends';
  }

  function evaluate(meta,profile){
    const fit=meta?.discovery?.fit||{};
    const capabilities=meta?.capabilities||[];
    const party=partyKey(profile);
    const parties=fit.party||[];
    const partyListed=parties.length===0||parties.includes(party);
    const reducedMobility=profile?.accessibility?.reducedMobility===true;
    const accessibility=fit.accessibility||null;
    const needsMobilityCheck=reducedMobility;
    const vehicleRequired=capabilities.includes('vehicle-context');
    const vehicleProvided=Boolean(profile?.vehicle);
    const originKnown=Boolean(profile?.origin);
    return {
      party,
      partyListed,
      reducedMobility,
      accessibility,
      needsMobilityCheck,
      vehicleRequired,
      vehicleProvided,
      vehicleContextMissing:vehicleRequired&&!vehicleProvided,
      originKnown,
      origin:profile?.origin||null,
      originRegion:profile?.originRegion||null,
      startRegion:fit.startRegion||null,
      pace:fit.pace||null,
      seasons:[...(fit.seasons||[])]
    };
  }

  function recommendationReasons(meta,profile){
    const result=evaluate(meta,profile),reasons=[];
    if(result.originRegion&&result.startRegion===result.originRegion)reasons.push({kind:'origin',value:result.startRegion});
    if(result.partyListed&&result.party)reasons.push({kind:'party',value:result.party});
    const mode=meta?.discovery?.modes?.[0];
    if(mode)reasons.push({kind:'mode',value:mode});
    return reasons.slice(0,3);
  }

  root.travellerFit={partyKey,evaluate,recommendationReasons};
})();
