(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const CONFIG_URL='./data/platform/commercial-config.json';
  let config={schemaVersion:1,enabled:false,disclosureRequired:true,partners:[]};

  const https=value=>/^https:\/\//i.test(String(value||''));
  function normalize(input={}){
    const partners=Array.isArray(input.partners)?input.partners.filter(item=>
      item&&typeof item==='object'&&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(item.id||''))&&
      https(item.url)&&
      item.label&&typeof item.label==='object'
    ).map(item=>({
      id:String(item.id),
      label:item.label,
      url:String(item.url),
      category:String(item.category||'other'),
      regions:Array.isArray(item.regions)?item.regions.map(String):[],
      kinds:Array.isArray(item.kinds)?item.kinds.map(String):[],
      modes:Array.isArray(item.modes)?item.modes.map(String):[],
      themes:Array.isArray(item.themes)?item.themes.map(String):[]
    })):[];
    return {
      schemaVersion:Number(input.schemaVersion||1),
      enabled:Boolean(input.enabled)&&partners.length>0,
      disclosureRequired:input.disclosureRequired!==false,
      partners
    };
  }
  async function load(fetcher=fetch){
    try{
      const response=await fetcher(CONFIG_URL,{cache:'no-cache'});
      if(response.ok)config=normalize(await response.json());
    }catch(error){console.warn('Commercial config unavailable',error)}
    return status();
  }
  function status(){return {enabled:config.enabled,count:config.partners.length}}
  function intersects(a,b){return !a.length||a.some(value=>b.includes(value))}
  function linksFor(meta){
    if(!config.enabled)return [];
    const discovery=meta?.discovery||{},fit=discovery.fit||{};
    const regions=discovery.regions||[],modes=discovery.modes||[],themes=discovery.themes||[];
    return config.partners.filter(item=>
      (!item.kinds.length||item.kinds.includes(meta?.kind))&&
      intersects(item.regions,regions)&&
      intersects(item.modes,modes)&&
      intersects(item.themes,themes)
    ).slice(0,3);
  }
  function render(meta,{t,esc,local,facetLabel}={}){
    const items=linksFor(meta);
    if(!items.length)return '';
    const disclosure=config.disclosureRequired?'<p class="platform-partner-disclosure">'+esc(t('partnerDisclosure'))+'</p>':'';
    return '<section class="platform-partner-links"><div class="platform-overview-section-head"><span>'+esc(t('partnerOptions'))+'</span></div>'+disclosure+
      '<div class="platform-tool-actions">'+items.map(item=>
        '<a href="'+esc(item.url)+'" target="_blank" rel="sponsored noopener noreferrer" data-partner-id="'+esc(item.id)+'">'+
        esc(local(item.label))+' · '+esc(facetLabel(item.category))+' ↗</a>'
      ).join('')+'</div></section>';
  }
  root.partners={load,status,linksFor,render,normalize};
})();
