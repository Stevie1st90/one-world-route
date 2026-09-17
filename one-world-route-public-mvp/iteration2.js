(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  function ensureControls(){
    const stage=$('.globe-stage');
    if(stage && !$('#journeyBtn')){
      const b=document.createElement('button');
      b.id='journeyBtn'; b.className='journey-btn glass';
      b.innerHTML='<span class="journey-icon">▶</span><span><b>Play the journey</b><small>Follow all 194 route legs</small></span>';
      stage.appendChild(b);
      b.addEventListener('click',()=>$('#playBtn')?.click());
    }
    const play=$('#playBtn');
    if(play && !$('#prevBtn')){
      const prev=document.createElement('button'); prev.id='prevBtn'; prev.className='timeline-step'; prev.setAttribute('aria-label','Previous segment'); prev.textContent='‹';
      const next=document.createElement('button'); next.id='nextBtn'; next.className='timeline-step'; next.setAttribute('aria-label','Next segment'); next.textContent='›';
      play.parentNode.insertBefore(prev,play); play.after(next);
      const step=delta=>{const r=$('#routeRange');if(!r)return;const n=Math.max(Number(r.min||1),Math.min(Number(r.max||194),Number(r.value||1)+delta));r.value=String(n);r.dispatchEvent(new Event('input',{bubbles:true}));};
      prev.addEventListener('click',()=>step(-1)); next.addEventListener('click',()=>step(1));
    }
  }

  function syncMode(){
    const active=$('.mode-switch button.active');
    document.body.dataset.mode=active?.dataset.mode||'explore';
  }

  function syncProgress(){
    const r=$('#routeRange'); if(!r)return;
    const min=Number(r.min||1),max=Number(r.max||194),v=Number(r.value||1);
    const pct=((v-min)/(max-min))*100;
    document.documentElement.style.setProperty('--journey-progress',`${Math.max(0,Math.min(100,pct))}%`);
    const j=$('#journeyBtn'), p=$('#playBtn');
    if(j&&p){const running=p.textContent.trim()!=='▶';j.classList.toggle('active',running);const i=j.querySelector('.journey-icon');if(i)i.textContent=running?'Ⅱ':'▶';}
  }

  function wireObservers(){
    $$('.mode-switch button').forEach(b=>b.addEventListener('click',()=>setTimeout(syncMode,0)));
    $('#routeRange')?.addEventListener('input',syncProgress);
    $('#playBtn')?.addEventListener('click',()=>setTimeout(syncProgress,0));
    const p=$('#playBtn'); if(p)new MutationObserver(syncProgress).observe(p,{childList:true,characterData:true,subtree:true});
  }

  function init(){ensureControls();syncMode();syncProgress();wireObservers();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
