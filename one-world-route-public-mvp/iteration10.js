(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);

  function terrainIsActive(){
    return document.body.classList.contains('terrain-view') || document.body.classList.contains('terrain-loading') || $('#terrainView')?.checked === true;
  }

  function preserveTerrainView(nextUrl){
    try{
      const current=new URL(location.href);
      const next=new URL(String(nextUrl||location.href),location.href);
      if(terrainIsActive() && current.searchParams.get('view')==='terrain' && !next.searchParams.has('view')){
        next.searchParams.set('view','terrain');
      }
      return `${next.pathname}${next.search}${next.hash}`;
    }catch{
      return nextUrl;
    }
  }

  function wrapHistory(){
    if(history.__oneWorldTerrainWrapped)return;
    history.__oneWorldTerrainWrapped=true;
    const nativeReplace=history.replaceState.bind(history);
    history.replaceState=function(state,title,url){
      return nativeReplace(state,title,url==null?url:preserveTerrainView(url));
    };
  }

  function ensureFocusButton(){
    const stage=$('.globe-stage');
    if(!stage||$('#terrainFocusBtn'))return;
    const btn=document.createElement('button');
    btn.id='terrainFocusBtn';
    btn.type='button';
    btn.className='terrain-focus-btn';
    btn.innerHTML='<span>◎</span> Focus current route';
    btn.addEventListener('click',()=>{
      const range=$('#routeRange');
      if(!range)return;
      range.dispatchEvent(new Event('input',{bubbles:true}));
    });
    stage.appendChild(btn);
  }

  function ensureStyles(){
    if($('#iteration10Styles'))return;
    const style=document.createElement('style');
    style.id='iteration10Styles';
    style.textContent=`
      .terrain-focus-btn{display:none;position:absolute;z-index:25;right:22px;bottom:24px;align-items:center;gap:7px;padding:9px 12px;border:1px solid rgba(89,221,255,.24);border-radius:12px;background:rgba(7,14,24,.88);color:#dff8ff;font:600 9px/1.1 system-ui,sans-serif;letter-spacing:.03em;box-shadow:0 10px 30px rgba(0,0,0,.22);backdrop-filter:blur(14px);cursor:pointer}
      .terrain-focus-btn span{font-size:13px;color:#59ddff}
      .terrain-focus-btn:hover{border-color:rgba(89,221,255,.48);background:rgba(10,22,36,.94)}
      body.terrain-view .terrain-focus-btn{display:flex}
      @media(max-width:820px){.terrain-focus-btn{right:12px;bottom:72px;padding:8px 10px}.terrain-focus-btn{font-size:8px}}
    `;
    document.head.appendChild(style);
  }

  function loadConsistencyLayer(){
    if(document.querySelector('script[data-iteration11]'))return;
    const script=document.createElement('script');
    script.src='./iteration11.js';
    script.defer=true;
    script.dataset.iteration11='1';
    document.head.appendChild(script);
  }

  function repairUrl(){
    if(!terrainIsActive())return;
    const p=new URLSearchParams(location.search);
    if(p.get('view')==='terrain')return;
    p.set('view','terrain');
    history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
  }

  function wire(){
    wrapHistory();
    ensureStyles();
    ensureFocusButton();
    loadConsistencyLayer();

    new MutationObserver(()=>{
      if(terrainIsActive())setTimeout(repairUrl,0);
    }).observe(document.body,{attributes:true,attributeFilter:['class']});

    $('#routeRange')?.addEventListener('input',()=>setTimeout(repairUrl,0));
    $('#phaseRail')?.addEventListener('click',()=>setTimeout(repairUrl,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();