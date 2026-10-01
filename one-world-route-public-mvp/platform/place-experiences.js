(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const INDEX_URL='./data/platform/place-experiences/index.json';
  const profileMap=new Map();
  const loadedCountries=new Set();
  let indexPromise=null;

  const stopDays=stop=>{
    const start=Number(stop?.dayStart),end=Number(stop?.dayEnd);
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>=start)return end-start+1;
    const nights=Number(stop?.nights);
    return Number.isFinite(nights)&&nights>=0?Math.max(1,nights):1;
  };

  async function json(fetcher,url){
    const response=await fetcher(url,{cache:'no-cache'});
    if(!response?.ok)throw new Error('Place experience data '+(response?.status||'unavailable')+' for '+url);
    return response.json();
  }

  async function loadIndex(fetcher){
    if(!indexPromise)indexPromise=json(fetcher,INDEX_URL).catch(error=>{indexPromise=null;throw error});
    return indexPromise;
  }

  function requestedRefs(trip){
    return [...new Set((trip?.places||[]).map(place=>String(place?.experienceRef||'').trim()).filter(Boolean))];
  }

  async function loadForTrip(trip,{fetcher=fetch}={}){
    const refs=requestedRefs(trip);
    if(!refs.length)return {requested:0,loaded:0};
    const neededCountries=[...new Set(refs.map(ref=>ref.split(':')[0]).filter(Boolean))];
    const index=await loadIndex(fetcher);
    const byCountry=new Map((index?.shards||[]).map(item=>[item.countryCode,item]));
    await Promise.all(neededCountries.map(async countryCode=>{
      if(loadedCountries.has(countryCode))return;
      const shard=byCountry.get(countryCode);
      if(!shard?.dataset){loadedCountries.add(countryCode);return}
      const data=await json(fetcher,shard.dataset);
      for(const profile of data?.profiles||[])if(profile?.id)profileMap.set(profile.id,profile);
      loadedCountries.add(countryCode);
    }));
    return {requested:refs.length,loaded:refs.filter(ref=>profileMap.has(ref)).length};
  }

  function resolve(place){
    const ref=String(place?.experienceRef||'').trim();
    return ref?profileMap.get(ref)||null:null;
  }

  function routeRole(trip,stop){
    const ordered=[...(trip?.stops||[])].sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0));
    const index=ordered.findIndex(item=>item.id===stop?.id);
    if(index===0)return 'start';
    if(index===ordered.length-1)return 'finale';
    const days=stopDays(stop);
    const max=Math.max(0,...ordered.map(stopDays));
    if(days===max&&max>1)return 'anchor';
    return 'chapter';
  }

  function coverage(trip){
    const refs=(trip?.places||[]).map(place=>String(place?.experienceRef||'').trim()).filter(Boolean);
    return {
      referenced:refs.length,
      loaded:refs.filter(ref=>profileMap.has(ref)).length,
      uniqueProfiles:new Set(refs).size
    };
  }

  function render({trip,stop,place,t,esc,local,facetLabel}){
    const profile=resolve(place);
    if(!profile)return '';
    const role=routeRole(trip,stop);
    const roleKey={
      start:'experienceRoleStart',
      finale:'experienceRoleFinale',
      anchor:'experienceRoleAnchor',
      chapter:'experienceRoleChapter'
    }[role]||'experienceRoleChapter';
    const essence=local(profile.essence);
    const tags=(profile.tags||[]).slice(0,4).map(tag=>'<span>'+esc(facetLabel(tag))+'</span>').join('');
    const image=root.media?.resolveDestinationVisual?.({type:'place',id:profile.id});
    return '<section class="platform-stop-experience">'+(image?'<div class="platform-overview-visual">'+root.media.imageMarkup(image,esc,local)+root.media.credit(image,esc)+'</div>':'')+
      '<div class="platform-stop-experience-head"><span>'+esc(t('whatToExpect'))+'</span><b>'+esc(t(roleKey))+'</b></div>'+
      '<p>'+esc(essence)+'</p>'+
      (tags?'<div class="platform-stop-experience-tags">'+tags+'</div>':'')+
    '</section>';
  }

  root.placeExperiences={loadForTrip,resolve,routeRole,coverage,render};
})();
