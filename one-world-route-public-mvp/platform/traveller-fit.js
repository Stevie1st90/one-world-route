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

  function preferences(profile){
    const raw=profile?.preferences&&typeof profile.preferences==='object'?profile.preferences:{};
    const value=key=>typeof raw[key]==='string'&&raw[key].trim()?raw[key].trim():null;
    return {
      durationBand:value('durationBand'),
      pace:value('pace'),
      season:value('season'),
      mode:value('mode'),
      theme:value('theme')
    };
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
      originCountry:profile?.originCountry||null,
      originRegion:profile?.originRegion||null,
      startRegion:fit.startRegion||null,
      pace:fit.pace||null,
      seasons:[...(fit.seasons||[])],
      preferences:preferences(profile)
    };
  }

  function recommendationSignals(meta,profile){
    const d=meta?.discovery||{},fit=d.fit||{},pref=preferences(profile),signals=[];
    const add=(kind,value,source)=>{if(value)signals.push({kind,value,source})};
    if(pref.durationBand&&d.durationBand===pref.durationBand)add('duration',pref.durationBand,'preference');
    if(pref.pace&&fit.pace===pref.pace)add('pace',pref.pace,'preference');
    if(pref.season&&(fit.seasons||[]).includes(pref.season))add('season',pref.season,'preference');
    if(pref.mode&&(d.modes||[]).includes(pref.mode))add('mode',pref.mode,'preference');
    if(pref.theme&&(d.themes||[]).includes(pref.theme))add('theme',pref.theme,'preference');

    const party=partyKey(profile);
    if(profile?.originRegion&&((d.regions||[]).includes(profile.originRegion)||fit.startRegion===profile.originRegion))add('origin',profile.originRegion,'context');
    if(party&&(fit.party||[]).includes(party))add('party',party,'context');
    if(profile?.vehicle&&(d.modes||[]).some(mode=>mode==='car'||mode==='road'))add('vehicle','car','context');
    return signals;
  }

  function configuredPreferenceCount(profile){
    return Object.values(preferences(profile)).filter(Boolean).length;
  }

  function orderRecommendations(trips,profile){
    const configured=configuredPreferenceCount(profile);
    return (trips||[]).map(trip=>{
      const signals=recommendationSignals(trip,profile);
      const preferenceMatches=signals.filter(signal=>signal.source==='preference').length;
      const contextMatches=signals.filter(signal=>signal.source==='context').length;
      return {
        trip,
        signals,
        preferenceMatches,
        preferenceMisses:Math.max(0,configured-preferenceMatches),
        contextMatches
      };
    }).sort((a,b)=>
      a.preferenceMisses-b.preferenceMisses||
      b.preferenceMatches-a.preferenceMatches||
      b.contextMatches-a.contextMatches||
      Number(b.trip?.visual?.featurePriority||0)-Number(a.trip?.visual?.featurePriority||0)||
      String(a.trip?.id||'').localeCompare(String(b.trip?.id||''))
    );
  }

  function recommendationReasons(meta,profile){
    const priority=['duration','pace','season','mode','theme','origin','party','vehicle'];
    const reasons=recommendationSignals(meta,profile)
      .sort((a,b)=>priority.indexOf(a.kind)-priority.indexOf(b.kind))
      .map(({kind,value})=>({kind,value}));
    const firstMode=meta?.discovery?.modes?.[0]||null;
    if(reasons.length<3&&firstMode&&!reasons.some(reason=>reason.kind==='mode'))reasons.push({kind:'mode',value:firstMode});
    return reasons.slice(0,3);
  }

  root.travellerFit={partyKey,preferences,evaluate,recommendationSignals,recommendationReasons,configuredPreferenceCount,orderRecommendations};
})();
