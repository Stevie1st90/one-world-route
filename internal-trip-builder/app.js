const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
let state={catalog:null,drafts:[],slug:null,trip:null,catalogEntry:null,tab:'places'};
const api=async(path,opt={})=>{const r=await fetch('/__builder/api/'+path,{headers:{'content-type':'application/json'},...opt}),j=await r.json();if(!r.ok||j.ok===false)throw new Error(j.error||'Request failed');return j};
const csv=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean),join=v=>(v||[]).join(', '),clone=v=>JSON.parse(JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localized(obj,val){for(const l of state.catalog.supportedLocales||['en'])if(!(l in obj))obj[l]=val;return obj}
function calc(){const t=state.trip||{},s=t.segments||[];return{days:t.planning?.days??'—',stops:(t.stops||[]).length,segments:s.length,countries:new Set((t.places||[]).map(p=>p.countryCode).filter(Boolean)).size,sourced:s.filter(x=>(x.verification?.sourceIds||[]).length).length,verified:s.filter(x=>x.verification?.status==='verified').length}}
function renderMetrics(){$('#metrics').innerHTML=Object.entries(calc()).map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')}
function renderDrafts(){$('#drafts').innerHTML=state.drafts.map(d=>'<button class="draft '+(d.slug===state.slug?'active':'')+'" data-slug="'+d.slug+'"><b>'+esc(d.title)+'</b><small>'+esc(d.kind)+' · '+esc(d.status)+'</small></button>').join('');$$('.draft').forEach(b=>b.onclick=()=>loadDraft(b.dataset.slug));const mobile=$('#mobileDraftSelect');mobile.innerHTML='<option value="">Select draft…</option>'+state.drafts.map(d=>'<option value="'+d.slug+'" '+(d.slug===state.slug?'selected':'')+'>'+esc(d.title)+'</option>').join('')}
function sectionValue(){if(state.tab==='extensions')return state.trip.extensions||{};if(state.tab==='localization')return{title:state.trip.title||{},summary:state.trip.summary||{},subtitle:state.catalogEntry.subtitle||{}};if(state.tab==='trip')return state.trip;if(state.tab==='catalog')return state.catalogEntry;return state.trip[state.tab]||[]}
function readSection(){try{return JSON.parse($('#jsonEditor').value)}catch(e){throw new Error('JSON: '+e.message)}}
function syncSection(){if(!state.trip)return;const v=readSection();if(state.tab==='extensions')state.trip.extensions=v;else if(state.tab==='localization'){state.trip.title=v.title||{};state.trip.summary=v.summary||{};state.catalogEntry.title=clone(state.trip.title);state.catalogEntry.subtitle=v.subtitle||{}}else if(state.tab==='trip')state.trip=v;else if(state.tab==='catalog')state.catalogEntry=v;else state.trip[state.tab]=v;renderMetrics()}
function showTab(tab){state.tab=tab;$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('#jsonEditor').value=JSON.stringify(sectionValue(),null,2)}
function bind(){
 const t=state.trip,e=state.catalogEntry,d=e.discovery||{},f=d.fit||{};
 $('#slug').value=t.slug||'';$('#kind').value=t.kind||'';$('#status').value=t.status||'draft';$('#days').value=t.planning?.days??'';
 $('#titleEn').value=t.title?.en||'';$('#titleDe').value=t.title?.de||'';$('#subtitleEn').value=e.subtitle?.en||'';$('#subtitleDe').value=e.subtitle?.de||'';
 $('#regions').value=join(d.regions);$('#themes').value=join(d.themes);$('#modes').value=join(d.modes);$('#durationBand').value=d.durationBand||'7-14';
 $('#pace').value=f.pace||'balanced';$('#seasons').value=join(f.seasons);$('#party').value=join(f.party);$('#startRegion').value=f.startRegion||'';$('#accessibility').value=f.accessibility||'standard-check';$('#capabilities').value=join(e.capabilities);
 showTab(state.tab);renderMetrics();
}
function collect(){
 syncSection();const t=clone(state.trip),e=clone(state.catalogEntry);
 t.kind=$('#kind').value.trim();t.status=$('#status').value;t.planning=t.planning||{};t.planning.days=$('#days').value?Number($('#days').value):null;
 t.title=localized(t.title||{},$('#titleEn').value.trim());t.title.en=$('#titleEn').value.trim();t.title.de=$('#titleDe').value.trim();
 e.kind=t.kind;e.status=t.status;e.title=localized(e.title||{},t.title.en);e.title.en=t.title.en;e.title.de=t.title.de;
 e.subtitle=localized(e.subtitle||{},$('#subtitleEn').value.trim());e.subtitle.en=$('#subtitleEn').value.trim();e.subtitle.de=$('#subtitleDe').value.trim();
 e.capabilities=csv($('#capabilities').value);e.discovery=e.discovery||{};e.discovery.regions=csv($('#regions').value);e.discovery.themes=csv($('#themes').value);e.discovery.modes=csv($('#modes').value);e.discovery.durationBand=$('#durationBand').value;
 e.discovery.fit={pace:$('#pace').value,seasons:csv($('#seasons').value),party:csv($('#party').value),startRegion:$('#startRegion').value.trim(),accessibility:$('#accessibility').value};
 return{trip:t,catalogEntry:e};
}
function gate(r){const n=$('#gate'),checks=r.qualityChecks?.length?' · '+r.qualityChecks.length+' quality checks passed':'';n.className='gate '+(r.valid?'ok':'bad');n.innerHTML=r.valid?'✓ Publish gate passed'+checks+(r.warnings?.length?' · '+r.warnings.length+' warnings':''):'✕ '+r.errors.length+' blocking issue(s)<br>'+r.errors.map(esc).join('<br>')}
async function loadState(){const r=await api('state');state.catalog=r.catalog;state.drafts=r.drafts;renderDrafts();$('#cloneSelect').innerHTML=(r.catalog.trips||[]).filter(t=>t.renderer==='regional-globe').map(t=>'<option value="'+t.slug+'">'+esc(t.title?.en||t.slug)+'</option>').join('')}
async function loadDraft(slug){const r=await api('draft/'+slug);state.slug=slug;state.trip=r.trip;state.catalogEntry=r.catalogEntry;$('#empty').classList.add('hidden');$('#editor').classList.remove('hidden');$('#heading').textContent=r.trip.title?.en||slug;$('#subheading').textContent=r.trip.kind+' · local draft';['previewBtn','saveBtn','validateBtn','publishBtn'].forEach(id=>$('#'+id).disabled=false);$('#gate').className='gate';$('#gate').textContent='Not validated yet.';bind();await loadState()}
async function save(){const r=await api('draft/'+state.slug,{method:'PUT',body:JSON.stringify(collect())});state.trip=r.trip;state.catalogEntry=r.catalogEntry;gate(r);renderMetrics();await loadState();return r}
$('#newBtn').onclick=()=>$('#newDialog').showModal();$('#cloneBtn').onclick=()=>$('#cloneDialog').showModal();$('#mobileNewBtn').onclick=()=>$('#newDialog').showModal();$('#mobileCloneBtn').onclick=()=>$('#cloneDialog').showModal();$('#mobileDraftSelect').onchange=e=>{if(e.target.value)loadDraft(e.target.value)};$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#newForm').onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.currentTarget),r=await api('scaffold',{method:'POST',body:JSON.stringify({slug:f.get('slug'),kind:f.get('kind'),days:f.get('days')||null})});$('#newDialog').close();await loadState();await loadDraft(r.trip.slug)}catch(x){alert(x.message)}};
$('#cloneForm').onsubmit=async e=>{e.preventDefault();try{const slug=new FormData(e.currentTarget).get('slug');await api('clone',{method:'POST',body:JSON.stringify({slug})});$('#cloneDialog').close();await loadState();await loadDraft(slug)}catch(x){alert(x.message)}};
$$('[data-tab]').forEach(b=>b.onclick=()=>{try{syncSection();showTab(b.dataset.tab)}catch(x){alert(x.message)}});$('#formatBtn').onclick=()=>{try{$('#jsonEditor').value=JSON.stringify(readSection(),null,2)}catch(x){alert(x.message)}};$('#applyBtn').onclick=()=>{try{syncSection()}catch(x){alert(x.message)}};
$('#saveBtn').onclick=async()=>{try{await save()}catch(x){alert(x.message)}};$('#validateBtn').onclick=async()=>{try{await save();gate(await api('draft/'+state.slug+'/validate',{method:'POST'}))}catch(x){alert(x.message)}};
$('#previewBtn').onclick=async()=>{const preview=window.open('about:blank','owr-preview');try{await save();if(!preview)throw new Error('Preview window was blocked by the browser');preview.location='/?trip='+encodeURIComponent(state.slug)+'&lang=en&__draft='+encodeURIComponent(state.slug)}catch(x){preview?.close();alert(x.message)}};
$('#publishBtn').onclick=async()=>{if(!confirm('Publish this draft into the local public catalog after validation?'))return;try{await save();const r=await api('draft/'+state.slug+'/publish',{method:'POST'});gate({...r.validation,qualityChecks:r.qualityChecks||[]});if(r.published){alert('Published locally after the full quality gate. Review git diff and run the normal QA/commit/deploy workflow.');await loadDraft(state.slug);gate({...r.validation,qualityChecks:r.qualityChecks||[]})}}catch(x){alert(x.message)}};
loadState();
