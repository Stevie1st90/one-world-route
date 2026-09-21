(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;
  let observer=null;
  let scheduled=false;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Legacy localization is not configured');
    return deps;
  }

  function translate(raw){
    const d=context(),locale=d.getLocale();
    const text=String(raw||'').trim();
    if(!text||locale==='en')return text;
    const localeData=root.i18n;
    if(!localeData)return text;
    const dict={
      ...(localeData.legacyWorldText?.[locale]||{}),
      ...(localeData.legacyExtra?.[locale]||{}),
      ...(localeData.legacyShort?.[locale]||{})
    };
    if(dict[text])return dict[text];
    const exactKey=Object.keys(dict).find(key=>key.toLocaleLowerCase('en')===text.toLocaleLowerCase('en'));
    if(exactKey)return dict[exactKey];
    if(localeData.legacyPhases?.[locale]?.[text])return localeData.legacyPhases[locale][text];

    let match=text.match(/^(\d{2})\s+(.+)$/);
    if(match&&localeData.legacyPhases?.[locale]?.[match[2]])return `${match[1]} ${localeData.legacyPhases[locale][match[2]]}`;
    match=text.match(/^CHAPTER\s+(\d+)\s*\/\s*(\d+)$/i);
    if(match){
      const chapterLabel={de:'KAPITEL',it:'CAPITOLO',es:'CAPÍTULO',fr:'CHAPITRE',pt:'CAPÍTULO'}[locale]||'CHAPTER';
      return `${chapterLabel} ${match[1]} / ${match[2]}`;
    }
    match=text.match(/^Country\s+(\d+)\s*\/\s*195$/i);
    if(match)return `${d.t('country')} ${match[1]}/195`;
    match=text.match(/^Country\s+(\d+)\s*·\s*(.+)$/i);
    if(match)return `${d.t('country')} ${match[1]} · ${translate(match[2])}`;
    match=text.match(/^Day\s+(\d+)$/i);
    if(match)return `${d.t('day')} ${match[1]}`;
    match=text.match(/^Segment\s+(\d+)\s*·\s*Day\s+([^·]+)\s*·\s*(.+)$/i);
    if(match)return `${d.t('segment')} ${match[1]} · ${d.t('day')} ${match[2].trim()} · ${match[3]}`;
    match=text.match(/^Segment\s+(\d+)\s*\/\s*(\d+)$/i);
    if(match)return `${d.t('segment')} ${match[1]} / ${match[2]}`;
    return text;
  }

  function localizeNode(nodeRoot=document){
    const d=context(),locale=d.getLocale();
    if(locale==='en'||document.body.classList.contains('platform-regional-trip'))return;
    const walker=document.createTreeWalker(nodeRoot,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const raw=node.nodeValue,trimmed=String(raw||'').trim();
      if(!trimmed)continue;
      const translated=translate(trimmed);
      if(translated!==trimmed)node.nodeValue=raw.replace(trimmed,translated);
    }
    for(const el of nodeRoot.querySelectorAll?.('[placeholder],[title],[aria-label]')||[]){
      for(const attr of ['placeholder','title','aria-label']){
        const raw=el.getAttribute(attr);
        if(!raw)continue;
        const translated=translate(raw);
        if(translated!==raw)el.setAttribute(attr,translated);
      }
    }
  }

  function activate(){
    const d=context();
    document.documentElement.lang=d.getLocale();
    localizeNode(document.body);
    if(observer)observer.disconnect();
    observer=new MutationObserver(mutations=>{
      if(scheduled||document.body.classList.contains('platform-regional-trip'))return;
      scheduled=true;
      requestAnimationFrame(()=>{
        scheduled=false;
        for(const mutation of mutations){
          for(const node of mutation.addedNodes){
            if(node.nodeType===Node.ELEMENT_NODE)localizeNode(node);
            else if(node.nodeType===Node.TEXT_NODE&&node.parentElement)localizeNode(node.parentElement);
          }
          if(mutation.type==='characterData'&&mutation.target.parentElement)localizeNode(mutation.target.parentElement);
        }
      });
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  }

  const api={configure,translate,localizeNode,activate};
  root.legacyLocalization=api;
})();
