const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
let state={catalog:null,drafts:[],archetypes:[],sourceLibrary:[],maintenanceItems:[],slug:null,trip:null,catalogEntry:null,tab:'places'};
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
function renderCoverage(coverage){
 const s=coverage.summary||{},summary=$('#coverageSummary');
 summary.innerHTML=[
  ['Coverage',(s.coveragePct??0)+'%'],
  ['Places',(s.coveredPlaces??0)+' / '+(s.totalPlaces??0)],
  ['Complete journeys',(s.completeJourneys??0)+' / '+(s.journeys??0)],
  ['Profiles',s.profiles??0],
  ['Reused profiles',s.reusedProfiles??0]
 ].map(([label,value])=>'<div><b>'+esc(value)+'</b><span>'+esc(label)+'</span></div>').join('');
 const queue=(coverage.queue||[]).slice(0,30);
 $('#coverageQueue').innerHTML=queue.length?queue.map((item,index)=>{
   const action=item.action==='link-existing'?'Link existing profile':'Create profile';
   const impact=item.journeyCount+' journey'+(item.journeyCount===1?'':'s')+' · '+item.stopDays+' route day'+(item.stopDays===1?'':'s')+(item.featuredJourneyCount?' · '+item.featuredJourneyCount+' featured':'');
   return '<article class="coverage-item"><span class="coverage-rank">'+String(index+1).padStart(2,'0')+'</span><div><b>'+esc(item.name)+' <small>'+esc(item.countryCode)+'</small></b><p>'+esc(impact)+'</p><code>'+esc(item.suggestedProfileId||'—')+'</code><em>'+esc(action)+'</em></div></article>';
 }).join(''):'<div class="coverage-empty">All published regional places have reusable experience content.</div>';
 $('#coverageJourneys').innerHTML=(coverage.journeys||[]).map(item=>
   '<article class="coverage-journey"><div><b>'+esc(item.title)+'</b><span>'+esc(item.coveredPlaces)+' / '+esc(item.totalPlaces)+' places</span></div><div class="coverage-bar"><i style="width:'+Math.max(0,Math.min(100,Number(item.coveragePct)||0))+'%"></i></div><strong>'+esc(item.coveragePct)+'%</strong></article>'
 ).join('');
}
async function openCoverage(){
 const dialog=$('#coverageDialog');
 dialog.showModal();
 $('#coverageSummary').innerHTML='<div class="coverage-loading">Loading current coverage…</div>';
 $('#coverageQueue').innerHTML='';$('#coverageJourneys').innerHTML='';
 try{const r=await api('experience-coverage');renderCoverage(r.coverage)}
 catch(error){$('#coverageSummary').innerHTML='<div class="coverage-error">'+esc(error.message)+'</div>'}
}

