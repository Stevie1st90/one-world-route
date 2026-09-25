(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const KEY='one-world-route:trip-tools:v1';

  const number=(value,min=0,max=100000)=>{
    const parsed=Number(value);
    return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):0;
  };
  function defaults(){return {savedTrips:[],budgets:{},startDates:{},seasons:{}}}
  function load(storage){
    try{
      const raw=JSON.parse(storage.getItem(KEY)||'{}');
      return {
        savedTrips:Array.isArray(raw.savedTrips)?[...new Set(raw.savedTrips.filter(v=>typeof v==='string'))]:[],
        budgets:raw.budgets&&typeof raw.budgets==='object'?raw.budgets:{},
        startDates:raw.startDates&&typeof raw.startDates==='object'?raw.startDates:{},
        seasons:raw.seasons&&typeof raw.seasons==='object'?raw.seasons:{}
      };
    }catch{return defaults()}
  }
  function persist(storage,state){storage.setItem(KEY,JSON.stringify(state));return state}
  function notify(tripId){if(typeof window?.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('one-world-route:trip-tools-changed',{detail:{tripId}}))}
  function isSaved(storage,tripId){return load(storage).savedTrips.includes(tripId)}
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
  function hasBudgetAssumptions(input){
    const a=normalizeBudget(input);
    return [a.lodgingPerNight,a.foodPerPersonDay,a.localPerPersonDay,a.extras,a.contingencyPercent].some(value=>Number(value)>0)||a.transportMultiplier!==null;
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
  function jsonPack({trip,meta,local,facetLabel,snapshot,assumptions,profile,startDate,season}){
    return JSON.stringify({
      schemaVersion:1,exportedAt:new Date().toISOString(),
      trip:{id:meta?.id||trip?.id,title:local(trip?.title),summary:local(trip?.summary),planning:trip?.planning||null,startDate:validDate(startDate)||null,seasonPreference:String(season||'')||null},
      itinerary:itineraryRows(trip,local,facetLabel),
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
  function render({trip,meta,profile,storage,t,esc,local,facetLabel,planningSnapshot,locale}){
    const id=meta?.id||trip?.id,saved=isSaved(storage,id),a=getBudget(storage,id),hasPlanning=(meta?.capabilities||[]).includes('trip-planning');
    const startDate=getStartDate(storage,id),season=getSeason(storage,id),e=estimate({snapshot:planningSnapshot,profile,assumptions:a}),currency=planningSnapshot?.currency||trip?.planning?.currency||'EUR';
    const breakdown='<div class="platform-budget-breakdown">'+
      '<span>'+esc(t('transportMinimum'))+'<b>'+esc(money(e.transport,currency,locale))+'</b></span>'+
      '<span>'+esc(t('lodging'))+'<b>'+esc(money(e.lodging,currency,locale))+'</b></span>'+
      '<span>'+esc(t('food'))+'<b>'+esc(money(e.food,currency,locale))+'</b></span>'+
      '<span>'+esc(t('localTravel'))+'<b>'+esc(money(e.local,currency,locale))+'</b></span>'+
      '</div>';
    return '<section class="platform-trip-utility">'+
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
  function bind({host,trip,meta,profile,storage,t,local,facetLabel,planningSnapshot,locale,toast}){
    const id=meta?.id||trip?.id;
    const save=host.querySelector('[data-trip-save]');
    if(save)save.onclick=()=>{const active=toggleSaved(storage,id);save.classList.toggle('active',active);save.textContent=active?t('removeSaved'):t('saveTrip');toast?.(active?t('savedLocally'):t('removedSaved'))};
    host.querySelector('[data-trip-export-json]')?.addEventListener('click',()=>{const assumptions=getBudget(storage,id);download(id+'-trip-pack.json',jsonPack({trip,meta,local,facetLabel,snapshot:planningSnapshot,assumptions,profile,startDate:getStartDate(storage,id),season:getSeason(storage,id)}),'application/json')});
    host.querySelector('[data-trip-export-csv]')?.addEventListener('click',()=>download(id+'-itinerary.csv',csv(trip,local,facetLabel),'text/csv'));
    const dateInput=host.querySelector('[data-trip-start-date]'),calendarButton=host.querySelector('[data-trip-export-calendar]'),seasonSelect=host.querySelector('[data-trip-season]');
    if(dateInput)dateInput.onchange=()=>{const date=setStartDate(storage,id,dateInput.value);if(calendarButton)calendarButton.disabled=!date};
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
      toast?.(t('estimateUpdated'));
    };
  }
  root.tripTools={load,isSaved,toggleSaved,normalizeBudget,getBudget,setBudget,getStartDate,setStartDate,getSeason,setSeason,hasBudgetAssumptions,estimate,itineraryRows,csv,calendar,jsonPack,workspaceJson,download,render,bind};
})();
