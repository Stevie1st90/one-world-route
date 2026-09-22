const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const modes=['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other'];
const verificationStatuses=['draft','current-check-required','verified','illustrative'];
const sourceTypes=['government','official-operator','international-organization','primary-source','secondary-source'];
const publishStatuses=['draft','sourced-beta','illustrative-template','planned'];
const paceOptions=['relaxed','balanced','active'];
const seasonOptions=['spring','summer','autumn','winter','multi-season'];
const partyOptions=['solo','couples','friends','families'];
const accessibilityOptions=['standard-check','operator-dependent','vehicle-dependent','complex-planning'];

const state={bootstrap:null,draft:null,dirty:false,validation:null,activeTab:'route'};
let toastTimer=null;

async function api(path,{method='GET',body}={}){
  const response=await fetch(path,{
    method,
    headers:body?{'Content-Type':'application/json'}:undefined,
    body:body?JSON.stringify(body):undefined
  });
  const payload=await response.json().catch(()=>({error:'Invalid server response'}));
  if(!response.ok){
    const error=new Error(payload.error||('Request failed: '+response.status));
    error.payload=payload;
    error.status=response.status;
    throw error;
  }
  return payload;
}

function toast(message){
  const node=$('#toast');
  node.textContent=message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>node.classList.remove('show'),2600);
}

function splitList(value){
  return [...new Set(String(value||'').split(',').map(v=>v.trim()).filter(Boolean))];
}

function localObject(value=''){
  return Object.fromEntries((state.bootstrap?.supportedLocales||['en']).map(locale=>[locale,value]));
}

function metrics(){
  const trip=state.draft?.trip||{};
  const segments=trip.segments||[];
  return {
    days:Number(trip.planning?.days)||0,
    countries:new Set((trip.places||[]).map(place=>place.countryCode).filter(Boolean)).size,
    stops:(trip.stops||[]).length,
    segments:segments.length,
    sourced:segments.filter(segment=>(segment.verification?.sourceIds||[]).length).length,
    verified:segments.filter(segment=>segment.verification?.status==='verified').length
  };
}

function markDirty(){
  if(!state.draft)return;
  state.dirty=true;
  $('#dirtyBadge').classList.remove('hidden');
  state.validation=null;
  renderValidation();
  updateActionState();
}

function cleanSequence(list){
  list.forEach((item,index)=>item.sequence=index+1);
}

function defaultMode(){
  const kind=state.draft?.trip?.kind;
  if(kind==='rail')return 'rail';
  if(kind==='cruise')return 'cruise';
  if(kind==='road-trip'||kind==='camper')return 'car';
  if(kind==='cycling')return 'bicycle';
  if(kind==='hiking')return 'walk';
  return 'road';
}

function reconcileSegments({notify=true}={}){
  const trip=state.draft.trip;
  cleanSequence(trip.stops);
  const existing=new Map((trip.segments||[]).map(segment=>[segment.fromStopId+'>'+segment.toStopId,segment]));
  trip.segments=trip.stops.slice(0,-1).map((from,index)=>{
    const to=trip.stops[index+1];
    const key=from.id+'>'+to.id;
    const current=existing.get(key);
    if(current)return {...current,sequence:index+1,fromStopId:from.id,toStopId:to.id};
    return {
      id:`${trip.slug}-leg-${String(index+1).padStart(2,'0')}`,
      sequence:index+1,
      fromStopId:from.id,
      toStopId:to.id,
      transport:{mode:defaultMode(),stages:[]},
      planning:{durationMinutes:null,distanceKm:null,cost:null},
      verification:{status:'draft',lastVerified:null,sourceIds:[],notes:''}
    };
  });
  markDirty();
  renderSegments();
  renderMetrics();
  if(notify)toast('Segments reconciled with stop adjacency.');
}

async function bootstrap(){
  state.bootstrap=await api('/api/bootstrap');
  renderDraftList();
  renderLocaleSelect();
}

