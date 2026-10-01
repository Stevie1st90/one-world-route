(() => {
  'use strict';
  const host=typeof window==='undefined'?globalThis:window;
  const root=host.ONE_WORLD_PLATFORM_MODULES=host.ONE_WORLD_PLATFORM_MODULES||{};
  function model(meta={},countries=[]){
    const codes=[...new Set(countries.filter(c=>/^[A-Z]{2}$/.test(c)))];
    const count=Number(meta.metrics?.countries)||codes.length;
    // Broad journeys use one globe instead of suggesting three representative countries.
    const global=meta.kind==='world'||(meta.discovery?.regions||[]).includes('global');
    return {codes:global?[]:codes.slice(0,3),count,remaining:global?0:Math.max(0,count-3),global};
  }
  function markup(meta,countries,{esc,locale='en',t}){
    const m=model(meta,countries);
    if(!m.count)return '';
    const names=new Intl.DisplayNames([locale],{type:'region'});
    const label=m.count===1&&m.codes[0]?names.of(m.codes[0]):m.count+' '+t(m.count===1?'countryUnit':'countriesUnit');
    const globe='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></svg>';
    return '<div class="platform-country-chips" aria-label="'+esc(label)+'">'+(m.global?globe:m.codes.map(code=>'<img src="./assets/flags/'+code.toLowerCase()+'.svg" width="24" height="18" loading="lazy" alt="'+(m.count===1?'':esc(names.of(code)))+'"'+(m.count===1?' aria-hidden="true"':'')+'>').join(''))+(m.remaining?'<b aria-hidden="true">+'+m.remaining+'</b>':'')+'<span>'+esc(label)+'</span></div>';
  }
  root.countryFlags={model,markup};
})();
