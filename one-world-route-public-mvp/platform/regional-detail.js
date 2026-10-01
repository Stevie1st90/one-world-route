(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let deps=null;

  function configure(next){
    deps=next;
    return api;
  }

  function context(){
    if(!deps)throw new Error('Regional detail renderer is not configured');
    return deps;
  }

  const $=(s,r=document)=>r.querySelector(s);

  function setMode(mode){
    for(const key of ['overview','stop','segment'])document.body.classList.toggle('platform-detail-'+key,key===mode);
    const panel=$('#rightPanel');
    if(panel)panel.scrollTop=0;
  }

  function journeyFitMarkup(meta){
    const d=context(),fit=meta?.discovery?.fit||{},modes=meta?.discovery?.modes||[];
    const groups=[
      [d.t('fitPace'),fit.pace?[fit.pace]:[]],
      [d.t('fitSeason'),fit.seasons||[]],
      [d.t('fitParty'),fit.party||[]],
      [d.t('transportModes'),modes]
    ].filter(([,values])=>values.length);
    if(!groups.length)return '';
    return '<section class="platform-route-fit-panel"><div class="platform-overview-section-head"><span>'+d.esc(d.t('routeFit'))+'</span></div><div class="platform-route-fit-grid">'+groups.map(([label,values])=>'<div><span>'+d.esc(label)+'</span><b>'+values.slice(0,4).map(value=>d.esc(d.facetLabel(value))).join(' · ')+'</b></div>').join('')+'</div></section>';
  }

  function journeyFlowMarkup(trip){
    const d=context();
    const stopMap=trip.stops.map((stop,index)=>{
      const place=d.placeMap(trip).get(stop.placeId);
      return '<button type="button" class="platform-journey-flow-stop" data-journey-stop-index="'+index+'"><span>'+String(stop.sequence).padStart(2,'0')+'</span><div><b>'+d.esc(d.local(place?.name))+'</b><small>'+d.esc(d.t('day'))+' '+stop.dayStart+(stop.dayEnd!==stop.dayStart?'–'+stop.dayEnd:'')+'</small></div></button>';
    }).join('');
    return '<section class="platform-journey-flow"><div class="platform-overview-section-head"><span>'+d.esc(d.t('storyRoute'))+'</span><b>'+trip.stops.length+' '+d.esc(d.t('stops'))+'</b></div><div class="platform-journey-flow-list">'+stopMap+'</div></section>';
  }

  function editorialStatusMarkup(meta,sourced,verified,total){
    const d=context(),status=d.statusLabel?d.statusLabel(meta):d.facetLabel(meta?.status||'draft');
    const evidence=(sourced||verified)?'<details class="platform-route-confidence"><summary><span>'+d.esc(d.t('routeEvidence'))+'</span><b>'+sourced+'/'+total+'</b></summary><div><span>'+d.esc(d.t('verified'))+'</span><strong>'+verified+'/'+total+'</strong></div></details>':'';
    return '<div class="platform-editorial-status"><span>'+d.esc(d.t('editorialStatus'))+'</span><b>'+d.esc(status)+'</b></div>'+evidence;
  }

  function stopVisualMarkup(trip,stop,place){
    const d=context(),placeMedia=root.media.resolveDestinationVisual({type:'place',id:place.experienceRef||place.id}),media=root.media?.descriptor?.(placeMedia,d.getTripMeta()?.visual?.theme||'ocean')||{className:'visual-ocean',style:'',type:'art-directed'};
    return '<div class="platform-stop-visual '+d.esc(media.className)+'" data-media-type="'+d.esc(media.type)+'"'+(media.style?' style="'+d.esc(media.style)+'"':'')+'><div><span>'+d.esc(d.t('stop'))+' '+stop.sequence+'</span><span>'+d.esc(d.t('day'))+' '+stop.dayStart+(stop.dayEnd!==stop.dayStart?'–'+stop.dayEnd:'')+'</span></div><strong>'+d.esc(d.local(place.name))+'</strong>'+root.media.credit(placeMedia,d.esc)+'</div>';
  }

  function renderTripOverview(){
    const d=context(),trip=d.getTrip();
    setMode('overview');
    const title=$('#detailTitle');
    if(title)title.textContent=d.local(trip.title);
    const eye=$('#detailEyebrow');
    if(eye)eye.textContent=d.t('overview');
    const tabs=$('#detailTabs');
    if(tabs)tabs.style.display='none';
    const content=$('#detailContent');
    if(!content)return;
    content.scrollTop=0;

    const sourced=trip.segments.filter(segment=>(segment.verification?.sourceIds||[]).length).length;
    const verified=trip.segments.filter(segment=>segment.verification?.status==='verified').length;
    const entry=trip.entryGuidance;
    const entrySource=entry?d.sourceMap().get(entry.officialResolverSourceId):null;
    const profile=d.loadProfile();
    const extension=d.extensions.composeTripOverview({trip,profile,t:d.t,esc:d.esc,local:d.local});
    const meta=d.getTripMeta();
    const planningSnapshot=d.tripPlanning.snapshot(trip,meta);
    const guide=d.journeyGuide.render({trip,meta,profile,locale:d.locale(),t:d.t,esc:d.esc,local:d.local,facetLabel:d.facetLabel});
    const planning=d.tripPlanning.render({trip,meta,profile,travellerFit:d.travellerFit,locale:d.locale(),t:d.t,esc:d.esc,local:d.local,facetLabel:d.facetLabel});
    const tools=d.tripTools.render({trip,meta,profile,storage:d.storage,t:d.t,esc:d.esc,local:d.local,facetLabel:d.facetLabel,planningSnapshot,locale:d.locale(),journeyAdapter:d.journeyAdapter});
    const sharedGuidance=d.sharedKnowledge?.render?.({trip,t:d.t,esc:d.esc,local:d.local})||'';
    const partnerLinks=d.partners?.render?.(meta,{t:d.t,esc:d.esc,local:d.local,facetLabel:d.facetLabel})||'';
    const highlights=(trip.highlights||[]).filter(Boolean).slice(0,5);
    const highlightMarkup=highlights.length?`<div class="platform-journey-highlights">${highlights.map(item=>'<span>'+d.esc(d.local(item))+'</span>').join('')}</div>`:'';

    const disclosure=(key,body)=>body?'<details class="platform-detail-disclosure"><summary>'+d.esc(d.t(key))+'</summary><div>'+body+'</div></details>':'';
    const countries=Number(meta?.metrics?.countries||new Set((trip.places||[]).map(place=>place.countryCode).filter(Boolean)).size)||0;
    content.innerHTML=`<div class="platform-journey-overview-intro"><div class="overview-number platform-duration-number">${trip.planning?.days||'—'}<small>${d.esc(d.t('days'))}</small></div><p class="detail-copy">${d.esc(d.local(trip.summary))}</p>${highlightMarkup}${(trip.editorial?.whyThisJourney||[]).length?`<section class="platform-why-journey"><h3>${d.esc(d.t('whyThisJourney'))}</h3><ul>${trip.editorial.whyThisJourney.slice(0,4).map(point=>`<li>${d.esc(d.local(point))}</li>`).join('')}</ul></section>`:''}<div class="platform-overview-metrics"><div><span>${d.esc(d.t('stops'))}</span><b>${trip.stops.length}</b></div><div><span>${d.esc(d.pluralLabel?d.pluralLabel(countries,'countryUnit','countriesUnit'):d.t('country'))}</span><b>${countries||'—'}</b></div><div><span>${d.esc(d.t('currency'))}</span><b>${d.esc(trip.planning?.currency||'—')}</b></div></div></div>${journeyFlowMarkup(trip)}${tools}${guide}${disclosure('routeFit',journeyFitMarkup(meta))}${disclosure('evidenceDetails',editorialStatusMarkup(meta,sourced,verified,trip.segments.length)+(extension.cards?`<div class="data-grid platform-extension-cards">${extension.cards}</div>`:'')+extension.notices)}${disclosure('planningDetails',planning)}${sharedGuidance}${disclosure('partnerOptions',partnerLinks)}${entry?`<details class="platform-detail-disclosure"><summary>${d.esc(d.t('entryGuidance'))}</summary><div class="platform-entry"><b>${d.esc(d.t('entryGuidance'))}</b><p>${d.esc(d.local(entry.message))}</p>${entrySource?`<a href="${d.esc(entrySource.url)}" target="_blank" rel="noopener noreferrer">${d.esc(d.t('officialCheck'))} →</a>`:''}</div></details>`:''}<button class="platform-context-inline" id="regionalTravellerBtn" type="button">${d.esc(d.t('traveller'))} →</button>`;
    $('#regionalTravellerBtn')?.addEventListener('click',d.openTraveller);
    content.querySelectorAll('[data-journey-stop-index]').forEach(button=>button.addEventListener('click',()=>d.selectStop(Number(button.dataset.journeyStopIndex),true)));
    const requestedStep=new URLSearchParams(location.search).get('planStep');
    if(requestedStep){
      requestAnimationFrame(()=>{
        const target=requestedStep==='routeStart'?content.querySelector('[data-trip-route-start]'):requestedStep==='access'?content.querySelector('.platform-entry a'):content.querySelector(requestedStep==='startDate'?'[data-trip-start-date]':requestedStep==='budget'?'[data-trip-budget] input':'[data-trip-plan-next]');
        if(target){for(let node=target.parentElement;node&&node!==content;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;target.scrollIntoView({block:'nearest'});target.focus()}
        const url=new URL(location.href);url.searchParams.delete('planStep');history.replaceState(null,'',url);
      });
    }
    d.tripTools.bind({host:content,trip,meta,profile,storage:d.storage,t:d.t,esc:d.esc,local:d.local,facetLabel:d.facetLabel,planningSnapshot,locale:d.locale(),toast:d.toast,onTraveller:d.openTraveller,onRouteVariantChange:d.onRouteVariantChange,journeyAdapter:d.journeyAdapter});
  }

  function renderStopDetail(stop,place){
    const d=context(),trip=d.getTrip();
    setMode('stop');
    const title=$('#detailTitle');
    if(title)title.textContent=d.local(place.name);
    const eye=$('#detailEyebrow');
    if(eye)eye.textContent=`${d.t('stop').toUpperCase()} ${stop.sequence} · ${d.facetLabel(place.type)}`;
    const content=$('#detailContent');
    if(!content)return;
    content.scrollTop=0;

    const extension=d.extensions.composeStopDetail({trip,stop,place,profile:d.loadProfile(),t:d.t,esc:d.esc,local:d.local});
    const experience=d.placeExperiences.render({trip,stop,place,t:d.t,esc:d.esc,local:d.local,facetLabel:d.facetLabel});
    const notices=extension.notices||`<p class="detail-copy">${d.esc(d.t('editorial'))}</p>`;
    const index=trip.stops.findIndex(item=>item.id===stop.id);
    content.innerHTML=`${stopVisualMarkup(trip,stop,place)}<div class="data-grid"><div class="data-card"><span>${d.esc(d.t('day'))}</span><b>${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''}</b></div>${extension.cards}<div class="data-card"><span>${d.esc(d.t('type'))}</span><b>${d.esc(d.facetLabel(place.type))}</b></div><div class="data-card"><span>${d.esc(d.t('country'))}</span><b>${d.esc(d.countryDisplay(place.countryCode))}</b></div></div>${experience}${notices}${extension.sourceIds.length?`<details class="platform-detail-disclosure"><summary>${d.esc(d.t('sources'))}</summary><div class="platform-evidence">${d.sourceLinks(extension.sourceIds)}</div></details>`:''}<div class="platform-stop-nav"><button type="button" data-stop-nav="-1" ${index<=0?'disabled':''}>← ${d.esc(d.t('previous'))}</button><button type="button" data-stop-nav="1" ${index>=trip.stops.length-1?'disabled':''}>${d.esc(d.t('next'))} →</button></div>`;
    content.querySelectorAll('[data-stop-nav]').forEach(button=>button.addEventListener('click',()=>d.selectStop(index+Number(button.dataset.stopNav),true)));
  }

  function renderSegmentDetail(segment){
    const d=context(),trip=d.getTrip();
    setMode('segment');
    const stopMap=d.stopMap(trip),placeMap=d.placeMap(trip);
    const from=placeMap.get(stopMap.get(segment.fromStopId)?.placeId);
    const to=placeMap.get(stopMap.get(segment.toStopId)?.placeId);

    const title=$('#detailTitle');
    if(title)title.textContent=`${d.local(from?.name)} → ${d.local(to?.name)}`;
    const eye=$('#detailEyebrow');
    if(eye)eye.textContent=`${d.t('segment').toUpperCase()} ${segment.sequence} / ${trip.segments.length}`;
    const content=$('#detailContent');
    if(!content)return;
    content.scrollTop=0;

    const stages=(segment.transport?.stages||[]).map((stage,index)=>`<article class="platform-stage"><span>${String(index+1).padStart(2,'0')}</span><div><b>${d.esc(stage.operator||String(stage.mode||'').replaceAll('-',' '))}</b><small>${d.esc(stage.from||'')} → ${d.esc(stage.to||'')}</small><em>${d.esc(d.durationLabel(stage))} · ${d.esc(d.costLabel(stage))}</em></div></article>`).join('');
    const baseRefs=[...(segment.verification?.sourceIds||[]),...(segment.transport?.stages||[]).flatMap(stage=>stage.sourceIds||[])];
    const extension=d.extensions.composeSegmentDetail({trip,segment,profile:d.loadProfile(),t:d.t,esc:d.esc,local:d.local});
    const refs=[...new Set([...baseRefs,...extension.sourceIds])];

    content.innerHTML=`<div class="data-grid"><div class="data-card"><span>${d.esc(d.t('transport'))}</span><b>${d.esc(d.facetLabel(String(segment.transport?.mode||'—')))}</b></div><div class="data-card"><span>${d.esc(d.t('verification'))}</span><b class="${segment.verification?.status==='verified'?'evidence-ok':(segment.verification?.status==='illustrative'?'evidence-info':'evidence-watch')}">${d.esc(d.verificationLabel(segment))}</b></div><div class="data-card"><span>${d.esc(d.t('duration'))}</span><b>${d.esc(d.durationLabel(segment.planning))}</b></div><div class="data-card"><span>${d.esc(d.t('cost'))}</span><b>${d.esc(d.costLabel(segment.planning))}</b></div></div>${extension.panels}${stages?`<div class="platform-stages">${stages}</div>`:''}${segment.verification?.notes?`<div class="op-callout">${d.esc(d.editorialNote(segment.verification.notes))}</div>`:''}${refs.length?`<details class="platform-detail-disclosure"><summary>${d.esc(d.t('sources'))}</summary><div class="platform-evidence">${d.sourceLinks(refs)}</div></details>`:''}`;
  }

  const api={configure,setMode,renderTripOverview,renderStopDetail,renderSegmentDetail};
  root.regionalDetail=api;
})();