function renderMaintenance(queue){
 const s=queue.summary||{};
 $('#maintenanceSummary').innerHTML=[
  ['External sources',s.uniqueExternalSources??0],
  ['Reused sources',s.reusedExternalSources??0],
  ['Expired',s.expired??0],
  ['Overdue',s.overdue??0],
  ['Due soon',s.dueSoon??0]
 ].map(([label,value])=>'<div><b>'+esc(value)+'</b><span>'+esc(label)+'</span></div>').join('');
 const items=(queue.items||[]).slice(0,80);state.maintenanceItems=items;
 $('#maintenanceQueue').innerHTML=items.length?items.map((item,index)=>{
   const title=esc(item.title||item.profileId||item.id),itemState=esc(item.state||'unknown'),when=esc(item.nextReviewAt||item.validUntil||'—');
   const reuse=item.reuseCount>1?' · '+esc(item.reuseCount)+' dependents':'';
   const detail=item.type==='external-source'?(esc(item.issuer||'external source')+reuse):(esc(item.countryCode||'place experience'));
   const journeyDependents=(item.dependents||[]).filter(dep=>dep.kind==='journey').length;
   const action=item.type==='external-source'&&journeyDependents?'<button type="button" data-source-sync="'+index+'">Update '+journeyDependents+' journey'+(journeyDependents===1?'':'s')+'</button>':'';
   return '<article class="maintenance-item state-'+itemState+'"><div><span>'+itemState+'</span><b>'+title+'</b><small>'+detail+'</small></div><div><strong>'+when+'</strong><small>'+esc(item.priorityReason||'')+'</small>'+action+'</div></article>';
 }).join(''):'<div class="coverage-empty">No maintenance items found.</div>';
 const health=queue.journeyHealth||[];
 $('#journeyHealth').innerHTML=health.map(item=>'<article class="maintenance-item state-'+esc(item.state)+'"><div><span>'+esc(item.state.replaceAll('-',' '))+'</span><b>'+esc(item.title)+'</b><small>'+esc(item.totalSources)+' sources · '+esc(item.currentChecks)+' current checks</small></div><div><strong>'+esc(item.staleSources?item.staleSources+' stale':item.dueSoonSources?item.dueSoonSources+' due soon':'')+'</strong></div></article>').join('')||'<div class="coverage-empty">No journey health data.</div>';
 $$('[data-source-sync]').forEach(button=>button.onclick=()=>openSourceSync(state.maintenanceItems[Number(button.dataset.sourceSync)]));
}
async function openMaintenance(){
 const dialog=$('#maintenanceDialog');dialog.showModal();
 $('#maintenanceSummary').innerHTML='<div class="coverage-loading">Building maintenance queue…</div>';$('#maintenanceQueue').innerHTML='';
 try{const r=await api('maintenance-queue');renderMaintenance(r.queue)}
 catch(error){$('#maintenanceSummary').innerHTML='<div class="coverage-error">'+esc(error.message)+'</div>'}
}
function renderLocaleCoverage(coverage){
 const summary=coverage.summary||{};
 $('#localeCoverageSummary').innerHTML=[
  ['Journeys',summary.journeys||0],
  ['Complete',summary.complete||0],
  ['Needs copy',summary.incomplete||0],
  ['Locales',summary.locales||0]
 ].map(item=>'<div><span>'+esc(item[0])+'</span><b>'+esc(item[1])+'</b></div>').join('');
 $('#localeCoverageJourneys').innerHTML=(coverage.journeys||[]).map(item=>
   '<article class="coverage-journey"><div><b>'+esc(item.title)+'</b><span>'+esc(item.completeLocales)+' / '+esc(item.totalLocales)+' locales'+(item.missing?.length?' · '+esc(item.missing.slice(0,6).join(', ')):'')+'</span></div><div class="coverage-bar"><i style="width:'+Math.max(0,Math.min(100,Number(item.coveragePct)||0))+'%"></i></div><strong>'+esc(item.coveragePct)+'%</strong></article>'
 ).join('');
}
async function openLocaleCoverage(){
 const dialog=$('#localeCoverageDialog');dialog.showModal();
 $('#localeCoverageSummary').innerHTML='<div class="coverage-loading">Checking localized public copy…</div>';$('#localeCoverageJourneys').innerHTML='';
 try{const r=await api('locale-coverage');renderLocaleCoverage(r.coverage)}
 catch(error){$('#localeCoverageSummary').innerHTML='<div class="coverage-error">'+esc(error.message)+'</div>'}
}

function openSourceSync(item){
 if(!item?.url)return;
 const form=$('#sourceSyncForm');form.reset();
 form.elements.url.value=item.url||'';
 form.elements.title.value=item.title||'';
 form.elements.issuer.value=item.issuer||'';
 form.elements.checkedAt.value=item.checkedAt||'';
 $('#sourceSyncImpact').textContent='This source is reused by '+(item.dependents||[]).filter(dep=>dep.kind==='journey').length+' published journey(s).';
 $('#sourceSyncDialog').showModal();
}

