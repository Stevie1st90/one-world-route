(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const KEY='one-world-route:trip-tools:v1';

  const number=(value,min=0,max=100000)=>{
    const parsed=Number(value);
    return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):0;
  };
  function defaults(){return {savedTrips:[],recentTrips:[],budgets:{},startDates:{},seasons:{},routeStarts:{},variants:{},planningChecks:{}}}
  function load(storage){
    try{
      const raw=JSON.parse(storage.getItem(KEY)||'{}');
      return {
        savedTrips:Array.isArray(raw.savedTrips)?[...new Set(raw.savedTrips.filter(v=>typeof v==='string'))]:[],
        recentTrips:Array.isArray(raw.recentTrips)?[...new Set(raw.recentTrips.filter(v=>typeof v==='string'))].slice(0,12):[],
        budgets:raw.budgets&&typeof raw.budgets==='object'?raw.budgets:{},
        startDates:raw.startDates&&typeof raw.startDates==='object'?raw.startDates:{},
        seasons:raw.seasons&&typeof raw.seasons==='object'?raw.seasons:{},
        routeStarts:raw.routeStarts&&typeof raw.routeStarts==='object'?raw.routeStarts:{},
        variants:raw.variants&&typeof raw.variants==='object'?raw.variants:{},
        planningChecks:raw.planningChecks&&typeof raw.planningChecks==='object'?raw.planningChecks:{}
      };
    }catch{return defaults()}
  }
  function persist(storage,state){storage.setItem(KEY,JSON.stringify(state));return state}
  function notify(tripId){if(typeof window?.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('one-world-route:trip-tools-changed',{detail:{tripId}}))}
  function isSaved(storage,tripId){return load(storage).savedTrips.includes(tripId)}
  function getRecent(storage){return load(storage).recentTrips}
  function markViewed(storage,tripId){
    const id=String(tripId||'').trim();
    if(!id)return getRecent(storage);
    const state=load(storage);
    state.recentTrips=[id,...state.recentTrips.filter(value=>value!==id)].slice(0,12);
    persist(storage,state);
    return [...state.recentTrips];
  }
  function toggleSaved(storage,tripId){
    const state=load(storage),saved=new Set(state.savedTrips);
    if(saved.has(tripId))saved.delete(tripId);else saved.add(tripId);
    state.savedTrips=[...saved];persist(storage,state);notify(tripId);return saved.has(tripId);
  }
  function normalizeBudget(input={}){
    return {
      lodgingPerNight:number(input.lodgingPerNight),
      foodPerPersonDay:number(input.foodPerPersonDay),
      localPerPersonDay:number(input.localPerPersonDay),
      extras:number(input.extras),
      contingencyPercent:number(input.contingencyPercent,0,100),
      transportMultiplier:input.transportMultiplier===null||input.transportMultiplier===undefined||input.transportMultiplier===''?null:number(input.transportMultiplier,0,20)
    };
  }
  function getBudget(storage,tripId){return normalizeBudget(load(storage).budgets[tripId])}
  function setBudget(storage,tripId,input){
    const state=load(storage);state.budgets[tripId]=normalizeBudget(input);persist(storage,state);return state.budgets[tripId];
  }
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):''}
  function getStartDate(storage,tripId){return validDate(load(storage).startDates[tripId])}
  function setStartDate(storage,tripId,value){
    const state=load(storage),date=validDate(value);
    if(date)state.startDates[tripId]=date;else delete state.startDates[tripId];
    persist(storage,state);return date;
  }
  function getSeason(storage,tripId){return String(load(storage).seasons[tripId]||'')}
  function setSeason(storage,tripId,value){
    const state=load(storage),season=String(value||'').trim();
    if(season)state.seasons[tripId]=season;else delete state.seasons[tripId];
    persist(storage,state);return season;
  }
  function getRouteStart(storage,tripId){return String(load(storage).routeStarts[tripId]||'')}
  function setRouteStart(storage,tripId,value){
    const state=load(storage),start=String(value||'').trim();
    if(start)state.routeStarts[tripId]=start;else delete state.routeStarts[tripId];
    persist(storage,state);notify(tripId);return start;
  }
  function getVariant(storage,tripId){return String(load(storage).variants[tripId]||'base')}
  function setVariant(storage,tripId,value){
    const state=load(storage),variant=String(value||'base').trim()||'base';
    if(variant==='base')delete state.variants[tripId];else state.variants[tripId]=variant;
    persist(storage,state);notify(tripId);return variant;
  }
  function normalizePlanningChecks(input={}){
    const raw=String(input?.accessCheckedAt||'').trim();
    const parsed=raw?new Date(raw):null;
    return {accessCheckedAt:parsed&&Number.isFinite(parsed.getTime())?parsed.toISOString():''};
  }
  function getPlanningChecks(storage,tripId){return normalizePlanningChecks(load(storage).planningChecks[tripId])}
  function setAccessChecked(storage,tripId,checked,at=null){
    const state=load(storage),current=normalizePlanningChecks(state.planningChecks[tripId]);
    if(checked){
      const stamp=at?new Date(at):new Date();
      if(!Number.isFinite(stamp.getTime()))return current;
      state.planningChecks[tripId]={...current,accessCheckedAt:stamp.toISOString()};
    }else{
      delete state.planningChecks[tripId];
    }
    persist(storage,state);notify(tripId);return getPlanningChecks(storage,tripId);
  }
  function hasBudgetAssumptions(input){
    const a=normalizeBudget(input);
    return [a.lodgingPerNight,a.foodPerPersonDay,a.localPerPersonDay,a.extras,a.contingencyPercent].some(value=>Number(value)>0)||a.transportMultiplier!==null;
  }
  function planningStatus({storage,tripId,profile={},hasPlanning=false,routeStartRequired=false,includeSaved=false}={}){
    const origin=String(profile?.origin||profile?.originCountry||'').trim();
    const items=[];
    if(includeSaved)items.push({id:'saved',complete:isSaved(storage,tripId)});
    items.push({id:'origin',complete:Boolean(origin)});
    if(routeStartRequired)items.push({id:'routeStart',complete:Boolean(getRouteStart(storage,tripId))});
    items.push({id:'startDate',complete:Boolean(getStartDate(storage,tripId))});
    if(hasPlanning)items.push({id:'budget',complete:hasBudgetAssumptions(getBudget(storage,tripId))});
    const checks=getPlanningChecks(storage,tripId);
    items.push({id:'access',complete:Boolean(checks.accessCheckedAt),checkedAt:checks.accessCheckedAt||null});
    const completed=items.filter(item=>item.complete).length;
    return {items,completed,total:items.length,complete:completed===items.length,next:items.find(item=>!item.complete)?.id||null};
  }
  function estimate({snapshot,profile,assumptions}){
    const a=normalizeBudget(assumptions);
    const travellers=Math.max(1,number(profile?.party?.adults,0,20)+number(profile?.party?.children,0,20));
    const transportMultiplier=a.transportMultiplier===null?travellers:a.transportMultiplier;
    const transportKnown=snapshot?.knownPublishedMinimum!==null&&snapshot?.knownPublishedMinimum!==undefined&&Number.isFinite(Number(snapshot.knownPublishedMinimum));
    const transport=transportKnown?number(snapshot.knownPublishedMinimum)*transportMultiplier:0;
    const lodging=a.lodgingPerNight*number(snapshot?.nights);
    const food=a.foodPerPersonDay*number(snapshot?.days)*travellers;
    const local=a.localPerPersonDay*number(snapshot?.days)*travellers;
    const subtotal=transport+lodging+food+local+a.extras;
    const contingency=subtotal*(a.contingencyPercent/100);
    return {travellers,transportMultiplier,transportKnown,transport,lodging,food,local,extras:a.extras,subtotal,contingency,total:subtotal+contingency};
  }
  function csvCell(value){return '"'+String(value??'').replaceAll('"','""')+'"'}
  function itineraryRows(trip,local,facetLabel){
    const places=new Map((trip?.places||[]).map(place=>[place.id,place]));
    const segments=trip?.segments||[];
    return (trip?.stops||[]).map((stop,index)=>({
      id:stop.id||'stop-'+(index+1),
      dayStart:Number(stop.dayStart||index+1),
      dayEnd:Number(stop.dayEnd||stop.dayStart||index+1),
      place:local(places.get(stop.placeId)?.name),
      nights:Number(stop.nights||0),
      incomingMode:index?facetLabel(segments[index-1]?.transport?.mode||''):''
    }));
  }
  function csv(trip,local,facetLabel){
    const header=['dayStart','dayEnd','place','nights','incomingMode'];
    const rows=itineraryRows(trip,local,facetLabel).map(row=>header.map(key=>csvCell(row[key])).join(','));
    return [header.join(','),...rows].join('\n')+'\n';
  }
  function addDays(dateString,days){
    const [year,month,day]=dateString.split('-').map(Number);
    const value=new Date(Date.UTC(year,month-1,day));
    value.setUTCDate(value.getUTCDate()+Number(days||0));
    return value.toISOString().slice(0,10);
  }
  function icsDate(value){return String(value||'').replaceAll('-','')}
  function icsEscape(value){return String(value??'').replaceAll('\\','\\\\').replaceAll(';','\\;').replaceAll(',','\\,').replaceAll('\n','\\n')}
  function calendar(trip,meta,local,facetLabel,startDate){
    const start=validDate(startDate);
    if(!start)return '';
    const tripId=meta?.id||trip?.id||'trip',tripTitle=local(trip?.title)||tripId;
    const events=itineraryRows(trip,local,facetLabel).map(row=>{
      const begin=addDays(start,row.dayStart-1),end=addDays(start,row.dayEnd);
      return [
        'BEGIN:VEVENT',
        'UID:'+icsEscape(tripId+'-'+row.id+'@one-world-route'),
        'DTSTART;VALUE=DATE:'+icsDate(begin),
        'DTEND;VALUE=DATE:'+icsDate(end),
        'SUMMARY:'+icsEscape(tripTitle+' · '+row.place),
        'DESCRIPTION:'+icsEscape('ONE WORLD ROUTE · Day '+row.dayStart+(row.dayEnd!==row.dayStart?'–'+row.dayEnd:'')+(row.incomingMode?' · '+row.incomingMode:'')),
        'END:VEVENT'
      ].join('\r\n');
    });
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ONE WORLD ROUTE//Trip itinerary//EN','CALSCALE:GREGORIAN',...events,'END:VCALENDAR',''].join('\r\n');
  }
  function jsonPack({trip,meta,local,facetLabel,snapshot,assumptions,profile,startDate,season,journeyPlan=null,planningWorkspace=null}){
    return JSON.stringify({
      schemaVersion:1,exportedAt:new Date().toISOString(),
      trip:{id:meta?.id||trip?.id,title:local(trip?.title),summary:local(trip?.summary),variantId:trip?._variant?.id||'base',planning:trip?.planning||null,startDate:validDate(startDate)||null,seasonPreference:String(season||'')||null},
      itinerary:itineraryRows(trip,local,facetLabel),
      journeyPlan,
      planningWorkspace,
      budget:{currency:snapshot?.currency||trip?.planning?.currency||'EUR',assumptions:normalizeBudget(assumptions),estimate:estimate({snapshot,profile,assumptions}),scope:'Personal planning estimate. Published transport minimums plus user-entered assumptions; not a quote.'},
      sources:trip?.sources||[]
    },null,2)+'\n';
  }
  function workspaceJson(storage){
    return JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),workspace:load(storage)},null,2)+'\n';
  }
  function download(name,text,type='text/plain'){
    const blob=new Blob([text],{type:type+';charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function money(value,currency,locale){
    try{return new Intl.NumberFormat(locale||'en',{style:'currency',currency:currency||'EUR',maximumFractionDigits:0}).format(Number(value)||0)}
    catch{return String(Math.round(Number(value)||0))+' '+String(currency||'EUR')}
  }
  function planningWorkspaceMarkup({trip,meta,profile,storage,t,esc,journeyAdapter}){
    const id=meta?.id||trip?.id,hasPlanning=(meta?.capabilities||[]).includes('trip-planning');
    const eligible=journeyAdapter?.eligibleStartStops?.(trip)||[trip?.stops?.[0]].filter(Boolean);
    const status=planningStatus({storage,tripId:id,profile,hasPlanning,routeStartRequired:eligible.length>1,includeSaved:true});
    const label=step=>({
      saved:t('saved'),
      origin:t('planningOrigin'),
      routeStart:t('routeStart'),
      startDate:t('startDate'),
      budget:t('budgetEstimate'),
      access:t('planningAccessCheck')
    }[step]||step);
    const action=status.complete?t('exportJson'):({
      saved:t('saveTrip'),
      origin:t('change'),
      routeStart:t('routeStart'),
      startDate:t('startDate'),
      budget:t('budgetEstimate'),
      access:t('recordCurrentCheck')
    }[status.next]||t('continuePlanning'));
    return '<section class="platform-detail-planning" data-trip-planning-status>'+
      '<div class="platform-detail-planning-head"><div><span>'+esc(t('planningStatus'))+'</span><h3>'+esc(status.complete?t('planningCoreRecorded'):t('nextPlanningStep')+': '+label(status.next))+'</h3><p>'+esc(t('planningWorkspaceLead'))+'</p></div><strong>'+esc(String(status.completed))+' / '+esc(String(status.total))+'</strong></div>'+
      '<div class="platform-detail-planning-steps">'+status.items.map(item=>'<span class="'+(item.complete?'ok':'pending')+'" data-trip-planning-step="'+esc(item.id)+'"><i aria-hidden="true">'+(item.complete?'✓':'·')+'</i>'+esc(label(item.id))+'</span>').join('')+'</div>'+
      '<button type="button" class="platform-detail-planning-next" data-trip-plan-next="'+esc(status.next||'export')+'">'+esc(action)+' →</button>'+
    '</section>';
  }

  function render({trip,meta,profile,storage,t,esc,local,facetLabel,planningSnapshot,locale,journeyAdapter}){
    const id=meta?.id||trip?.id,saved=isSaved(storage,id),a=getBudget(storage,id),hasPlanning=(meta?.capabilities||[]).includes('trip-planning');
    const startDate=getStartDate(storage,id),season=getSeason(storage,id),e=estimate({snapshot:planningSnapshot,profile,assumptions:a}),currency=planningSnapshot?.currency||trip?.planning?.currency||'EUR';
    const eligible=journeyAdapter?.eligibleStartStops?.(trip)||[trip?.stops?.[0]].filter(Boolean);
    const storedStart=getRouteStart(storage,id),selectedStart=eligible.find(stop=>stop.id===storedStart)?.id||eligible[0]?.id||'';
    const places=new Map((trip?.places||[]).map(place=>[place.id,place]));
    const routeStartOptions=eligible.map(stop=>'<option value="'+esc(stop.id)+'" '+(stop.id===selectedStart?'selected':'')+'>'+esc(local(places.get(stop.placeId)?.name))+'</option>').join('');
    const routeStartSelect=eligible.length>1?'<label><span>'+esc(t('routeStart'))+'</span><select data-trip-route-start>'+routeStartOptions+'</select><small>'+esc(t('routeStartFlexibleLead'))+'</small></label>':'<div class="platform-route-start-fixed"><span>'+esc(t('routeStart'))+'</span><b>'+esc(local(places.get(eligible[0]?.placeId)?.name)||'—')+'</b><small>'+esc(t('routeStartFixedLead'))+'</small></div>';
    const selectedStop=eligible.find(stop=>stop.id===selectedStart)||eligible[0]||null;
    const selectedPlace=places.get(selectedStop?.placeId);
    const entrySuggestion=trip?._personalization?.entrySuggestion||null;
    const suggestedStop=entrySuggestion?.available?(trip?.stops||[]).find(stop=>stop.id===entrySuggestion.stopId):null;
    const suggestedPlace=places.get(suggestedStop?.placeId);
    const suggestedName=local(suggestedPlace?.name)||'';
    const suggestionSelected=Boolean(suggestedStop&&selectedStop?.id===suggestedStop.id);
    const origin=String(profile?.origin||profile?.originCountry||'').trim();
    const journeyPlan=journeyAdapter?.originPlan?.(trip,profile)||null;
    const variantService=window.ONE_WORLD_PLATFORM_MODULES?.journeyVariants;
    const variants=variantService?.list?.(trip)||[{id:'base',title:trip?.title,base:true}];
    const activeVariant=trip?._variant?.id||getVariant(storage,id)||'base';
    const variantMarkup=variants.length>1?'<label class="platform-journey-variant"><span>'+esc(t('journeyVariant'))+'</span><select data-trip-variant>'+variants.map(variant=>'<option value="'+esc(variant.id)+'" '+(variant.id===activeVariant?'selected':'')+'>'+esc(variant.base?t('fullJourney'):local(variant.title))+'</option>').join('')+'</select><small>'+esc(t('variantLead'))+'</small></label>':'';
    const coreStartPlace=places.get(journeyPlan?.core?.startPlaceId)||selectedPlace;
    const coreEndPlace=places.get(journeyPlan?.core?.endPlaceId)||places.get(trip?.stops?.at(-1)?.placeId);
    const coreStartName=local(coreStartPlace?.name)||'—',coreEndName=local(coreEndPlace?.name)||'—';
    const originMarkup='<div class="platform-origin-summary"><span>'+esc(t('originPoint'))+'</span><b>'+esc(origin||t('notSet'))+'</b><button type="button" data-trip-origin-edit>'+esc(t('change'))+'</button></div>';
    const suggestionDetail=entrySuggestion?.available
      ?((Number.isFinite(Number(entrySuggestion.distanceKm))?'≈ '+Math.round(Number(entrySuggestion.distanceKm))+' km · ':'')+t('entryApproximation'))
      :'';
    const suggestionMarkup=entrySuggestion?.available&&suggestedName?'<div class="platform-origin-summary platform-entry-suggestion" data-entry-suggestion><span>'+esc(t('entrySuggestion'))+'</span><b>'+esc((origin||entrySuggestion.originCountry||t('originPoint'))+' → '+suggestedName)+'</b><small>'+esc(suggestionDetail)+'</small><button type="button" '+(suggestionSelected?'disabled':'data-trip-entry-suggest')+'>'+esc(suggestionSelected?t('entrySuggestionApplied'):t('useSuggestedEntry'))+'</button></div>':'';
    const accessMarkup='<div class="platform-route-access platform-route-access-grid">'+
      '<div class="platform-route-access-step"><span>1 · '+esc(t('routeAccess'))+'</span><strong>'+esc(origin||t('originPoint'))+' → '+esc(coreStartName)+'</strong><small>'+esc(origin?t('currentCheck'):t('personalizeJourneyLead'))+'</small></div>'+
      '<div class="platform-route-access-step"><span>2 · '+esc(t('overview'))+'</span><strong>'+esc(coreStartName)+' → '+esc(coreEndName)+'</strong><small>'+esc(t('routeAccessLead'))+'</small></div>'+
      '<div class="platform-route-access-step"><span>3 · '+esc(t('routeAccess'))+'</span><strong>'+esc(coreEndName)+' → '+esc(origin||t('originPoint'))+'</strong><small>'+esc(origin?t('currentCheck'):t('personalizeJourneyLead'))+'</small></div>'+
    '</div>';
    const personalization='<section class="platform-journey-personalize"><div class="platform-personalize-head"><span>'+esc(t('personalizeJourney'))+'</span><h3>'+esc(t('personalizeJourneyTitle'))+'</h3></div><p>'+esc(t('personalizeJourneyLead'))+'</p>'+variantMarkup+originMarkup+suggestionMarkup+accessMarkup+'<div class="platform-route-start-control">'+routeStartSelect+'</div></section>';
    const breakdown='<div class="platform-budget-breakdown">'+
      '<span>'+esc(t('transportMinimum'))+'<b>'+esc(money(e.transport,currency,locale))+'</b></span>'+
      '<span>'+esc(t('lodging'))+'<b>'+esc(money(e.lodging,currency,locale))+'</b></span>'+
      '<span>'+esc(t('food'))+'<b>'+esc(money(e.food,currency,locale))+'</b></span>'+
      '<span>'+esc(t('localTravel'))+'<b>'+esc(money(e.local,currency,locale))+'</b></span>'+
      '</div>';
    const planningWorkspace=planningWorkspaceMarkup({trip,meta,profile,storage,t,esc,journeyAdapter});
    return planningWorkspace+personalization+'<section class="platform-trip-utility">'+
      '<button class="platform-save-trip '+(saved?'active':'')+'" type="button" data-trip-save>'+esc(saved?t('removeSaved'):t('saveTrip'))+'</button>'+
      '<details class="platform-trip-tools"><summary>'+esc(t('tripTools'))+' <span>+</span></summary>'+
        '<div class="platform-tool-actions"><button type="button" data-trip-export-json>'+esc(t('exportJson'))+'</button><button type="button" data-trip-export-csv>'+esc(t('exportCsv'))+'</button></div>'+
        '<div class="platform-calendar-tools"><label><span>'+esc(t('startDate'))+'</span><input type="date" data-trip-start-date value="'+esc(startDate)+'"></label><button type="button" data-trip-export-calendar '+(startDate?'':'disabled')+'>'+esc(t('exportCalendar'))+'</button></div>'+
        '<label class="platform-season-pref"><span>'+esc(t('planningSeason'))+'</span><select data-trip-season><option value="">'+esc(t('notSet'))+'</option>'+['spring','summer','autumn','winter','multi-season'].map(value=>'<option value="'+esc(value)+'" '+(season===value?'selected':'')+'>'+esc(facetLabel(value))+'</option>').join('')+'</select><small>'+esc(t('planningSeasonLead'))+'</small></label>'+
        (hasPlanning?'<form class="platform-budget-estimator" data-trip-budget><div class="ops-mini-title">'+esc(t('budgetEstimate'))+'</div><p>'+esc(t('budgetLead'))+'</p><div class="platform-budget-grid">'+
          '<label><span>'+esc(t('lodgingNight'))+'</span><input name="lodging" type="number" min="0" step="1" value="'+esc(a.lodgingPerNight)+'"></label>'+
          '<label><span>'+esc(t('foodPersonDay'))+'</span><input name="food" type="number" min="0" step="1" value="'+esc(a.foodPerPersonDay)+'"></label>'+
          '<label><span>'+esc(t('localPersonDay'))+'</span><input name="local" type="number" min="0" step="1" value="'+esc(a.localPerPersonDay)+'"></label>'+
          '<label><span>'+esc(t('extras'))+'</span><input name="extras" type="number" min="0" step="1" value="'+esc(a.extras)+'"></label>'+
          '<label><span>'+esc(t('contingency'))+'</span><input name="contingency" type="number" min="0" max="100" step="1" value="'+esc(a.contingencyPercent)+'"></label>'+
          '<label><span>'+esc(t('transportMultiplier'))+'</span><input name="transportMultiplier" type="number" min="0" max="20" step="1" value="'+esc(a.transportMultiplier===null?e.travellers:a.transportMultiplier)+'"></label>'+
          '<button type="submit">'+esc(t('updateEstimate'))+'</button></div>'+
          '<p class="platform-budget-assumption">'+esc(t('transportAssumption'))+'</p>'+
          '<div class="platform-budget-result"><span>'+esc(t('estimatedTripTotal'))+'</span><b data-budget-total>'+esc(money(e.total,currency,locale))+'</b><small>'+esc(e.travellers)+' '+esc(t('travellers'))+' · '+esc(t('budgetEstimateScope'))+'</small>'+(e.transportKnown?'':'<em>'+esc(t('transportUnknownBudget'))+'</em>')+breakdown+'</div></form>':'')+
      '</details></section>';
  }
  function bind({host,trip,meta,profile,storage,t,esc=s=>String(s??''),local,facetLabel,planningSnapshot,locale,toast,onTraveller,onRouteVariantChange,journeyAdapter=window.ONE_WORLD_PLATFORM_MODULES?.journeyAdapter}){
    const id=meta?.id||trip?.id;
    const hasPlanning=(meta?.capabilities||[]).includes('trip-planning');
    const eligible=journeyAdapter?.eligibleStartStops?.(trip)||[trip?.stops?.[0]].filter(Boolean);
    const refreshPlanning=()=>{
      const node=host.querySelector('[data-trip-planning-status]');
      if(node)node.outerHTML=planningWorkspaceMarkup({trip,meta,profile,storage,t,esc,journeyAdapter});
    };
    host.addEventListener('click',event=>{
      const next=event.target.closest('[data-trip-plan-next]');
      if(!next)return;
      const status=planningStatus({storage,tripId:id,profile,hasPlanning,routeStartRequired:eligible.length>1,includeSaved:true});
      const step=status.next||'export';
      if(step==='saved'){
        if(!isSaved(storage,id))toggleSaved(storage,id);
        const saveButton=host.querySelector('[data-trip-save]');
        if(saveButton){saveButton.classList.add('active');saveButton.textContent=t('removeSaved')}
        toast?.(t('savedLocally'));refreshPlanning();return;
      }
      if(step==='origin'){onTraveller?.();return}
      if(step==='routeStart'){
        const selected=host.querySelector('[data-trip-route-start]')?.value||eligible[0]?.id||'';
        if(selected){setRouteStart(storage,id,selected);toast?.(t('routeStartUpdated'));onRouteVariantChange?.({})}
        return;
      }
      const details=host.querySelector('.platform-trip-tools');
      if(step==='startDate'){
        if(details)details.open=true;
        host.querySelector('[data-trip-start-date]')?.focus();
        return;
      }
      if(step==='budget'){
        if(details)details.open=true;
        host.querySelector('[data-trip-budget] input')?.focus();
        return;
      }
      if(step==='access'){
        setAccessChecked(storage,id,true);
        toast?.(t('manualCheckRecorded'));refreshPlanning();return;
      }
      host.querySelector('[data-trip-export-json]')?.click();
    });
    host.querySelector('[data-trip-origin-edit]')?.addEventListener('click',()=>onTraveller?.());
    host.querySelector('[data-trip-entry-suggest]')?.addEventListener('click',()=>{
      const suggestion=trip?._personalization?.entrySuggestion;
      if(!suggestion?.available||!suggestion.stopId)return;
      setRouteStart(storage,id,suggestion.stopId);
      toast?.(t('routeStartUpdated'));
      onRouteVariantChange?.();
    });
    host.querySelector('[data-trip-variant]')?.addEventListener('change',event=>{
      const variantId=setVariant(storage,id,event.currentTarget.value);
      setRouteStart(storage,id,'');
      toast?.(t('variantUpdated'));
      onRouteVariantChange?.({variantId});
    });
    host.querySelector('[data-trip-route-start]')?.addEventListener('change',event=>{
      setRouteStart(storage,id,event.currentTarget.value);
      toast?.(t('routeStartUpdated'));
      onRouteVariantChange?.({});
    });
    const save=host.querySelector('[data-trip-save]');
    if(save)save.onclick=()=>{const active=toggleSaved(storage,id);save.classList.toggle('active',active);save.textContent=active?t('removeSaved'):t('saveTrip');toast?.(active?t('savedLocally'):t('removedSaved'));refreshPlanning()};
    host.querySelector('[data-trip-export-json]')?.addEventListener('click',()=>{const assumptions=getBudget(storage,id),status=planningStatus({storage,tripId:id,profile,hasPlanning,routeStartRequired:eligible.length>1,includeSaved:true}),checks=getPlanningChecks(storage,id);download(id+'-trip-pack.json',jsonPack({trip,meta,local,facetLabel,snapshot:planningSnapshot,assumptions,profile,startDate:getStartDate(storage,id),season:getSeason(storage,id),journeyPlan:window.ONE_WORLD_PLATFORM_MODULES?.journeyAdapter?.originPlan?.(trip,profile)||null,planningWorkspace:{saved:isSaved(storage,id),routeStartId:getRouteStart(storage,id)||null,accessCheckedAt:checks.accessCheckedAt||null,status}}),'application/json')});
    host.querySelector('[data-trip-export-csv]')?.addEventListener('click',()=>download(id+'-itinerary.csv',csv(trip,local,facetLabel),'text/csv'));
    const dateInput=host.querySelector('[data-trip-start-date]'),calendarButton=host.querySelector('[data-trip-export-calendar]'),seasonSelect=host.querySelector('[data-trip-season]');
    if(dateInput)dateInput.onchange=()=>{const date=setStartDate(storage,id,dateInput.value);if(calendarButton)calendarButton.disabled=!date;refreshPlanning()};
    if(seasonSelect)seasonSelect.onchange=()=>{setSeason(storage,id,seasonSelect.value);toast?.(t('planningSeasonSaved'))};
    if(calendarButton)calendarButton.onclick=()=>{
      const date=getStartDate(storage,id);
      if(!date){toast?.(t('calendarNeedsStartDate'));return}
      download(id+'-itinerary.ics',calendar(trip,meta,local,facetLabel,date),'text/calendar');
    };
    const form=host.querySelector('[data-trip-budget]');
    if(form)form.onsubmit=event=>{
      event.preventDefault();const data=new FormData(form);
      const assumptions=setBudget(storage,id,{lodgingPerNight:data.get('lodging'),foodPerPersonDay:data.get('food'),localPerPersonDay:data.get('local'),extras:data.get('extras'),contingencyPercent:data.get('contingency'),transportMultiplier:data.get('transportMultiplier')});
      const result=estimate({snapshot:planningSnapshot,profile,assumptions});
      const total=form.querySelector('[data-budget-total]');if(total)total.textContent=money(result.total,planningSnapshot?.currency||trip?.planning?.currency||'EUR',locale);
      const values=[result.transport,result.lodging,result.food,result.local];
      form.querySelectorAll('.platform-budget-breakdown b').forEach((node,index)=>node.textContent=money(values[index],planningSnapshot?.currency||trip?.planning?.currency||'EUR',locale));
      toast?.(t('estimateUpdated'));refreshPlanning();
    };
  }
  root.tripTools={load,isSaved,getRecent,markViewed,toggleSaved,normalizeBudget,getBudget,setBudget,getStartDate,setStartDate,getSeason,setSeason,getRouteStart,setRouteStart,getVariant,setVariant,normalizePlanningChecks,getPlanningChecks,setAccessChecked,hasBudgetAssumptions,planningStatus,estimate,itineraryRows,csv,calendar,jsonPack,workspaceJson,download,render,bind};
})();
