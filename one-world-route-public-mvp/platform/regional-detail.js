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

    content.innerHTML=`<div class="overview-number platform-duration-number">${trip.planning?.days||'—'}<small>${d.esc(d.t('days'))}</small></div><p class="detail-copy">${d.esc(d.local(trip.summary))}</p><div class="data-grid"><div class="data-card"><span>${d.esc(d.t('stops'))}</span><b>${trip.stops.length}</b></div>${extension.cards}<div class="data-card"><span>${d.esc(d.t('routeEvidence'))}</span><b>${sourced}/${trip.segments.length}</b></div><div class="data-card"><span>${d.esc(d.t('verified'))}</span><b>${verified}/${trip.segments.length}</b></div><div class="data-card"><span>${d.esc(d.t('currency'))}</span><b>${d.esc(trip.planning?.currency||'—')}</b></div></div>${extension.notices}${entry?`<div class="platform-entry"><b>${d.esc(d.t('entryGuidance'))}</b><p>${d.esc(d.local(entry.message))}</p>${entrySource?`<a href="${d.esc(entrySource.url)}" target="_blank" rel="noopener noreferrer">${d.esc(d.t('officialCheck'))} →</a>`:''}</div>`:''}<button class="platform-context-inline" id="regionalTravellerBtn" type="button">${d.esc(d.t('traveller'))} →</button>`;
    $('#regionalTravellerBtn')?.addEventListener('click',d.openTraveller);
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
    const notices=extension.notices||`<p class="detail-copy">${d.esc(d.t('editorial'))}</p>`;
    content.innerHTML=`<div class="overview-number">${stop.sequence}<small> / ${trip.stops.length}</small></div><div class="data-grid"><div class="data-card"><span>${d.esc(d.t('day'))}</span><b>${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''}</b></div>${extension.cards}<div class="data-card"><span>${d.esc(d.t('type'))}</span><b>${d.esc(d.facetLabel(place.type))}</b></div><div class="data-card"><span>${d.esc(d.t('country'))}</span><b>${d.esc(d.countryDisplay(place.countryCode))}</b></div></div>${notices}${extension.sourceIds.length?`<div class="platform-evidence"><div class="ops-mini-title">${d.esc(d.t('sources'))}</div>${d.sourceLinks(extension.sourceIds)}</div>`:''}`;
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

    content.innerHTML=`<div class="data-grid"><div class="data-card"><span>${d.esc(d.t('transport'))}</span><b>${d.esc(d.facetLabel(String(segment.transport?.mode||'—')))}</b></div><div class="data-card"><span>${d.esc(d.t('verification'))}</span><b class="${segment.verification?.status==='verified'?'evidence-ok':(segment.verification?.status==='illustrative'?'evidence-info':'evidence-watch')}">${d.esc(d.verificationLabel(segment))}</b></div><div class="data-card"><span>${d.esc(d.t('duration'))}</span><b>${d.esc(d.durationLabel(segment.planning))}</b></div><div class="data-card"><span>${d.esc(d.t('cost'))}</span><b>${d.esc(d.costLabel(segment.planning))}</b></div></div>${extension.panels}${stages?`<div class="platform-stages">${stages}</div>`:''}${segment.verification?.notes?`<div class="op-callout">${d.esc(d.editorialNote(segment.verification.notes))}</div>`:''}${refs.length?`<div class="platform-evidence"><div class="ops-mini-title">${d.esc(d.t('sources'))}</div>${d.sourceLinks(refs)}</div>`:''}`;
  }

  const api={configure,setMode,renderTripOverview,renderStopDetail,renderSegmentDetail};
  root.regionalDetail=api;
})();
