(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  function stepSegment(delta){
    const r=$('#routeRange'); if(!r)return;
    const n=Math.max(Number(r.min||1),Math.min(Number(r.max||194),Number(r.value||1)+delta));
    r.value=String(n);
    r.dispatchEvent(new Event('input',{bubbles:true}));
  }

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
      prev.addEventListener('click',()=>stepSegment(-1)); next.addEventListener('click',()=>stepSegment(1));
    }
  }

  function syncMode(){
    const active=$('.mode-switch button.active');
    document.body.dataset.mode=active?.dataset.mode||'explore';
  }

  function progressValue(){
    const r=$('#routeRange'); if(!r)return {value:1,max:194,pct:0};
    const min=Number(r.min||1),max=Number(r.max||194),value=Number(r.value||1);
    return {value,max,pct:Math.max(0,Math.min(100,((value-min)/(max-min))*100))};
  }

  function syncProgress(){
    const {value,max,pct}=progressValue();
    document.documentElement.style.setProperty('--journey-progress',`${pct}%`);
    const j=$('#journeyBtn'), p=$('#playBtn');
    if(j&&p){
      const running=p.textContent.trim()!=='▶';
      j.classList.toggle('active',running);
      const i=j.querySelector('.journey-icon');if(i)i.textContent=running?'Ⅱ':'▶';
      const label=j.querySelector('b');if(label)label.textContent=running?'Pause journey':'Play the journey';
    }
    const ctx=$('.journey-context');
    if(ctx){
      const count=ctx.querySelector('[data-progress-count]'); if(count)count.textContent=`${value} / ${max}`;
      const pctEl=ctx.querySelector('[data-progress-pct]'); if(pctEl)pctEl.textContent=`${Math.round(pct)}% of route`;
    }
  }

  function tuneGlobeDensity(){
    const width=$('#arcWidth');
    if(width && !width.dataset.iteration2Tuned){
      width.dataset.iteration2Tuned='1';
      width.value='0.34';
      width.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }

  function injectJourneyContext(){
    const box=$('#detailContent'); if(!box || box.querySelector('.journey-context'))return;
    const title=$('#detailTitle')?.textContent?.trim()||'';
    if(!title || /route at a glance/i.test(title))return;
    const {value,max,pct}=progressValue();
    const phase=$('#detailEyebrow')?.textContent?.replace(/^SEGMENT\s+\d+\s*·\s*/i,'')||'Journey';
    const card=document.createElement('div'); card.className='journey-context';
    card.innerHTML=`<div class="journey-context-top"><div><span>Journey position</span><b data-progress-count>${value} / ${max}</b></div><span data-progress-pct>${Math.round(pct)}% of route</span></div><div class="journey-context-track"><i></i></div><div class="journey-context-note"><span>Current chapter</span><strong>${phase}</strong></div>`;
    box.appendChild(card);
  }

  function wireObservers(){
    $$('.mode-switch button').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{syncMode();injectJourneyContext();},0)));
    $('#routeRange')?.addEventListener('input',()=>{syncProgress();setTimeout(injectJourneyContext,0)});
    $('#playBtn')?.addEventListener('click',()=>setTimeout(syncProgress,0));
    const p=$('#playBtn'); if(p)new MutationObserver(syncProgress).observe(p,{childList:true,characterData:true,subtree:true});
    const details=$('#detailContent'); if(details)new MutationObserver(()=>{setTimeout(()=>{injectJourneyContext();syncProgress();},0)}).observe(details,{childList:true,subtree:false});
    document.addEventListener('keydown',e=>{
      if(e.target && /input|select|textarea/i.test(e.target.tagName))return;
      if(e.key==='ArrowLeft')stepSegment(-1);
      if(e.key==='ArrowRight')stepSegment(1);
    });
  }

  function init(){
    ensureControls();syncMode();syncProgress();wireObservers();
    setTimeout(()=>{tuneGlobeDensity();injectJourneyContext();syncProgress();},350);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
