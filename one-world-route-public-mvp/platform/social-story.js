(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;
  const positive=v=>Number.isFinite(v)&&v>0;
  function facts(meta,t){
    const m=meta.metrics||{},parts=[];
    if(positive(m.countries))parts.push(m.countries+' '+t(m.countries===1?'countryUnit':'countriesUnit'));
    if(positive(m.days))parts.push(m.days+' '+t('days'));
    if(positive(m.stops))parts.push(m.stops+' '+t('stops'));
    return parts.join(' · ');
  }
  const caption=(meta,d)=>d.local(meta.title)+'\n'+facts(meta,d.t)+'\n'+d.t('exploreFullJourney')+' — ONE WORLD ROUTE\n'+d.url(meta);
  async function exportScene({meta,scene,media,index,d}){
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
    ctx.fillStyle='#081923';ctx.fillRect(0,0,1080,1920);
    if(media.type==='image'){
      const img=new Image();img.src=media.asset;await img.decode();
      const scale=Math.max(1080/img.width,1920/img.height),w=img.width*scale,h=img.height*scale;
      ctx.drawImage(img,(1080-w)*media.focalPoint.x,(1920-h)*media.focalPoint.y,w,h);
    }
    const gradient=ctx.createLinearGradient(0,320,0,1920);gradient.addColorStop(0,'rgba(4,12,20,.18)');gradient.addColorStop(.55,'rgba(4,12,20,.76)');gradient.addColorStop(1,'rgba(4,12,20,.98)');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1920);
    ctx.fillStyle='#fff';ctx.font='600 28px sans-serif';ctx.fillText('ONE WORLD ROUTE',72,118);
    const lines=(text,font,maxWidth)=>{ctx.font=font;const out=[];let line='';for(const word of String(text||'').split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){out.push(line);line=word}else line=next;}if(line)out.push(line);return out;};
    // Fit all real copy instead of silently clipping long translations.
    let size=84,title=lines(scene.title,'700 '+84+'px sans-serif',936);
    while(title.length>6&&size>36){size-=4;title=lines(scene.title,'700 '+size+'px sans-serif',936);}
    const body=lines(scene.body,'400 36px sans-serif',936);
    let y=Math.max(500,1560-title.length*size*1.12-body.length*48-130);
    ctx.font='600 26px sans-serif';ctx.fillStyle='#93e3dc';ctx.fillText(scene.label,72,y);y+=70;
    ctx.fillStyle='#fff';ctx.font='700 '+size+'px sans-serif';for(const line of title){ctx.fillText(line,72,y);y+=size*1.12;}
    y+=32;ctx.font='400 36px sans-serif';ctx.fillStyle='#dce9f2';for(const line of body){ctx.fillText(line,72,y);y+=48;}
    ctx.font='500 26px sans-serif';ctx.fillStyle='#a8becb';ctx.fillText('one-world-route.vercel.app',72,1788);ctx.fillText(String(index+1)+' / 5',918,1788);
    ctx.font='400 22px sans-serif';const note=d.t(media.sourceType==='route-render'?'routeVisualNote':'illustratedRoute');for(const [i,line] of lines(note,'400 22px sans-serif',936).entries())ctx.fillText(line,72,1848+i*28);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Image export failed');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='one-world-route--'+meta.id+'--story-'+(index+1)+'--'+d.locale()+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function open(meta,trip){
    const d=deps;if(!d||!meta)return;
    if(!trip)trip=await fetch(meta.dataset).then(r=>{if(!r.ok)throw Error('Journey unavailable');return r.json()});
    trip=await root.media.resolveReference(meta,trip);
    const modal=d.ensureDialog('platformSocialStory'),identity=root.visualIdentity.identity(meta);
    let preview=root.media.tripPreview(trip);
    let stops=(trip.stops||[]).map(s=>d.local((trip.places||[]).find(p=>p.id===s.placeId)?.name)).filter(Boolean);
    if(!preview.arcs.length&&(trip.countries||[]).length){
      const countries=await fetch('./data/country-centroids.json').then(r=>r.json());const byName=new Map(countries.map(c=>[c.name,c]));
      const names=new Intl.DisplayNames([d.locale()],{type:'region'});
      preview={arcs:(trip.segments||[]).map(s=>({start:byName.get(s.from),end:byName.get(s.to)})).filter(a=>a.start&&a.end)};
      stops=(trip.countries||[]).slice(0,6).map(c=>{const geo=byName.get(c.name);return geo?.cca2?names.of(geo.cca2):c.name});
    }
    const visual=root.media.routeArt(preview),mode=(meta.discovery?.modes||[]).map(d.facetLabel).join(' · ');
    const resolved=root.media.resolveJourneyVisual(meta,{purpose:'social',ratio:'vertical'});
    const cover=root.media.descriptor(resolved.entry,meta.visual?.theme,'vertical');
    const route=root.media.descriptor(root.media.resolveJourneyVisual(meta,{purpose:'socialRoute',ratio:'vertical'}).entry,meta.visual?.theme,'vertical');
    const scenes=[
      {label:d.t('discoverJourney'),title:d.local(meta.title),body:facts(meta,d.t),art:visual},
      {label:d.t('theRoute'),title:d.local(meta.title),body:mode,art:visual},
      {label:d.t('keyStops'),title:d.local(meta.title),body:stops.slice(0,6).join(' → '),art:visual},
      {label:d.t('understandJourney'),title:facts(meta,d.t),body:d.local(meta.subtitle),art:''},
      {label:d.t('exploreFullJourney'),title:d.local(meta.title),body:d.t('socialStoryLead'),art:visual}
    ];
    let index=0;
    const render=()=>{
      const scene=scenes[index],e=d.esc,media=index===1||index===2?route:cover;
      modal.innerHTML='<div class="platform-modal-card social-story-card"><button type="button" class="platform-x" aria-label="'+e(d.t('close'))+'">×</button><h2 id="platformSocialStoryTitle" class="social-story-heading">'+e(d.t('socialStory'))+'</h2><div data-social-scene="'+index+'" data-visual-role="'+(index===1?'routeOverview':'social')+'" class="social-story-stage '+e(media.className)+'"'+(media.style?' style="'+e(media.style)+'"':'')+'><span class="social-story-brand">ONE WORLD ROUTE</span><div class="social-story-route" style="--journey-color:'+identity.color+'">'+(media.type==='image'?'':scene.art)+'</div><div class="social-story-copy" aria-live="polite"><span>'+e(scene.label)+'</span><h3>'+e(scene.title)+'</h3><p>'+e(scene.body)+'</p>'+(index===scenes.length-1?'<button class="primary" type="button" data-social-open>'+e(d.t('openJourney'))+' →</button>':'')+'</div><small>'+e(d.t(media.sourceType==='route-render'?'routeVisualNote':'illustratedRoute'))+'</small></div><div class="social-story-controls"><button type="button" data-social-prev aria-label="'+e(d.t('previous'))+'" '+(index===0?'disabled':'')+'>←</button><span>'+String(index+1)+' / '+scenes.length+'</span><button type="button" data-social-next aria-label="'+e(d.t('next'))+'" '+(index===scenes.length-1?'disabled':'')+'>→</button><button type="button" data-social-copy>'+e(d.t('copyCaption'))+'</button><button type="button" data-social-download>'+e(d.t('downloadStory'))+'</button></div></div>';
      modal.querySelector('.platform-x').onclick=()=>modal.classList.add('hidden');
      modal.querySelector('[data-social-prev]').onclick=()=>move(-1);
      modal.querySelector('[data-social-next]').onclick=()=>move(1);
      modal.querySelector('[data-social-open]')?.addEventListener('click',()=>d.onOpen(meta.id));
      modal.querySelector('[data-social-download]').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await exportScene({meta,scene,media,index,d})}catch{d.toast(d.t('storyExportFailed'))}finally{button.disabled=false}};
      modal.querySelector('[data-social-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(caption(meta,d));d.toast(d.t('captionCopied'))}catch{d.toast(d.t('shareCopyFallback'))}};
    };
    const move=delta=>{index=Math.max(0,Math.min(scenes.length-1,index+delta));render();modal.querySelector(delta>0?'[data-social-prev]':'[data-social-next]')?.focus()};
    render();modal.classList.remove('hidden');
    modal.onkeydown=event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1)}};
  }
  root.socialStory={configure:d=>{deps=d},open,facts,caption,exportScene};
})();
