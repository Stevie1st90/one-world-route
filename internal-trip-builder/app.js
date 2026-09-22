const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
let catalog=null,draft=null,activeSlug=null,validation=null,dirty=false;

async function api(path,options={}){
  const r=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(body.error||'Request failed '+r.status),{body,status:r.status});
  return body;
}
function toast(message){
  const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2400);
}
const csv=value=>String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
const localized=(object,locale,value)=>({...object,[locale]:value});
function markDirty(){
  dirty=true;validation=null;
  $('#statusDot').className='status-dot dirty';
  $('#activeMeta').textContent='Unsaved changes';
  $('#publishBtn').disabled=true;
}
function setGate(result){
  validation=result;
  const ok=result?.ok===true;
  $('#statusDot').className='status-dot '+(ok?'valid':'invalid');
  $('#gateState').textContent=ok?'Ready to publish':'Publish blocked';
  const m=result?.metrics;
  $('#gateMetrics').textContent=m?`${m.days??'—'} days · ${m.stops} stops · ${m.segments} segments · ${m.countries} countries`:'—';
  const render=(el,items,type,empty)=>{el.innerHTML=items?.length?items.map(x=>`<div class="message ${type}">${escapeHtml(x)}</div>`).join(''):`<div class="message ok">${escapeHtml(empty)}</div>`};
  render($('#gateErrors'),result?.errors,'error','No blocking errors');
  render($('#gateWarnings'),result?.warnings,'warning','No warnings');
  $('#gateTechnical').textContent=JSON.stringify(result,null,2);
  $('#publishBtn').disabled=!ok||dirty;
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function field(label,value,key,type='text',extra=''){
  return `<label>${label}<input data-field="${key}" type="${type}" value="${escapeHtml(value??'')}" ${extra}></label>`;
}
function selectField(label,value,key,options){
  return `<label>${label}<select data-field="${key}">${options.map(v=>`<option value="${escapeHtml(v)}" ${v===value?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>`;
}

async function refreshState(){
  const state=await api('/api/state');catalog=state.publicCatalog;
  $('#draftList').innerHTML=state.drafts.length?state.drafts.map(d=>`<button class="draft-card ${d.slug===activeSlug?'active':''}" data-draft="${escapeHtml(d.slug)}"><b>${escapeHtml(d.title)}</b><span>${escapeHtml(d.kind)} · ${escapeHtml(d.slug)}</span></button>`).join(''):'<div class="internal-note">No drafts yet.</div>';
  $$('[data-draft]').forEach(b=>b.onclick=()=>openDraft(b.dataset.draft));
}
async function openDraft(slug){
  if(dirty&&!confirm('Discard unsaved changes?'))return;
  const loaded=await api('/api/drafts/'+encodeURIComponent(slug));
  draft={trip:loaded.trip,catalogEntry:loaded.catalogEntry};activeSlug=slug;dirty=false;validation=null;
  $('#emptyState').classList.add('hidden');$('#editor').classList.remove('hidden');
  $('#activeTitle').textContent=draft.trip.title?.en||slug;$('#activeMeta').textContent=draft.trip.kind+' · draft';
  $('#statusDot').className='status-dot';
  ['saveBtn','validateBtn','previewBtn','refreshPreviewBtn'].forEach(id=>$('#'+id).disabled=false);
  $('#publishBtn').disabled=true;
  renderEditor();await refreshState();refreshPreview();
}
function renderEditor(){
  const t=draft.trip,c=draft.catalogEntry,d=c.discovery||{},fit=d.fit||{};
  $('#slug').value=t.slug||'';$('#kind').value=t.kind||'';$('#status').value=t.status||'draft';$('#days').value=t.planning?.days??'';
  $('#regions').value=(d.regions||[]).join(', ');$('#themes').value=(d.themes||[]).join(', ');$('#modes').value=(d.modes||[]).join(', ');
  $('#pace').value=fit.pace||'balanced';$('#seasons').value=(fit.seasons||[]).join(', ');$('#party').value=(fit.party||[]).join(', ');
  $('#startRegion').value=fit.startRegion||'';$('#accessibility').value=fit.accessibility||'standard-check';$('#capabilities').value=(c.capabilities||[]).join(', ');
  renderLocales();renderPlaces();renderStops();renderSegments();renderSources();syncJson();
  setGate({ok:false,errors:['Run validation after saving the current draft.'],warnings:[],metrics:null});
  $('#statusDot').className='status-dot';
}
function renderLocales(){
  const locales=catalog.supportedLocales||draft.trip.supportedLocales||['en'];
  $('#locales').innerHTML=locales.map(locale=>`<div class="locale-card" data-locale="${locale}"><h3>${locale}</h3><label>Title<input data-local="title" value="${escapeHtml(draft.trip.title?.[locale]||'')}"></label><label>Subtitle<input data-local="subtitle" value="${escapeHtml(draft.catalogEntry.subtitle?.[locale]||'')}"></label><label>Summary<textarea data-local="summary">${escapeHtml(draft.trip.summary?.[locale]||'')}</textarea></label></div>`).join('');
}
function renderPlaces(){
  $('#placesTable').innerHTML=(draft.trip.places||[]).map((p,i)=>`<div class="row place" data-index="${i}">${field('ID',p.id,'id')}${field('Type',p.type,'type')}${field('Country',p.countryCode,'countryCode')}${field('English name',p.name?.en,'nameEn')}${field('Latitude',p.coordinates?.lat,'lat','number','step="any"')}${field('Longitude',p.coordinates?.lng,'lng','number','step="any"')}<button class="remove" data-remove="place">Remove</button></div>`).join('');
}
function renderStops(){
  $('#stopsTable').innerHTML=(draft.trip.stops||[]).map((s,i)=>`<div class="row stop" data-index="${i}">${field('Sequence',s.sequence,'sequence','number','min="1"')}${field('Stop ID',s.id,'id')}${field('Place ID',s.placeId,'placeId')}${field('Day',s.day??s.dayStart??'','day','number','min="1"')}${field('Kind',s.kind||'stop','kind')}<button class="remove" data-remove="stop">Remove</button></div>`).join('');
}
function renderSegments(){
  const modes=['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other'];
  const statuses=['draft','current-check-required','verified','illustrative'];
  $('#segmentsTable').innerHTML=(draft.trip.segments||[]).map((s,i)=>`<div class="row segment" data-index="${i}">${field('Sequence',s.sequence,'sequence','number','min="1"')}${field('Segment ID',s.id,'id')}${field('From stop',s.fromStopId,'fromStopId')}${field('To stop',s.toStopId,'toStopId')}${selectField('Mode',s.transport?.mode||'other','mode',modes)}${selectField('Status',s.verification?.status||'draft','status',statuses)}${field('Source IDs',(s.verification?.sourceIds||[]).join(', '),'sourceIds')}<button class="remove" data-remove="segment">Remove</button></div>`).join('');
}
function renderSources(){
  const types=['government','official-operator','international-organization','primary-source','secondary-source'];
  $('#sourcesTable').innerHTML=(draft.trip.sources||[]).map((s,i)=>`<div class="row source" data-index="${i}">${field('Source ID',s.id,'id')}${field('Title',s.title,'title')}${field('Issuer',s.issuer,'issuer')}${selectField('Issuer type',s.issuerType||'primary-source','issuerType',types)}${field('HTTPS URL',s.url,'url')}${field('Checked',s.checkedAt,'checkedAt','date')}<button class="remove" data-remove="source">Remove</button></div>`).join('');
}
function collectRows(selector,current,mapper){
  return $$(selector).map(row=>{const old=current[Number(row.dataset.index)]||{};const values={};$$('[data-field]',row).forEach(el=>values[el.dataset.field]=el.value);return mapper(old,values)});
}
function collectStructured(){
  const t=draft.trip,c=draft.catalogEntry;
  t.kind=$('#kind').value.trim();c.kind=t.kind;t.status=$('#status').value;c.status=t.status;t.planning=t.planning||{};t.planning.days=Number($('#days').value)||null;
  c.capabilities=csv($('#capabilities').value);
  c.discovery=c.discovery||{};c.discovery.regions=csv($('#regions').value);c.discovery.themes=csv($('#themes').value);c.discovery.modes=csv($('#modes').value);
  c.discovery.fit=c.discovery.fit||{};c.discovery.fit.pace=$('#pace').value;c.discovery.fit.seasons=csv($('#seasons').value);c.discovery.fit.party=csv($('#party').value);c.discovery.fit.startRegion=$('#startRegion').value.trim();c.discovery.fit.accessibility=$('#accessibility').value;
  $$('.locale-card').forEach(card=>{
    const l=card.dataset.locale;
    t.title=localized(t.title||{},l,$('[data-local="title"]',card).value.trim());
    c.title=localized(c.title||{},l,$('[data-local="title"]',card).value.trim());
    c.subtitle=localized(c.subtitle||{},l,$('[data-local="subtitle"]',card).value.trim());
    t.summary=localized(t.summary||{},l,$('[data-local="summary"]',card).value.trim());
  });
  t.places=collectRows('#placesTable .row',t.places||[],(old,v)=>({...old,id:v.id.trim(),type:v.type.trim()||'place',countryCode:v.countryCode.trim().toUpperCase(),name:{...(old.name||{}),en:v.nameEn.trim()},coordinates:{lat:Number(v.lat),lng:Number(v.lng)}}));
  t.stops=collectRows('#stopsTable .row',t.stops||[],(old,v)=>({...old,sequence:Number(v.sequence),id:v.id.trim(),placeId:v.placeId.trim(),day:Number(v.day)||undefined,kind:v.kind.trim()||'stop'}));
  t.segments=collectRows('#segmentsTable .row',t.segments||[],(old,v)=>({...old,sequence:Number(v.sequence),id:v.id.trim(),fromStopId:v.fromStopId.trim(),toStopId:v.toStopId.trim(),transport:{...(old.transport||{}),mode:v.mode},verification:{...(old.verification||{}),status:v.status,sourceIds:csv(v.sourceIds)}}));
  t.sources=collectRows('#sourcesTable .row',t.sources||[],(old,v)=>({...old,id:v.id.trim(),title:v.title.trim(),issuer:v.issuer.trim(),issuerType:v.issuerType,url:v.url.trim(),checkedAt:v.checkedAt}));
  syncJson();
}
function syncJson(){
  $('#tripJson').value=JSON.stringify(draft.trip,null,2);$('#catalogJson').value=JSON.stringify(draft.catalogEntry,null,2);
}
async function save(){
  collectStructured();
  const result=await api('/api/drafts/'+encodeURIComponent(activeSlug),{method:'PUT',body:JSON.stringify(draft)});
  draft={trip:result.trip,catalogEntry:result.catalogEntry};dirty=false;validation=null;
  $('#statusDot').className='status-dot';$('#activeMeta').textContent=draft.trip.kind+' · saved';$('#publishBtn').disabled=true;
  await refreshState();toast('Draft saved');refreshPreview();
}
async function validate(){
  if(dirty)await save();
  const result=await api('/api/drafts/'+encodeURIComponent(activeSlug)+'/validate',{method:'POST',body:'{}'});
  setGate(result);switchTab('gate');return result;
}
async function publish(){
  const result=validation?.ok?validation:await validate();if(!result.ok)return;
  if(!confirm('Publish this draft into the public trip catalog? The local publish gate will run authoritative validators and rollback on failure.'))return;
  $('#publishBtn').disabled=true;$('#publishBtn').textContent='Publishing…';
  try{
    const report=await api('/api/drafts/'+encodeURIComponent(activeSlug)+'/publish',{method:'POST',body:'{}'});
    $('#gateTechnical').textContent=JSON.stringify(report,null,2);toast('Published locally. Commit the generated public data after review.');
    $('#activeMeta').textContent=draft.trip.kind+' · published locally';await refreshState();
  }catch(err){
    const report=err.body||{error:err.message};$('#gateTechnical').textContent=JSON.stringify(report,null,2);toast('Publish gate failed');
  }finally{$('#publishBtn').textContent='Publish';$('#publishBtn').disabled=!validation?.ok}
}
function refreshPreview(){
  if(!activeSlug)return;
  const frame=$('#previewFrame');frame.src=`/preview/${encodeURIComponent(activeSlug)}/?trip=${encodeURIComponent(activeSlug)}&lang=en&builder=${Date.now()}`;
  $('#previewPane').classList.add('has-preview');
}
function switchTab(tab){
  $$('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $$('[data-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!==tab));
  if(tab==='json'){collectStructured();syncJson()}
}

document.addEventListener('input',e=>{if(e.target.closest('#editor')&&!e.target.matches('#tripJson,#catalogJson'))markDirty()});
document.addEventListener('change',e=>{if(e.target.closest('#editor'))markDirty()});
$('#tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)switchTab(b.dataset.tab)};
document.addEventListener('click',e=>{
  const add=e.target.closest('[data-add]');
  if(add&&draft){
    collectStructured();
    if(add.dataset.add==='place')draft.trip.places.push({id:'place-'+(draft.trip.places.length+1),type:'city',countryCode:'',name:{en:''},coordinates:{lat:0,lng:0}});
    if(add.dataset.add==='stop')draft.trip.stops.push({sequence:draft.trip.stops.length+1,id:'stop-'+(draft.trip.stops.length+1),placeId:'',day:draft.trip.stops.length+1,kind:'stop'});
    if(add.dataset.add==='source')draft.trip.sources.push({id:'source-'+(draft.trip.sources.length+1),title:'',issuer:'',issuerType:'primary-source',url:'https://',checkedAt:new Date().toISOString().slice(0,10),claims:[]});
    renderEditor();markDirty();
  }
  const remove=e.target.closest('[data-remove]');
  if(remove&&draft){
    collectStructured();const row=remove.closest('.row'),index=Number(row.dataset.index);
    const key=remove.dataset.remove==='place'?'places':remove.dataset.remove==='stop'?'stops':remove.dataset.remove==='segment'?'segments':'sources';
    draft.trip[key].splice(index,1);renderEditor();markDirty();
  }
  if(e.target.closest('[data-action="build-segments"]')&&draft){
    collectStructured();const stops=[...draft.trip.stops].sort((a,b)=>a.sequence-b.sequence);const mode=csv($('#modes').value)[0]||'other';
    draft.trip.segments=stops.slice(0,-1).map((s,i)=>({sequence:i+1,id:'leg-'+(i+1),fromStopId:s.id,toStopId:stops[i+1].id,transport:{mode,stages:[]},planning:{durationMinutes:null,durationBasis:'live-timetable-required'},verification:{status:'draft',sourceIds:[]}}));
    renderEditor();markDirty();
  }
});
$('#applyJsonBtn').onclick=()=>{
  try{
    const trip=JSON.parse($('#tripJson').value),catalogEntry=JSON.parse($('#catalogJson').value);
    if(trip.slug!==activeSlug)throw new Error('Trip JSON slug must remain '+activeSlug);
    draft={trip,catalogEntry};renderEditor();markDirty();toast('JSON applied');
  }catch(err){toast('Invalid JSON: '+err.message)}
};
$('#saveBtn').onclick=()=>save().catch(err=>toast(err.message));
$('#validateBtn').onclick=()=>validate().catch(err=>toast(err.message));
$('#gateValidateBtn').onclick=()=>validate().catch(err=>toast(err.message));
$('#publishBtn').onclick=()=>publish();
$('#previewBtn').onclick=async()=>{if(dirty)await save();window.open(`/preview/${encodeURIComponent(activeSlug)}/?trip=${encodeURIComponent(activeSlug)}&lang=en`,'_blank','noopener')};
$('#refreshPreviewBtn').onclick=async()=>{if(dirty)await save();refreshPreview()};
const dialog=$('#newDialog');
const openNew=()=>{dialog.showModal();$('#newForm [name="slug"]').focus()};
$('#newDraftBtn').onclick=openNew;$('#emptyNewBtn').onclick=openNew;
$('#newForm [value="cancel"]').onclick=e=>{e.preventDefault();dialog.close()};
$('#newForm').onsubmit=async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const f=new FormData(form),input={slug:String(f.get('slug')||'').trim(),kind:String(f.get('kind')||'custom').trim(),days:Number(f.get('days')||0)||null,title:String(f.get('title')||'').trim()};
  try{await api('/api/drafts',{method:'POST',body:JSON.stringify(input)});dialog.close();form.reset();await refreshState();await openDraft(input.slug);toast('Draft created')}catch(err){toast(err.message)}
};

await refreshState();
