(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let data={schemaVersion:1,items:[]};

  async function load(url='./data/platform/shared-knowledge.json'){
    try{
      const response=await fetch(url,{cache:'no-cache'});
      if(!response.ok)throw new Error('Shared knowledge '+response.status);
      data=await response.json();
    }catch(error){
      console.warn('Shared journey knowledge unavailable',error);
      data={schemaVersion:1,items:[]};
    }
    return data;
  }

  function tripModes(trip){
    return [...new Set((trip?.segments||[]).map(segment=>segment.transport?.mode).filter(Boolean))];
  }

  function matches(item,trip){
    const a=item?.appliesTo||{},modes=tripModes(trip),countries=[...new Set((trip?.places||[]).map(place=>place.countryCode).filter(Boolean))];
    if(a.tripIds?.length&&!a.tripIds.includes(trip?.id))return false;
    if(a.tripKinds?.length&&!a.tripKinds.includes(trip?.kind))return false;
    if(a.modes?.length&&!a.modes.some(mode=>modes.includes(mode)))return false;
    if(a.countryCodes?.length&&!a.countryCodes.some(code=>countries.includes(code)))return false;
    if(Number.isFinite(Number(a.minimumCountries))&&countries.length<Number(a.minimumCountries))return false;
    return true;
  }

  function forTrip(trip){
    return (data?.items||[]).filter(item=>matches(item,trip));
  }

  function render({trip,t,esc,local}){
    const items=forTrip(trip);
    if(!items.length)return '';
    return '<details class="platform-shared-guidance"><summary><span>'+esc(t('journeyUpdates'))+'</span><b>'+items.length+'</b></summary><p>'+esc(t('journeyUpdatesLead'))+'</p><div>'+items.map(item=>'<article><strong>'+esc(local(item.title))+'</strong><span>'+esc(local(item.summary))+'</span><small>'+esc(t(item.reviewMode==='before-travel'?'checkBeforeTravel':'contextDependent'))+'</small></article>').join('')+'</div></details>';
  }

  root.sharedKnowledge={load,forTrip,render,getData:()=>data};
})();