async function refreshBootstrap(){
  await bootstrap();
  toast('Workspace refreshed.');
}

function renderDraftList(){
  const list=$('#draftList');
  const drafts=state.bootstrap?.drafts||[];
  list.innerHTML=drafts.length?drafts.map(item=>`
    <button class="draft-item ${state.draft?.trip?.slug===item.slug?'active':''}" data-slug="${esc(item.slug)}">
      <b>${esc(item.title)}</b>
      <span>${esc(item.kind)} · ${esc(item.status)}</span>
    </button>`).join(''):'<p class="muted">No local drafts yet.</p>';
  $$('.draft-item',list).forEach(button=>button.onclick=()=>openDraft(button.dataset.slug));
}

function renderLocaleSelect(){
  const select=$('#previewLocale');
  const current=select.value||state.bootstrap?.defaultLocale||'en';
  select.innerHTML=(state.bootstrap?.supportedLocales||['en']).map(locale=>`<option value="${esc(locale)}">${esc(locale.toUpperCase())}</option>`).join('');
  if([...select.options].some(option=>option.value===current))select.value=current;
}

async function openDraft(slug){
  if(state.dirty&&!confirm('Discard unsaved changes and open another draft?'))return;
  state.draft=await api('/api/drafts/'+encodeURIComponent(slug));
  state.dirty=false;
  state.validation=null;
  $('#emptyState').classList.add('hidden');
  $('#editor').classList.remove('hidden');
  $('#dirtyBadge').classList.add('hidden');
  renderAll();
  renderDraftList();
}

function renderAll(){
  if(!state.draft)return;
  renderHeader();
  renderMetrics();
  renderBasics();
  renderPlaces();
  renderStops();
  renderSegments();
  renderLocalized();
  renderDiscovery();
  renderSources();
  renderAdvanced();
  renderValidation();
  renderLocaleSelect();
  updateActionState();
}

function renderHeader(){
  const trip=state.draft.trip;
  const locale=trip.defaultLocale||'en';
  $('#editorTitle').textContent=trip.title?.[locale]||trip.title?.en||trip.slug;
  $('#editorSlug').textContent=trip.slug;
  $('#statusBadge').textContent=trip.status||'draft';
  $('#kindBadge').textContent=trip.kind||'custom';
}

function renderMetrics(){
  if(!state.draft)return;
  const m=metrics();
  $('#metricStrip').innerHTML=[
    ['days',m.days],['countries',m.countries],['stops',m.stops],['segments',m.segments],['sourced',m.sourced],['verified',m.verified]
  ].map(([label,value])=>`<div class="metric"><b>${value}</b><span>${label}</span></div>`).join('');
}

