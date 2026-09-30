(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const palette=Object.freeze({europe:'#67c9ef',asia:'#bca0ed',africa:'#e7b46a','north-america':'#79adc9','south-america':'#7bc6a1',oceania:'#72d2cf',polar:'#c1def1',global:'#bdd0e1'});
  function region(value,subregion=''){
    const key=String(value||'').toLowerCase().replace(/\s+/g,'-');
    if(palette[key])return key;
    if(key==='americas')return /south/i.test(subregion)?'south-america':'north-america';
    if(/arctic|antarctic|polar/.test(key))return 'polar';
    return Object.keys(palette).find(r=>key.includes(r))||null;
  }
  function identity(meta={},hint){
    const primary=region(hint)||region(meta.visual?.primaryRegion)||(meta.discovery?.regions||[]).map(v=>region(v)).find(Boolean)||'global';
    const themes=meta.discovery?.themes||[],kind=meta.kind||'';
    const family=meta.visual?.visualFamily||(/world/.test(kind)?'planetary':/rail/.test(kind)?'rail-cinematic':/island|cruise/.test(kind)?'coastal-editorial':/road|camper|motorcycle/.test(kind)?'road-cinematic':themes.some(t=>/nature|expedition|adventure/.test(t))?'nature-atmospheric':'culture-editorial');
    return {primaryRegion:primary,color:palette[primary],visualFamily:family};
  }
  root.visualIdentity={palette,region,identity};
})();