function renderLocalizationWorkspace(){
 const locales=state.catalog?.supportedLocales||['en'],grid=$('#localizationGrid');let complete=0;
 grid.innerHTML=locales.map(locale=>{
   const title=state.trip?.title?.[locale]||'',subtitle=state.catalogEntry?.subtitle?.[locale]||'',summary=state.trip?.summary?.[locale]||'';
   const ok=[title,subtitle,summary].every(value=>String(value).trim()&&!/^TODO\\b/i.test(String(value).trim()));if(ok)complete++;
   return '<section class="localization-card" data-locale="'+esc(locale)+'"><strong>'+esc(locale.toUpperCase())+(ok?' · complete':' · needs copy')+'</strong><label>Title<input name="title-'+esc(locale)+'" value="'+esc(title)+'"></label><label>Subtitle<input name="subtitle-'+esc(locale)+'" value="'+esc(subtitle)+'"></label><label>Summary<textarea name="summary-'+esc(locale)+'">'+esc(summary)+'</textarea></label></section>';
 }).join('');
 $('#localizationProgress').innerHTML='<span><b>'+complete+' / '+locales.length+'</b> locales complete</span><span>Publication still requires non-placeholder copy in every supported locale.</span>';
}
function openLocalization(){
 if(!state.trip)return;
 try{const draft=collect();state.trip=draft.trip;state.catalogEntry=draft.catalogEntry;renderLocalizationWorkspace();$('#localizationDialog').showModal()}catch(error){alert(error.message)}
}
function openSkeleton(){
 if(!state.trip)return;
 $('#skeletonMode').value=state.catalogEntry?.discovery?.modes?.[0]||'multimodal';
 $('#skeletonDialog').showModal();
}
function sourceIdForReuse(source){
 const existing=state.trip?.sources||[],sameUrl=existing.find(item=>item.url===source.url);
 if(sameUrl?.id)return sameUrl.id;
 let candidate=String(source.id||source.aliases?.[0]||'source').trim()||'source';
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate))candidate='source';
 const used=new Map(existing.map(item=>[item.id,item.url]));
 if(!used.has(candidate)||used.get(candidate)===source.url)return candidate;
 let n=2;while(used.has(candidate+'-'+n)&&used.get(candidate+'-'+n)!==source.url)n++;
 return candidate+'-'+n;
}
function applyLibrarySource(source){
 if(!source)return;
 $('#evidenceId').value=sourceIdForReuse(source);
 const form=$('#evidenceForm');
 form.elements.title.value=source.title||'';
 form.elements.issuer.value=source.issuer||'';
 form.elements.issuerType.value=source.issuerType||'';
 form.elements.url.value=source.url||'';
 form.elements.checkedAt.value=source.checkedAt||'';
 form.elements.claims.value=(source.claims||[]).join('\n');
}
async function openEvidence(){
 if(!state.trip)return;
 $('#evidenceForm').reset();
 $('#evidenceStatus').value='draft';
 $('#evidenceLibrary').innerHTML='<option value="">Loading known sources…</option>';
 $('#evidenceDialog').showModal();
 try{
   const r=await api('source-library');state.sourceLibrary=r.sources||[];
   const local=(state.trip.sources||[]).map(source=>({...source,reuseCount:1,journeys:[state.trip.id],aliases:[source.id],local:true}));
   const seen=new Set(),combined=[...local,...state.sourceLibrary].filter(source=>{const key=source.url||source.id;if(!key||seen.has(key))return false;seen.add(key);return true});
   $('#evidenceLibrary').innerHTML='<option value="">New source…</option>'+combined.map((source,index)=>'<option value="'+index+'">'+esc(source.issuer||source.title||source.id)+' · '+esc(source.title||source.url)+(source.reuseCount>1?' · '+source.reuseCount+' journeys':'')+(source.local?' · current draft':'')+'</option>').join('');
   $('#evidenceLibrary').onchange=event=>{if(event.target.value==='')return;const index=Number(event.target.value);if(Number.isInteger(index)&&combined[index])applyLibrarySource(combined[index])};
 }catch(error){
   $('#evidenceLibrary').innerHTML='<option value="">Source library unavailable · create new</option>';
 }
}
async function loadState(){const r=await api('state');state.catalog=r.catalog;state.drafts=r.drafts;state.archetypes=r.archetypes||[];renderDrafts();$('#cloneSelect').innerHTML=(r.catalog.trips||[]).filter(t=>t.renderer==='regional-globe').map(t=>'<option value="'+t.slug+'">'+esc(t.title?.en||t.slug)+'</option>').join('');const kind=$('#newKind');if(kind)kind.innerHTML=state.archetypes.map(value=>'<option value="'+esc(value)+'">'+esc(value.replaceAll('-',' '))+'</option>').join('')}
async function loadDraft(slug){const r=await api('draft/'+slug);state.slug=slug;state.trip=r.trip;state.catalogEntry=r.catalogEntry;$('#empty').classList.add('hidden');$('#editor').classList.remove('hidden');$('#heading').textContent=r.trip.title?.en||slug;$('#subheading').textContent=r.trip.kind+' · local draft';['previewBtn','saveBtn','validateBtn','publishBtn','skeletonBtn','evidenceBtn','localizationBtn'].forEach(id=>$('#'+id).disabled=false);$('#gate').className='gate';$('#gate').textContent='Not validated yet.';bind();await loadState()}
async function save(){const r=await api('draft/'+state.slug,{method:'PUT',body:JSON.stringify(collect())});state.trip=r.trip;state.catalogEntry=r.catalogEntry;gate(r);renderMetrics();await loadState();return r}
$('#newBtn').onclick=()=>$('#newDialog').showModal();$('#cloneBtn').onclick=()=>$('#cloneDialog').showModal();$('#mobileNewBtn').onclick=()=>$('#newDialog').showModal();$('#mobileCloneBtn').onclick=()=>$('#cloneDialog').showModal();$('#skeletonBtn').onclick=openSkeleton;$('#evidenceBtn').onclick=openEvidence;$('#localizationBtn').onclick=openLocalization;$('#coverageBtn').onclick=openCoverage;$('#mobileCoverageBtn').onclick=openCoverage;$('#localeCoverageBtn').onclick=openLocaleCoverage;$('#mobileLocaleCoverageBtn').onclick=openLocaleCoverage;$('#maintenanceBtn').onclick=openMaintenance;$('#mobileMaintenanceBtn').onclick=openMaintenance;$('#mobileDraftSelect').onchange=e=>{if(e.target.value)loadDraft(e.target.value)};$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#newForm').onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.currentTarget),r=await api('scaffold',{method:'POST',body:JSON.stringify({slug:f.get('slug'),kind:f.get('kind'),days:f.get('days')||null})});$('#newDialog').close();await loadState();await loadDraft(r.trip.slug)}catch(x){alert(x.message)}};
$('#cloneForm').onsubmit=async e=>{e.preventDefault();try{const form=new FormData(e.currentTarget),slug=String(form.get('slug')||''),mode=e.submitter?.value||'edit';let target=slug;if(mode==='new'){target=String(form.get('targetSlug')||'').trim();if(!target)throw new Error('New journey slug is required');await api('clone-as-new',{method:'POST',body:JSON.stringify({sourceSlug:slug,targetSlug:target})})}else await api('clone',{method:'POST',body:JSON.stringify({slug})});$('#cloneDialog').close();e.currentTarget.reset();await loadState();await loadDraft(target)}catch(x){alert(x.message)}};
$('#skeletonForm').onsubmit=async e=>{e.preventDefault();if(!state.slug)return;const hasGraph=(state.trip?.places||[]).length||(state.trip?.stops||[]).length||(state.trip?.segments||[]).length;if(hasGraph&&!confirm('Replace the current Places, Stops and Segments with this route skeleton? Existing sources are kept.'))return;try{await save();const form=new FormData(e.currentTarget),r=await api('draft/'+state.slug+'/skeleton',{method:'POST',body:JSON.stringify({text:form.get('text'),mode:form.get('mode')})});state.trip=r.trip;state.catalogEntry=r.catalogEntry;state.tab='places';$('#skeletonDialog').close();bind();gate(r);await loadState()}catch(x){alert(x.message)}};
$('#localizationForm').onsubmit=e=>{e.preventDefault();if(!state.trip)return;const form=new FormData(e.currentTarget),locales=state.catalog?.supportedLocales||['en'];state.trip.title=state.trip.title||{};state.trip.summary=state.trip.summary||{};state.catalogEntry.subtitle=state.catalogEntry.subtitle||{};for(const locale of locales){state.trip.title[locale]=String(form.get('title-'+locale)||'').trim();state.trip.summary[locale]=String(form.get('summary-'+locale)||'').trim();state.catalogEntry.subtitle[locale]=String(form.get('subtitle-'+locale)||'').trim()}state.catalogEntry.title=clone(state.trip.title);state.tab='localization';$('#localizationDialog').close();bind();$('#gate').className='gate';$('#gate').textContent='Localization changed. Validate again before publishing.';};
$('#evidenceForm').onsubmit=async e=>{e.preventDefault();if(!state.slug)return;try{await save();const form=new FormData(e.currentTarget),claims=String(form.get('claims')||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean),source={id:form.get('id'),title:form.get('title'),issuer:form.get('issuer'),issuerType:form.get('issuerType'),url:form.get('url'),checkedAt:form.get('checkedAt'),claims},r=await api('draft/'+state.slug+'/evidence',{method:'POST',body:JSON.stringify({source,segments:form.get('segments'),status:form.get('status'),notes:form.get('notes')})});state.trip=r.trip;state.catalogEntry=r.catalogEntry;state.tab='sources';$('#evidenceDialog').close();bind();gate(r);await loadState()}catch(x){alert(x.message)}};
$('#sourceSyncForm').onsubmit=async e=>{e.preventDefault();try{const form=new FormData(e.currentTarget),claims=String(form.get('claims')||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean),payload={url:form.get('url'),title:form.get('title'),issuer:form.get('issuer'),issuerType:form.get('issuerType'),checkedAt:form.get('checkedAt'),...(claims.length?{claims}:{})},r=await api('maintenance/source-sync',{method:'POST',body:JSON.stringify(payload)});$('#sourceSyncDialog').close();alert('Updated '+r.updatedJourneys.length+' published journey(s) and regenerated the trip index.');await openMaintenance()}catch(x){alert(x.message)}};
$$('[data-tab]').forEach(b=>b.onclick=()=>{try{syncSection();showTab(b.dataset.tab)}catch(x){alert(x.message)}});$('#formatBtn').onclick=()=>{try{$('#jsonEditor').value=JSON.stringify(readSection(),null,2)}catch(x){alert(x.message)}};$('#applyBtn').onclick=()=>{try{syncSection()}catch(x){alert(x.message)}};
$('#saveBtn').onclick=async()=>{try{await save()}catch(x){alert(x.message)}};$('#validateBtn').onclick=async()=>{try{await save();gate(await api('draft/'+state.slug+'/validate',{method:'POST'}))}catch(x){alert(x.message)}};
$('#previewBtn').onclick=async()=>{const preview=window.open('about:blank','owr-preview');try{await save();if(!preview)throw new Error('Preview window was blocked by the browser');preview.location='/?trip='+encodeURIComponent(state.slug)+'&lang=en&__draft='+encodeURIComponent(state.slug)}catch(x){preview?.close();alert(x.message)}};
$('#publishBtn').onclick=async()=>{if(!confirm('Publish this draft into the local public catalog after validation?'))return;try{await save();const r=await api('draft/'+state.slug+'/publish',{method:'POST'});gate({...r.validation,qualityChecks:r.qualityChecks||[]});if(r.published){alert('Published locally after the full quality gate. Review git diff and run the normal QA/commit/deploy workflow.');await loadDraft(state.slug);gate({...r.validation,qualityChecks:r.qualityChecks||[]})}}catch(x){alert(x.message)}};
loadState();