function optionList(values,current){
  return values.map(value=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(value)}</option>`).join('');
}

function renderBasics(){
  const trip=state.draft.trip;
  const form=$('#basicsForm');
  form.innerHTML=`
    <label>Slug<input data-basic="slug" value="${esc(trip.slug)}" disabled></label>
    <label>Kind<input data-basic="kind" value="${esc(trip.kind)}"></label>
    <label>Status<select data-basic="status">${optionList(publishStatuses,trip.status)}</select></label>
    <label>Days<input data-basic="days" type="number" min="1" value="${esc(trip.planning?.days??'')}"></label>
    <label>Currency<input data-basic="currency" value="${esc(trip.planning?.currency||'EUR')}" maxlength="3"></label>
    <label>Default locale<select data-basic="defaultLocale">${optionList(state.bootstrap.supportedLocales,trip.defaultLocale)}</select></label>
  `;
  $('[data-basic="kind"]',form).oninput=e=>{
    trip.kind=e.target.value.trim();
    state.draft.catalogEntry.kind=trip.kind;
    markDirty();renderHeader();
  };
  $('[data-basic="status"]',form).onchange=e=>{
    trip.status=e.target.value;state.draft.catalogEntry.status=e.target.value;markDirty();renderHeader();
  };
  $('[data-basic="days"]',form).oninput=e=>{trip.planning.days=e.target.value?Number(e.target.value):null;markDirty();renderMetrics()};
  $('[data-basic="currency"]',form).oninput=e=>{trip.planning.currency=e.target.value.trim().toUpperCase();markDirty()};
  $('[data-basic="defaultLocale"]',form).onchange=e=>{trip.defaultLocale=e.target.value;markDirty();renderHeader()};
}

function renderPlaces(){
  const root=$('#placesEditor');
  const locales=state.bootstrap.supportedLocales;
  const trip=state.draft.trip;
  root.innerHTML=(trip.places||[]).map((place,index)=>`
    <div class="entity-row" data-place-index="${index}">
      <div class="entity-head"><b>Place ${index+1}</b><button class="remove" data-remove-place="${index}">Remove</button></div>
      <div class="entity-grid">
        <label>ID<input data-field="id" value="${esc(place.id||'')}"></label>
        <label>Type<input data-field="type" value="${esc(place.type||'city')}"></label>
        <label>Country<input data-field="countryCode" maxlength="2" value="${esc(place.countryCode||'')}"></label>
        <label>Latitude<input data-field="lat" type="number" step="any" value="${esc(place.coordinates?.lat??'')}"></label>
        <label>Longitude<input data-field="lng" type="number" step="any" value="${esc(place.coordinates?.lng??'')}"></label>
        <div></div>
        ${locales.map(locale=>`<label class="span-2">Name · ${esc(locale.toUpperCase())}<input data-place-name="${esc(locale)}" value="${esc(place.name?.[locale]||'')}"></label>`).join('')}
      </div>
    </div>`).join('')||'<p class="muted">No places yet. Add at least two.</p>';

  $$('[data-place-index]',root).forEach(row=>{
    const index=Number(row.dataset.placeIndex),place=trip.places[index];
    $('[data-field="id"]',row).onchange=e=>{
      const previous=place.id;
      const next=e.target.value.trim();
      place.id=next;
      for(const stop of trip.stops||[])if(stop.placeId===previous)stop.placeId=next;
      markDirty();renderStops();
    };
    $('[data-field="type"]',row).oninput=e=>{place.type=e.target.value.trim();markDirty()};
    $('[data-field="countryCode"]',row).oninput=e=>{place.countryCode=e.target.value.trim().toUpperCase();markDirty();renderMetrics()};
    $('[data-field="lat"]',row).oninput=e=>{place.coordinates=place.coordinates||{};place.coordinates.lat=e.target.value===''?null:Number(e.target.value);markDirty()};
    $('[data-field="lng"]',row).oninput=e=>{place.coordinates=place.coordinates||{};place.coordinates.lng=e.target.value===''?null:Number(e.target.value);markDirty()};
    $$('[data-place-name]',row).forEach(input=>input.oninput=e=>{place.name=place.name||{};place.name[input.dataset.placeName]=e.target.value;markDirty()});
  });
  $$('[data-remove-place]',root).forEach(button=>button.onclick=()=>{
    const index=Number(button.dataset.removePlace);
    const removed=trip.places[index]?.id;
    trip.places.splice(index,1);
    if(removed)trip.stops=trip.stops.filter(stop=>stop.placeId!==removed);
    cleanSequence(trip.stops);reconcileSegments({notify:false});renderPlaces();renderStops();renderMetrics();
  });
}

function addPlace(){
  const n=state.draft.trip.places.length+1;
  state.draft.trip.places.push({
    id:'place-'+String(n).padStart(2,'0'),type:'city',countryCode:'',
    name:localObject(''),coordinates:{lat:null,lng:null}
  });
  markDirty();renderPlaces();renderMetrics();
}

function placeOptions(selected){
  return (state.draft.trip.places||[]).map(place=>`<option value="${esc(place.id)}" ${place.id===selected?'selected':''}>${esc(place.name?.[state.draft.trip.defaultLocale]||place.name?.en||place.id)} · ${esc(place.id)}</option>`).join('');
}

function renderStops(){
  const root=$('#stopsEditor'),trip=state.draft.trip;
  cleanSequence(trip.stops);
  root.innerHTML=(trip.stops||[]).map((stop,index)=>`
    <div class="entity-row" data-stop-index="${index}">
      <div class="entity-head"><b>Stop ${index+1}</b><button class="remove" data-remove-stop="${index}">Remove</button></div>
      <div class="entity-grid">
        <label class="span-2">Stop ID<input data-stop-field="id" value="${esc(stop.id||'')}"></label>
        <label class="span-2">Place<select data-stop-field="placeId"><option value="">Select place</option>${placeOptions(stop.placeId)}</select></label>
        <label>Day start<input data-stop-field="dayStart" type="number" min="1" value="${esc(stop.dayStart??'')}"></label>
        <label>Day end<input data-stop-field="dayEnd" type="number" min="1" value="${esc(stop.dayEnd??'')}"></label>
        <label>Nights<input data-stop-field="nights" type="number" min="0" value="${esc(stop.nights??'')}"></label>
      </div>
    </div>`).join('')||'<p class="muted">No stops yet.</p>';

  $$('[data-stop-index]',root).forEach(row=>{
    const index=Number(row.dataset.stopIndex),stop=trip.stops[index];
    $('[data-stop-field="id"]',row).onchange=e=>{
      const previous=stop.id;
      const next=e.target.value.trim();
      stop.id=next;
      for(const segment of trip.segments||[]){
        if(segment.fromStopId===previous)segment.fromStopId=next;
        if(segment.toStopId===previous)segment.toStopId=next;
      }
      markDirty();renderSegments();
    };
    $('[data-stop-field="placeId"]',row).onchange=e=>{stop.placeId=e.target.value;markDirty()};
    for(const field of ['dayStart','dayEnd','nights'])$('[data-stop-field="'+field+'"]',row).oninput=e=>{stop[field]=e.target.value===''?null:Number(e.target.value);markDirty()};
  });
  $$('[data-remove-stop]',root).forEach(button=>button.onclick=()=>{
    trip.stops.splice(Number(button.dataset.removeStop),1);cleanSequence(trip.stops);reconcileSegments({notify:false});renderStops();renderMetrics();
  });
}

function addStop(){
  const trip=state.draft.trip,n=trip.stops.length+1;
  trip.stops.push({
    id:`${trip.slug}-stop-${String(n).padStart(2,'0')}`,sequence:n,
    placeId:trip.places[Math.min(n-1,Math.max(0,trip.places.length-1))]?.id||'',
    dayStart:null,dayEnd:null,nights:null
  });
  markDirty();renderStops();reconcileSegments({notify:false});renderMetrics();
}

function routeFromPlaces(){
  const trip=state.draft.trip;
  if(trip.places.length<2){toast('Add at least two places first.');return}
  if(trip.stops.length&&!confirm('Replace current stops with one visit per place?'))return;
  trip.stops=trip.places.map((place,index)=>({
    id:`${trip.slug}-stop-${String(index+1).padStart(2,'0')}`,
    sequence:index+1,placeId:place.id,dayStart:null,dayEnd:null,nights:null
  }));
  reconcileSegments({notify:false});renderStops();renderSegments();renderMetrics();toast('Stops created from place order.');
}

function renderSegments(){
  const root=$('#segmentsEditor'),trip=state.draft.trip;
  cleanSequence(trip.segments);
  root.innerHTML=(trip.segments||[]).map((segment,index)=>`
    <div class="entity-row" data-segment-index="${index}">
      <div class="entity-head"><b>Leg ${index+1} · ${esc(segment.fromStopId||'?')} → ${esc(segment.toStopId||'?')}</b><span class="badge secondary">${esc(segment.transport?.mode||'')}</span></div>
      <div class="entity-grid">
        <label class="span-2">Segment ID<input data-segment-field="id" value="${esc(segment.id||'')}"></label>
        <label>Mode<select data-segment-field="mode">${optionList(modes,segment.transport?.mode)}</select></label>
        <label>Verification<select data-segment-field="status">${optionList(verificationStatuses,segment.verification?.status)}</select></label>
        <label>Duration min<input data-segment-field="duration" type="number" min="0" value="${esc(segment.planning?.durationMinutes??'')}"></label>
        <label>Last verified<input data-segment-field="lastVerified" type="date" value="${esc(segment.verification?.lastVerified||'')}"></label>
        <label class="span-3">Source IDs · comma separated<input data-segment-field="sources" value="${esc((segment.verification?.sourceIds||[]).join(', '))}"></label>
        <label class="span-3">Notes<input data-segment-field="notes" value="${esc(segment.verification?.notes||'')}"></label>
      </div>
    </div>`).join('')||'<p class="muted">Segments are generated from adjacent stops.</p>';

  $$('[data-segment-index]',root).forEach(row=>{
    const index=Number(row.dataset.segmentIndex),segment=trip.segments[index];
    $('[data-segment-field="id"]',row).oninput=e=>{segment.id=e.target.value.trim();markDirty()};
    $('[data-segment-field="mode"]',row).onchange=e=>{segment.transport=segment.transport||{};segment.transport.mode=e.target.value;markDirty()};
    $('[data-segment-field="status"]',row).onchange=e=>{segment.verification=segment.verification||{};segment.verification.status=e.target.value;markDirty();renderMetrics()};
    $('[data-segment-field="duration"]',row).oninput=e=>{segment.planning=segment.planning||{};segment.planning.durationMinutes=e.target.value===''?null:Number(e.target.value);markDirty()};
    $('[data-segment-field="lastVerified"]',row).oninput=e=>{segment.verification=segment.verification||{};segment.verification.lastVerified=e.target.value||null;markDirty()};
    $('[data-segment-field="sources"]',row).oninput=e=>{segment.verification=segment.verification||{};segment.verification.sourceIds=splitList(e.target.value);markDirty();renderMetrics()};
    $('[data-segment-field="notes"]',row).oninput=e=>{segment.verification=segment.verification||{};segment.verification.notes=e.target.value;markDirty()};
  });
}

function renderLocalized(){
  const root=$('#localizedEditor'),trip=state.draft.trip,item=state.draft.catalogEntry;
  root.innerHTML=state.bootstrap.supportedLocales.map(locale=>`
    <div class="locale-row" data-locale="${esc(locale)}">
      <h4>${esc(locale.toUpperCase())}</h4>
      <div class="locale-fields">
        <label>Title<input data-local="title" value="${esc(trip.title?.[locale]||'')}"></label>
        <label>Library subtitle<input data-local="subtitle" value="${esc(item.subtitle?.[locale]||'')}"></label>
        <label>Summary<textarea data-local="summary">${esc(trip.summary?.[locale]||'')}</textarea></label>
      </div>
    </div>`).join('');
  $$('.locale-row',root).forEach(row=>{
    const locale=row.dataset.locale;
    $('[data-local="title"]',row).oninput=e=>{
      trip.title=trip.title||{};item.title=item.title||{};
      trip.title[locale]=e.target.value;item.title[locale]=e.target.value;markDirty();if(locale===trip.defaultLocale)renderHeader();
    };
    $('[data-local="subtitle"]',row).oninput=e=>{item.subtitle=item.subtitle||{};item.subtitle[locale]=e.target.value;markDirty()};
    $('[data-local="summary"]',row).oninput=e=>{trip.summary=trip.summary||{};trip.summary[locale]=e.target.value;markDirty()};
  });
}

function multiSelectHtml(values,selected){
  return values.map(value=>`<option value="${esc(value)}" ${selected?.includes(value)?'selected':''}>${esc(value)}</option>`).join('');
}

function renderDiscovery(){
  const root=$('#discoveryEditor'),item=state.draft.catalogEntry;
  item.discovery=item.discovery||{};item.discovery.fit=item.discovery.fit||{};
  const d=item.discovery,fit=d.fit;
  root.innerHTML=`
    <label class="span-2">Regions · comma separated<input data-discovery="regions" value="${esc((d.regions||[]).join(', '))}"></label>
    <label>Themes · comma separated<input data-discovery="themes" value="${esc((d.themes||[]).join(', '))}"></label>
    <label class="span-2">Modes · comma separated<input data-discovery="modes" value="${esc((d.modes||[]).join(', '))}"></label>
    <label>Start region<input data-fit="startRegion" value="${esc(fit.startRegion||'')}"></label>
    <label>Pace<select data-fit="pace">${optionList(paceOptions,fit.pace)}</select></label>
    <label>Accessibility<select data-fit="accessibility">${optionList(accessibilityOptions,fit.accessibility)}</select></label>
    <label class="span-2">Seasons<select data-fit="seasons" multiple size="5">${multiSelectHtml(seasonOptions,fit.seasons)}</select></label>
    <label>Party<select data-fit="party" multiple size="4">${multiSelectHtml(partyOptions,fit.party)}</select></label>
    <label class="span-3">Capabilities · comma separated<input data-discovery="capabilities" value="${esc((item.capabilities||[]).join(', '))}"></label>
    <label>Featured<select data-discovery="featured"><option value="false" ${d.featured?'':'selected'}>false</option><option value="true" ${d.featured?'selected':''}>true</option></select></label>
  `;
  for(const field of ['regions','themes','modes'])$('[data-discovery="'+field+'"]',root).oninput=e=>{d[field]=splitList(e.target.value);markDirty()};
  $('[data-discovery="capabilities"]',root).oninput=e=>{item.capabilities=splitList(e.target.value);markDirty()};
  $('[data-discovery="featured"]',root).onchange=e=>{d.featured=e.target.value==='true';markDirty()};
  $('[data-fit="startRegion"]',root).oninput=e=>{fit.startRegion=e.target.value.trim();markDirty()};
  $('[data-fit="pace"]',root).onchange=e=>{fit.pace=e.target.value;markDirty()};
  $('[data-fit="accessibility"]',root).onchange=e=>{fit.accessibility=e.target.value;markDirty()};
  for(const field of ['seasons','party'])$('[data-fit="'+field+'"]',root).onchange=e=>{fit[field]=[...e.target.selectedOptions].map(option=>option.value);markDirty()};
}

function renderSources(){
  const root=$('#sourcesEditor'),trip=state.draft.trip;
  root.innerHTML=(trip.sources||[]).map((source,index)=>`
    <div class="entity-row" data-source-index="${index}">
      <div class="entity-head"><b>Source ${index+1}</b><button class="remove" data-remove-source="${index}">Remove</button></div>
      <div class="entity-grid">
        <label class="span-2">ID<input data-source-field="id" value="${esc(source.id||'')}"></label>
        <label class="span-2">Title<input data-source-field="title" value="${esc(source.title||'')}"></label>
        <label>Issuer<input data-source-field="issuer" value="${esc(source.issuer||'')}"></label>
        <label>Issuer type<select data-source-field="issuerType">${optionList(sourceTypes,source.issuerType)}</select></label>
        <label class="span-3">HTTPS URL<input data-source-field="url" type="url" value="${esc(source.url||'')}"></label>
        <label>Checked at<input data-source-field="checkedAt" type="date" value="${esc(source.checkedAt||'')}"></label>
        <label class="span-2">Claims · comma separated<input data-source-field="claims" value="${esc((source.claims||[]).join(', '))}"></label>
      </div>
    </div>`).join('')||'<p class="muted">No evidence sources registered yet.</p>';

  $$('[data-source-index]',root).forEach(row=>{
    const source=trip.sources[Number(row.dataset.sourceIndex)];
    for(const field of ['id','title','issuer','url','checkedAt'])$('[data-source-field="'+field+'"]',row).oninput=e=>{source[field]=e.target.value.trim();markDirty()};
    $('[data-source-field="issuerType"]',row).onchange=e=>{source.issuerType=e.target.value;markDirty()};
    $('[data-source-field="claims"]',row).oninput=e=>{source.claims=splitList(e.target.value);markDirty()};
  });
  $$('[data-remove-source]',root).forEach(button=>button.onclick=()=>{trip.sources.splice(Number(button.dataset.removeSource),1);markDirty();renderSources()});
}

function addSource(){
  const n=state.draft.trip.sources.length+1;
  state.draft.trip.sources.push({id:'source-'+String(n).padStart(2,'0'),title:'',issuer:'',issuerType:'official-operator',url:'https://',checkedAt:new Date().toISOString().slice(0,10),claims:[]});
  markDirty();renderSources();
}

function renderAdvanced(){
  if(!state.draft)return;
  $('#tripJson').value=JSON.stringify(state.draft.trip,null,2);
  $('#catalogJson').value=JSON.stringify(state.draft.catalogEntry,null,2);
}

function applyJson(){
  try{
    const trip=JSON.parse($('#tripJson').value);
    const catalogEntry=JSON.parse($('#catalogJson').value);
    if(trip.slug!==state.draft.trip.slug)throw new Error('Trip slug cannot be changed in-place. Create a new draft instead.');
    state.draft={...state.draft,trip,catalogEntry};
    markDirty();renderAll();toast('JSON applied to draft.');
  }catch(error){toast('JSON error: '+error.message)}
}

function renderValidation(){
  const body=$('#validationBody'),gate=$('#validationState');
  if(!state.validation){
    gate.textContent='not run';gate.className='gate idle';
    body.innerHTML='<p class="muted">Run validation to inspect contract errors, warnings and derived metrics.</p>';
    return;
  }
  const result=state.validation;
  gate.textContent=result.ok?'pass':'blocked';gate.className='gate '+(result.ok?'pass':'fail');
  const metricsHtml=result.metrics?'<div class="validation-group"><h4>Derived metrics</h4><div class="validation-metrics">'+Object.entries(result.metrics).map(([key,value])=>`<div><b>${esc(value??'—')}</b><span>${esc(key)}</span></div>`).join('')+'</div></div>':'';
  const errors=result.errors?.length?'<div class="validation-group"><h4>Errors</h4>'+result.errors.map(value=>`<div class="validation-item error">${esc(value)}</div>`).join('')+'</div>':'';
  const warnings=result.warnings?.length?'<div class="validation-group"><h4>Warnings</h4>'+result.warnings.map(value=>`<div class="validation-item warning">${esc(value)}</div>`).join('')+'</div>':'';
  const clean=result.ok&&!result.warnings?.length?'<div class="validation-item">No contract errors or warnings.</div>':'';
  body.innerHTML=metricsHtml+errors+warnings+clean;
}

async function saveDraft(){
  if(!state.draft)return;
  try{
    state.draft=await api('/api/drafts/'+encodeURIComponent(state.draft.trip.slug),{method:'PUT',body:state.draft});
    state.dirty=false;$('#dirtyBadge').classList.add('hidden');renderHeader();renderMetrics();renderAdvanced();updateActionState();
    await bootstrap();renderDraftList();toast('Draft saved locally.');
    return true;
  }catch(error){toast('Save failed: '+error.message);return false}
}

async function validateCurrent(){
  if(!state.draft)return;
  try{
    state.validation=await api('/api/validate',{method:'POST',body:state.draft});
    if(state.validation.draft)state.draft=state.validation.draft;
    renderValidation();renderMetrics();renderAdvanced();
    toast(state.validation.ok?'Validation passed.':'Validation found blocking errors.');
    return state.validation;
  }catch(error){toast('Validation failed: '+error.message);return null}
}

function previewUrl(){
  const slug=state.draft.trip.slug;
  const locale=$('#previewLocale').value||state.draft.trip.defaultLocale||'en';
  return `/preview/${encodeURIComponent(slug)}/?trip=${encodeURIComponent(slug)}&lang=${encodeURIComponent(locale)}`;
}

async function preview(){
  if(!await saveDraft())return;
  setTab('preview');
  $('#previewFrame').src=previewUrl()+'&_='+Date.now();
  toast('Preview loaded through the real regional engine.');
}

function setTab(name){
  state.activeTab=name;
  $$('.tab').forEach(button=>button.classList.toggle('active',button.dataset.tab===name));
  $$('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===name));
  if(name==='advanced')renderAdvanced();
}

function updateActionState(){
  const disabled=!state.draft;
  for(const selector of ['#saveBtn','#validateBtn','#previewBtn','#publishBtn'])$(selector).disabled=disabled;
}

async function createNewDraft(form){
  const data=new FormData(form);
  try{
    const draft=await api('/api/drafts',{method:'POST',body:{
      slug:String(data.get('slug')||'').trim(),
      kind:String(data.get('kind')||'custom').trim(),
      days:Number(data.get('days')||0)||null
    }});
    $('#newDraftDialog').close();
    await bootstrap();
    state.draft=draft;state.dirty=false;state.validation=null;
    $('#emptyState').classList.add('hidden');$('#editor').classList.remove('hidden');renderAll();renderDraftList();
    toast('Draft created.');
  }catch(error){toast('Create failed: '+error.message)}
}

async function publishCurrent(confirmSlug){
  if(!state.draft)return;
  if(state.dirty&&!await saveDraft())return;
  try{
    const result=await api('/api/publish',{method:'POST',body:{draft:state.draft,confirmSlug}});
    $('#publishDialog').close();
    toast(result.message);
    state.validation={ok:true,errors:[],warnings:[],metrics:result.metrics};
    renderValidation();
    await bootstrap();
  }catch(error){
    if(error.payload?.errors){
      state.validation=error.payload;renderValidation();
      toast('Publish gate blocked the draft.');
    }else toast('Publish failed: '+error.message);
  }
}

$('#newDraftBtn').onclick=$('#emptyNewBtn').onclick=()=>{$('#newDraftForm').reset();$('#newDraftDialog').showModal()};
$('#refreshBtn').onclick=refreshBootstrap;
$('#saveBtn').onclick=saveDraft;
$('#validateBtn').onclick=validateCurrent;
$('#previewBtn').onclick=preview;
$('#addPlaceBtn').onclick=addPlace;
$('#addStopBtn').onclick=addStop;
$('#routeFromPlacesBtn').onclick=routeFromPlaces;
$('#rebuildSegmentsBtn').onclick=()=>reconcileSegments();
$('#addSourceBtn').onclick=addSource;
$('#applyJsonBtn').onclick=applyJson;
$('#reloadPreviewBtn').onclick=preview;
$('#openPreviewBtn').onclick=async()=>{if(!await saveDraft())return;window.open(previewUrl(),'_blank','noopener')};
$('#previewLocale').onchange=()=>{if(state.activeTab==='preview'&&state.draft)$('#previewFrame').src=previewUrl()+'&_='+Date.now()};
$$('.tab').forEach(button=>button.onclick=()=>setTab(button.dataset.tab));

$('#newDraftForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.submitter?.value==='cancel'){$('#newDraftDialog').close();return}
  await createNewDraft(event.currentTarget);
});

$('#publishBtn').onclick=()=>{
  $('#publishConfirm').value='';
  $('#publishDialog').showModal();
  setTimeout(()=>$('#publishConfirm').focus(),20);
};
$('#publishForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.submitter?.value==='cancel'){$('#publishDialog').close();return}
  await publishCurrent($('#publishConfirm').value.trim());
});

window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue=''}});
bootstrap().catch(error=>{console.error(error);toast('Builder bootstrap failed: '+error.message)});
