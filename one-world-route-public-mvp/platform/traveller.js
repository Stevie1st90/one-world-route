(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const ALLOWED=['passports','residenceCountry','language','currency','origin','party','accessibility','vehicle'];
  function defaults(locale='en'){
    return {passports:[],residenceCountry:null,language:locale,currency:'EUR',origin:null,party:{adults:1,children:0},accessibility:{reducedMobility:false},vehicle:null};
  }
  function normalize(input,locale='en'){
    const base=defaults(locale),raw=input&&typeof input==='object'?input:{},safe={};
    for(const key of ALLOWED)if(Object.prototype.hasOwnProperty.call(raw,key))safe[key]=raw[key];
    return {
      ...base,
      ...safe,
      passports:Array.isArray(safe.passports)?safe.passports.filter(v=>typeof v==='string').slice(0,2):base.passports,
      party:{...base.party,...(safe.party&&typeof safe.party==='object'?safe.party:{})},
      accessibility:{...base.accessibility,...(safe.accessibility&&typeof safe.accessibility==='object'?safe.accessibility:{})},
      vehicle:safe.vehicle&&typeof safe.vehicle==='object'?{...safe.vehicle}:null
    };
  }
  function load(storage,key,locale='en'){
    try{return normalize(JSON.parse(storage.getItem(key)||'{}'),locale)}catch{return defaults(locale)}
  }
  function save(storage,key,profile,locale='en'){
    const normalized=normalize(profile,locale);
    storage.setItem(key,JSON.stringify(normalized));
    return normalized;
  }
  function clear(storage,key,locale='en'){storage.removeItem(key);return defaults(locale)}
  root.traveller={defaults,normalize,load,save,clear,allowedKeys:[...ALLOWED]};
})();
