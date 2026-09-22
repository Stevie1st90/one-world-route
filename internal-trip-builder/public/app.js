const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={draft:null,slug:null,dirty:false,locales:['en','de','it','es','fr','pt'],lastGate:null};

const api=async(path,options={})=>{
  const res=await fetch(path,{headers:{'content-type':'application/json',...(options.headers||{})},...options});
  const text=await res.text();
  const data=text?JSON.parse(text):{};
  if(!res.ok)throw Object.assign(new Error(data.error||data.errors?.join('\n')||res.statusText),{data,status:res.status});
  return data;
};
const arr=value=>String(value||'').split(',').map(v=>v.trim()).filter(Boolean);
const fmt=value=>JSON.stringify(value,null,2);
const clone=value=>structuredClone(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=value=>value===''||value==null?null:Number(value);
const markDirty=()=>{state.dirty=true;$('#saveBtn').classList.add('dirty')};
const markClean=()=>{state.dirty=false;$('#saveBtn').classList.remove('dirty')};

function toast(message,error=false){
  const node=$('#toast');node.textContent=message;node.classList.toggle('error',error);node.classList.add('show');
  clearTimeout(node._t);node._t=setTimeout(()=>node.classList.remove('show'),2600);
}

async function refreshDrafts(){
  const {drafts}=await api('/api/drafts');
  $('#draftList').innerHTML=drafts.length?drafts.map(d=>`
    <button class="draft-card ${d.slug===state.slug?'active':''}" data-draft="${esc(d.slug)}">
      <strong>${esc(d.title)}</strong><span>${esc(d.kind)} · ${esc(d.status)}</span>
      <small>${d.metrics.stops} stops · ${d.metrics.segments} segments · ${d.metrics.countries} countries</small>
    </button>`).join(''):'<div class="muted">No drafts yet.</div>';
  $$('[data-draft]').forEach(btn=>btn.onclick=()=>loadDraft(btn.dataset.draft));
}

async function loadDraft(slug){
  if(state.dirty&&!confirm('Discard unsaved changes?'))return;
  state.draft=await api('/api/drafts/'+encodeURIComponent(slug));
  state.slug=slug;state.lastGate=null;
  state.locales=state.draft.trip.supportedLocales||['en','de','it','es','fr','pt'];
  renderEditor();markClean();await refreshDrafts();
}

function metricCard(label,value){return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value??'—')}</strong></div>`;}
function computeMetrics(){
  const t=state.draft?.trip||{};
  const segments=t.segments||[];
  return {
    days:t.planning?.days??null,
    countries:new Set((t.places||[]).map(p=>p.countryCode).filter(Boolean)).size,
    stops:(t.stops||[]).length,
    segments:segments.length,
    sourced:segments.filter(s=>(s.verification?.sourceIds||[]).length).length,
    verified:segments.filter(s=>s.verification?.status==='verified').length
  };
}
function renderMetrics(){
  const m=computeMetrics();
  $('#metrics').innerHTML=[
    metricCard('Days',m.days),metricCard('Countries',m.countries),metricCard('Stops',m.stops),
    metricCard('Segments',m.segments),metricCard('Sourced',m.sourced),metricCard('Verified',m.verified)
  ].join('');
}

function localeInputs(container,object,keyPrefix){
  container.innerHTML=state.locales.map(locale=>`
    <label><span>${locale.toUpperCase()}</span><input data-locale-field="${keyPrefix}" data-locale="${locale}" value="${esc(object?.[locale]||'')}"></label>
  `).join('');
}

function renderOverview(){
  const {trip,catalogEntry}=state.draft;
  $('#slug').value=trip.slug||'';
  $('#kind').value=trip.kind||'custom';
  $('#status').value=trip.status||'draft';
  $('#days').value=trip.planning?.days??'';
  $('#currency').value=trip.planning?.currency||'EUR';
  $('#pace').value=trip.planning?.pace||'balanced';

  const discovery=catalogEntry.discovery||{},fit=discovery.fit||{};
  $('#regions').value=(discovery.regions||[]).join(', ');
  $('#themes').value=(discovery.themes||[]).join(', ');
  $('#modes').value=(discovery.modes||[]).join(', ');
  $('#capabilities').value=(catalogEntry.capabilities||[]).join(', ');
  $('#durationBand').value=discovery.durationBand||'7-14';
  $('#startRegion').value=fit.startRegion||'';
  $('#accessibility').value=fit.accessibility||'standard-check';
  $('#fitPace').value=fit.pace||'balanced';
  $('#seasons').value=(fit.seasons||[]).join(', ');
  $('#party').value=(fit.party||[]).join(', ');

  localeInputs($('#tripTitles'),trip.title,'trip.title');
  localeInputs($('#tripSummaries'),trip.summary,'trip.summary');
  localeInputs($('#catalogTitles'),catalogEntry.title,'catalog.title');
  localeInputs($('#catalogSubtitles'),catalogEntry.subtitle,'catalog.subtitle');
}

function rowShell(title,subtitle,body,index,type){
  return `<article class="row-card" data-row="${type}" data-index="${index}">
    <div class="row-head"><div><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div><button class="danger" data-remove="${type}" data-index="${index}">Remove</button></div>
    <div class="row-grid">${body}</div>
  </article>`;
}
const input=(label,key,value,type='text',extra='')=>`<label>${label}<input data-key="${key}" type="${type}" value="${esc(value??'')}" ${extra}></label>`;
const select=(label,key,value,options)=>`<label>${label}<select data-key="${key}">${options.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;

function renderPlaces(){
  const rows=(state.draft.trip.places||[]).map((p,i)=>rowShell(
    p.name?.en||p.id||'Place '+(i+1),p.countryCode||'',
    input('ID','id',p.id)+input('Type','type',p.type)+input('Country','countryCode',p.countryCode)+
    input('Latitude','coordinates.lat',p.coordinates?.lat,'number','step="any"')+input('Longitude','coordinates.lng',p.coordinates?.lng,'number','step="any"')+
    input('Name EN','name.en',p.name?.en)+input('Name DE','name.de',p.name?.de),
    i,'place'
  )).join('');
  $('#placesTable').innerHTML=rows||'<div class="empty-mini">No places yet.</div>';
}
function renderStops(){
  const rows=(state.draft.trip.stops||[]).map((s,i)=>rowShell(
    s.id||'Stop '+(i+1),s.placeId||'',
    input('ID','id',s.id)+input('Sequence','sequence',s.sequence,'number','min="1"')+input('Place ID','placeId',s.placeId)+
    input('Day start','dayStart',s.dayStart,'number','min="1"')+input('Day end','dayEnd',s.dayEnd,'number','min="1"'),
    i,'stop'
  )).join('');
  $('#stopsTable').innerHTML=rows||'<div class="empty-mini">No stops yet.</div>';
}
function renderSegments(){
  const modes=['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other'];
  const statuses=['draft','current-check-required','verified','illustrative'];
  const rows=(state.draft.trip.segments||[]).map((s,i)=>rowShell(
    s.id||'Segment '+(i+1),`${s.fromStopId||'?'} → ${s.toStopId||'?'}`,
    input('ID','id',s.id)+input('Sequence','sequence',s.sequence,'number','min="1"')+input('From stop','fromStopId',s.fromStopId)+input('To stop','toStopId',s.toStopId)+
    select('Mode','transport.mode',s.transport?.mode||'other',modes)+select('Verification','verification.status',s.verification?.status||'draft',statuses)+
    input('Source IDs','verification.sourceIds',(s.verification?.sourceIds||[]).join(', '))+input('Last verified','verification.lastVerified',s.verification?.lastVerified||'','date'),
    i,'segment'
  )).join('');
  $('#segmentsTable').innerHTML=rows||'<div class="empty-mini">No segments yet.</div>';
}
function renderSources(){
  const issuerTypes=['government','official-operator','international-organization','primary-source','secondary-source'];
  const rows=(state.draft.trip.sources||[]).map((s,i)=>rowShell(
    s.title||s.id||'Source '+(i+1),s.issuer||'',
    input('ID','id',s.id)+input('Title','title',s.title)+input('Issuer','issuer',s.issuer)+select('Issuer type','issuerType',s.issuerType||'primary-source',issuerTypes)+
    input('URL','url',s.url,'url')+input('Checked at','checkedAt',s.checkedAt||'','date'),
    i,'source'
  )).join('');
  $('#sourcesTable').innerHTML=rows||'<div class="empty-mini">No sources yet.</div>';
}

function renderJson(){
  $('#tripJson').value=fmt(state.draft.trip);
  $('#catalogJson').value=fmt(state.draft.catalogEntry);
  $('#extensionsJson').value=fmt(state.draft.trip.extensions||{});
}

function renderGate(){
  const box=$('#validationBox'),out=$('#gateOutput');
  if(!state.lastGate){box.className='validation neutral';box.textContent='No gate run yet.';out.textContent='';return;}
  box.className='validation '+(state.lastGate.ok?'ok':'bad');
  box.innerHTML=state.lastGate.ok?'<strong>Gate passed</strong><span>Candidate is ready for catalog publication.</span>':
    `<strong>Gate failed</strong><span>${esc((state.lastGate.errors||[]).join(' · '))}</span>`;
  out.textContent=(state.lastGate.checks||[]).map(check=>`${check.ok?'✓':'✕'} ${check.command}\n${check.output||''}`).join('\n\n');
}

function renderEditor(){
  $('#emptyState').classList.add('hidden');$('#editor').classList.remove('hidden');
  $('#pageTitle').textContent=state.draft.trip.title?.en||state.slug;
  ['previewBtn','saveBtn','gateBtn','publishBtn'].forEach(id=>$('#'+id).disabled=false);
  renderMetrics();renderOverview();renderPlaces();renderStops();renderSegments();renderSources();renderJson();renderGate();bindRows();
}

function syncOverview(){
  const {trip,catalogEntry}=state.draft;
  trip.kind=$('#kind').value.trim();
  trip.status=$('#status').value;
  catalogEntry.kind=trip.kind;catalogEntry.status=trip.status;
  trip.planning=trip.planning||{};
  trip.planning.days=num($('#days').value);trip.planning.currency=$('#currency').value.trim()||'EUR';trip.planning.pace=$('#pace').value;

  catalogEntry.capabilities=arr($('#capabilities').value);
  catalogEntry.discovery=catalogEntry.discovery||{};
  Object.assign(catalogEntry.discovery,{
    regions:arr($('#regions').value),themes:arr($('#themes').value),modes:arr($('#modes').value),durationBand:$('#durationBand').value
  });
  catalogEntry.discovery.fit=catalogEntry.discovery.fit||{};
  Object.assign(catalogEntry.discovery.fit,{
    startRegion:$('#startRegion').value.trim(),accessibility:$('#accessibility').value,pace:$('#fitPace').value,
    seasons:arr($('#seasons').value),party:arr($('#party').value)
  });
  $$('[data-locale-field]').forEach(node=>{
    const locale=node.dataset.locale,field=node.dataset.localeField;
    const target=field.startsWith('trip.')?trip:catalogEntry;
    const key=field.split('.')[1];target[key]=target[key]||{};target[key][locale]=node.value;
  });
}

function setDeep(object,path,value){
  const keys=path.split('.');let target=object;
  keys.slice(0,-1).forEach(key=>target=target[key]=target[key]??{});
  const key=keys.at(-1);
  if(path.endsWith('sourceIds'))target[key]=arr(value);
  else if(['sequence','dayStart','dayEnd','coordinates.lat','coordinates.lng'].includes(path))target[key]=num(value);
  else target[key]=value;
}

function bindRows(){
  $$('.row-card').forEach(card=>{
    card.querySelectorAll('[data-key]').forEach(control=>control.oninput=()=>{
      const type=card.dataset.row,index=Number(card.dataset.index);
      const collection=type==='place'?state.draft.trip.places:type==='stop'?state.draft.trip.stops:type==='segment'?state.draft.trip.segments:state.draft.trip.sources;
      setDeep(collection[index],control.dataset.key,control.value);markDirty();renderMetrics();renderJson();
    });
  });
  $$('[data-remove]').forEach(btn=>btn.onclick=()=>{
    const type=btn.dataset.remove,index=Number(btn.dataset.index);
    const key=type==='place'?'places':type==='stop'?'stops':type==='segment'?'segments':'sources';
    state.draft.trip[key].splice(index,1);markDirty();renderEditor();
  });
}

function addItem(type){
  const t=state.draft.trip;
  if(type==='place'){
    const n=t.places.length+1;t.places.push({id:`place-${n}`,type:'city',countryCode:'',name:{en:`Place ${n}`,de:`Place ${n}`},coordinates:{lat:null,lng:null}});
  }else if(type==='stop'){
    const n=t.stops.length+1;t.stops.push({id:`${state.slug}-stop-${String(n).padStart(2,'0')}`,sequence:n,placeId:t.places[n-1]?.id||t.places[0]?.id||'',dayStart:n,dayEnd:n});
  }else if(type==='segment'){
    const n=t.segments.length+1,stops=[...t.stops].sort((a,b)=>a.sequence-b.sequence);
    t.segments.push({id:`${state.slug}-segment-${String(n).padStart(2,'0')}`,sequence:n,fromStopId:stops[n-1]?.id||'',toStopId:stops[n]?.id||'',transport:{mode:'other'},planning:{durationMinutes:null},verification:{status:'draft',sourceIds:[]}});
  }else if(type==='source'){
    const n=t.sources.length+1;t.sources.push({id:`source-${n}`,title:'',issuer:'',issuerType:'primary-source',url:'https://',checkedAt:new Date().toISOString().slice(0,10),claims:[]});
  }
  markDirty();renderEditor();
}

async function save(){
  syncOverview();
  try{state.draft.trip.extensions=JSON.parse($('#extensionsJson').value||'{}')}catch(error){toast('Extensions JSON: '+error.message,true);throw error;}
  const result=await api('/api/drafts/'+encodeURIComponent(state.slug),{method:'PUT',body:JSON.stringify(state.draft)});
  state.draft={trip:result.trip,catalogEntry:result.catalogEntry};markClean();renderEditor();await refreshDrafts();
  if(result.validation?.errors?.length)toast('Saved with '+result.validation.errors.length+' validation issue(s)',true);else toast('Draft saved');
  return result;
}

async function runGate(){
  if(state.dirty)await save();
  $('#validationBox').className='validation neutral';$('#validationBox').textContent='Running sandbox platform gate…';
  try{
    state.lastGate=await api('/api/drafts/'+encodeURIComponent(state.slug)+'/gate',{method:'POST',body:'{}'});
    renderGate();toast('Publish gate passed');
  }catch(error){
    state.lastGate=error.data||{ok:false,errors:[error.message]};renderGate();toast('Publish gate failed',true);
  }
}

async function publish(){
  if(!state.lastGate?.ok)await runGate();
  if(!state.lastGate?.ok)return;
  if(!confirm('Publish this draft into the public data catalog in your local working tree? This does not commit or deploy automatically.'))return;
  try{
    const result=await api('/api/drafts/'+encodeURIComponent(state.slug)+'/publish',{method:'POST',body:'{}'});
    toast('Published to local public catalog');
    state.lastGate=result;renderGate();
  }catch(error){state.lastGate=error.data||{ok:false,errors:[error.message]};renderGate();toast('Publish failed',true);}
}

function bindStatic(){
  $('#refreshBtn').onclick=refreshDrafts;
  $('#newDraftBtn').onclick=()=>$('#newDraftDialog').showModal();
  $('#newDraftForm').addEventListener('submit',async e=>{
    if(e.submitter?.value==='cancel')return;
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    try{
      const draft=await api('/api/drafts',{method:'POST',body:JSON.stringify(Object.fromEntries(form))});
      $('#newDraftDialog').close();e.currentTarget.reset();e.currentTarget.elements.kind.value='custom';
      await refreshDrafts();await loadDraft(draft.trip.slug);toast('Draft created');
    }catch(error){toast(error.message,true);}
  });
  $('#saveBtn').onclick=()=>save().catch(()=>{});
  $('#gateBtn').onclick=runGate;$('#gateInlineBtn').onclick=runGate;$('#publishBtn').onclick=publish;
  $('#previewBtn').onclick=async()=>{
    if(state.dirty)await save();
    window.open(`/preview/${encodeURIComponent(state.slug)}/?trip=${encodeURIComponent(state.slug)}&lang=en`,'_blank','noopener');
  };
  $('#applyRawBtn').onclick=()=>{
    try{
      const next={trip:JSON.parse($('#tripJson').value),catalogEntry:JSON.parse($('#catalogJson').value)};
      if(next.trip.slug!==state.slug||next.trip.id!==state.slug)throw new Error('Draft identity cannot be changed in Raw JSON. Create a new draft instead.');
      state.draft=next;markDirty();renderEditor();toast('Raw JSON applied');
    }catch(error){toast('Invalid JSON: '+error.message,true);}
  };
  $('#tabs').onclick=e=>{
    const btn=e.target.closest('[data-tab]');if(!btn)return;
    $$('#tabs button').forEach(x=>x.classList.toggle('active',x===btn));
    $$('.tab').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===btn.dataset.tab));
    if(btn.dataset.tab==='raw')renderJson();if(btn.dataset.tab==='gate')renderGate();
  };
  document.addEventListener('input',e=>{
    if(e.target.closest('[data-panel="overview"]')||e.target.id==='extensionsJson'){syncOverview();markDirty();renderMetrics();renderJson();}
  });
  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-add]');if(add)addItem(add.dataset.add);
  });
  window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
}

bindStatic();
await refreshDrafts();
