(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const colors = {
    cyan:'#59ddff', blue:'#4f7cff', violet:'#9276ff', amber:'#ffbf5a', orange:'#ff7a45', red:'#ff4d67', green:'#65e5a7', muted:'#526277'
  };

  const PHASES = [
    {id:1, range:[1,29], name:'Europe I', short:'Europe I', color:'#59ddff'},
    {id:2, range:[30,39], name:'North & Central America', short:'N. America', color:'#4f7cff'},
    {id:3, range:[40,52], name:'Caribbean', short:'Caribbean', color:'#42e6c4'},
    {id:4, range:[53,64], name:'South America', short:'S. America', color:'#7be495'},
    {id:5, range:[65,78], name:'South Pacific', short:'Pacific', color:'#9276ff'},
    {id:6, range:[79,95], name:'Southeast Asia & Indian Ocean', short:'SE Asia', color:'#e47cff'},
    {id:7, range:[96,112], name:'East & Central Asia', short:'C. Asia', color:'#ffcf62'},
    {id:8, range:[113,120], name:'Levant & North Africa', short:'Levant', color:'#ff9b55'},
    {id:9, range:[121,145], name:'West & Central Africa', short:'W. Africa', color:'#ff704f'},
    {id:10, range:[146,169], name:'Southern & East Africa', short:'E. Africa', color:'#ff4d67'},
    {id:11, range:[170,181], name:'Gulf & Levant', short:'Gulf', color:'#ff8acb'},
    {id:12, range:[182,194], name:'Europe II · Finish', short:'Finish', color:'#79a7ff'}
  ];

  const COUNTRY_ALIASES = {
    'USA':'United States','St. Kitts und Nevis':'Saint Kitts and Nevis','St. Lucia':'Saint Lucia',
    'St. Vincent und die Grenadinen':'Saint Vincent and the Grenadines','Côte d’Ivoire':'Ivory Coast',
    'Cabo Verde':'Cape Verde','Äquatorialguinea':'Equatorial Guinea','Republik Kongo':'Republic of the Congo',
    'Demokratische Republik Kongo':'DR Congo','Südsudan':'South Sudan','Dschibuti':'Djibouti',
    'Staat Palästina':'Palestine','Nordmazedonien':'North Macedonia','Bosnien und Herzegowina':'Bosnia and Herzegovina',
    'Vatikanstadt':'Vatican City','Mikronesien':'Micronesia','Marshallinseln':'Marshall Islands',
    'Salomonen':'Solomon Islands','Südkorea':'South Korea','Nordkorea':'North Korea',
    'Vereinigte Arabische Emirate':'United Arab Emirates','Tschechien':'Czechia','Eswatini':'Eswatini',
    'Moldau':'Moldova','Osttimor':'Timor-Leste','Türkei':'Turkey'
  };

  const state = {
    raw:null, segments:[], countries:[], geo:[], geoIndex:new Map(), countryByCca3:new Map(), polygons:[], globe:null,
    selectedSegmentId:1, selectedCountry:null, layer:'route', phase:'all', mode:'explore', activeTab:'overview',
    filters:{mode:'all', tier:'all', feasibility:'all', alert:'all'},
    playing:false, playTimer:null, speed:700, criticalIds:new Set(),
    settings:{autoRotate:false, showPoints:true, routeGlow:true, arcWidth:.55, reducedMotion:false}
  };

  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
  const excelDate = v => {
    if (!v) return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v+'T00:00:00Z');
    if (typeof v === 'number') return new Date(Date.UTC(1899,11,30) + v*86400000);
    return null;
  };
  const fmtDate = v => { const d = v instanceof Date ? v : excelDate(v); return d ? new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d) : '—'; };
  const eur = v => Number.isFinite(Number(v)) ? new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v)) : '—';
  const phaseFor = id => PHASES.find(p => id >= p.range[0] && id <= p.range[1]) || PHASES[0];
  const daysFromStart = v => { const d=excelDate(v), s=new Date(Date.UTC(2026,9,21)); return d ? Math.max(1,Math.round((d-s)/86400000)+1) : null; };
  const statusColor = a => ({RED:colors.red,ORANGE:colors.orange,WATCH:colors.amber,GREEN:colors.green}[a] || colors.muted);
  const readinessColor = r => r === 'READY' ? colors.green : r === 'BLOCKED' ? colors.red : colors.amber;
  const sourceList = s => String(s||'').split(/\s*;\s*/).filter(x=>/^https?:/.test(x));
  const escapeHtml = s => String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const trim = (s,n=84) => String(s||'').length>n ? String(s).slice(0,n-1)+'…' : String(s||'');
  const flagAssetUrl = c => /^[a-z]{2}$/i.test(String(c?.cca2||'')) ? `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/${String(c.cca2).toLowerCase()}.svg` : '';
  const flagMarkup = (c,w=24,h=18) => { const u=flagAssetUrl(c); return u ? `<img src="${u}" alt="" width="${w}" height="${h}" style="display:block;object-fit:cover;box-shadow:0 0 0 1px rgba(255,255,255,.10)">` : ''; };

  function criticalScore(s){
    let x={A:30,B:20,C:10,D:5,E:4}[s.bookingTier]||5;
    if(s.feasibility==='Kritisch') x+=30; else if(s.feasibility==='Bedingt') x+=15;
    if(s.alertLevel==='RED') x+=35; else if(s.alertLevel==='ORANGE') x+=24; else if(s.alertLevel==='WATCH') x+=9;
    if(s.dataQuality && !/verifiziert/i.test(s.dataQuality)) x+=12;
    if(/Nauru|Tuvalu|Marshall|Mikronesien|Palau|Haiti|Syrien|Jemen|Sudan|Somalia/i.test(`${s.from} ${s.to}`)) x+=9;
    return x;
  }

  async function loadGeo(){
    try {
      const r = await fetch('./data/country-centroids.json', {cache:'force-cache'});
      if (!r.ok) throw new Error(r.status);
      const local = await r.json();
      if (Array.isArray(local) && local.length === 195) {
        return local.map(x => ({name:{common:x.name},translations:{deu:{common:x.name}},latlng:[x.lat,x.lng],cca2:x.cca2,cca3:x.cca3,region:x.region,subregion:x.subregion,flag:x.flag,altSpellings:[x.cca2,x.cca3]}));
      }
    } catch(e) { console.warn('Local centroid dataset failed', e); }
    const urls=[
      'https://restcountries.com/v3.1/all?fields=name,translations,latlng,cca3,region,subregion,flag,flags,altSpellings',
      'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'
    ];
    for(const url of urls){
      try{ const r=await fetch(url,{cache:'force-cache'}); if(!r.ok) throw new Error(r.status); const j=await r.json(); if(Array.isArray(j)&&j.length>180) return j; }catch(e){ console.warn('Geo source failed',url,e); }
    }
    throw new Error('No geographic reference source available');
  }

  function buildGeoIndex(geo){
    const index=new Map();
    geo.forEach(g=>{
      const names=[g.name?.common,g.name?.official,g.translations?.deu?.common,g.translations?.deu?.official,...(g.altSpellings||[])].filter(Boolean);
      names.forEach(n=>index.set(normalize(n),g));
    });
    state.geoIndex=index;
  }

  function findGeo(name){
    const alias=COUNTRY_ALIASES[name];
    return state.geoIndex.get(normalize(name)) || (alias && state.geoIndex.get(normalize(alias))) || null;
  }

  function enrich(){
    state.countries=state.raw.countries.map(c=>{
      const g=findGeo(c.name); const latlng=g?.latlng || [0,0];
      return {...c, lat:+latlng[0], lng:+latlng[1], flag:g?.flag||'', cca2:g?.cca2||'', cca3:g?.cca3||'', region:g?.region||'', subregion:g?.subregion||''};
    });
    const cMap=new Map(state.countries.map(c=>[c.name,c]));
    state.segments=state.raw.segments.map(s=>{
      const a=cMap.get(s.from), b=cMap.get(s.to), p=phaseFor(s.id);
      return {...s, phaseId:p.id, phaseName:p.name, phaseColor:p.color,
        startLat:a?.lat||0,startLng:a?.lng||0,endLat:b?.lat||0,endLng:b?.lng||0,
        criticalScore:criticalScore(s), departureDate:excelDate(s.planDeparture), arrivalDate:excelDate(s.planArrival)};
    });
    state.countryByCca3=new Map(state.countries.filter(c=>c.cca3).map(c=>[c.cca3,c]));
    state.criticalIds=new Set([...state.segments].sort((a,b)=>b.criticalScore-a.criticalScore).slice(0,20).map(s=>s.id));
  }

  function arcColor(s){
    if(state.layer==='status') return statusColor(s.alertLevel);
    if(state.layer==='visa'){
      if(/block/i.test(s.visaStatusTarget||'')) return colors.red;
      if(/pending/i.test(s.visaStatusTarget||'')) return colors.orange;
      if(/N\/A|Approved|Completed/i.test(s.visaStatusTarget||'')) return colors.green;
      return colors.amber;
    }
    if(state.layer==='health') return Number(s.healthPriorityTarget)>=4 ? colors.red : Number(s.healthPriorityTarget)>=2 ? colors.amber : colors.green;
    if(state.layer==='cost'){
      const v=Number(s.transportBudgetEur||0); return v>600?colors.red:v>350?colors.violet:v>150?colors.blue:colors.cyan;
    }
    if(state.layer==='risk') return s.feasibility==='Kritisch'?colors.red:s.feasibility==='Bedingt'?colors.orange:/verifiziert/i.test(s.dataQuality||'')?colors.green:colors.amber;
    if(state.layer==='progress') return colors.blue;
    if(state.layer==='critical') return state.criticalIds.has(s.id)?colors.red:'#273346';
    return s.phaseColor;
  }

  function visibleSegments(){
    return state.segments.filter(s=>{
      if(state.phase!=='all' && s.phaseId!==Number(state.phase)) return false;
      if(state.filters.mode!=='all' && s.mode!==state.filters.mode) return false;
      if(state.filters.tier!=='all' && s.bookingTier!==state.filters.tier) return false;
      if(state.filters.feasibility!=='all' && s.feasibility!==state.filters.feasibility) return false;
      if(state.filters.alert!=='all' && s.alertLevel!==state.filters.alert) return false;
      if(state.layer==='critical' && !state.criticalIds.has(s.id)) return false;
      return true;
    });
  }

  async function loadPolygons(){
    try{
      const r=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',{cache:'force-cache'});
      if(!r.ok) throw new Error(r.status);
      const g=await r.json(); return Array.isArray(g.features)?g.features:[];
    }catch(e){ console.warn('Country polygons unavailable; point interaction remains active.',e); return []; }
  }

  function initGlobe(){
    if(typeof window.Globe!=='function'){ $('#globeLoader').classList.add('hidden'); $('#globeFallback').classList.remove('hidden'); return; }
    const el=$('#globe');
    try{
      const globe = new Globe(el)
        .width(el.clientWidth).height(el.clientHeight)
        .backgroundColor('rgba(0,0,0,0)')
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .showAtmosphere(true).atmosphereColor('#4e8cff').atmosphereAltitude(.13)
        .showGraticules(false)
        .arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
        .arcAltitudeAutoScale(.28).arcCurveResolution(48)
        .arcLabel(s=>`<b>#${s.id} ${escapeHtml(s.from)} → ${escapeHtml(s.to)}</b><br><span style="color:#8ba0b8">${escapeHtml(s.mode)} · ${escapeHtml(s.phaseName)}</span>`)
        .onArcClick(s=>selectSegment(s.id,true))
        .pointLat('lat').pointLng('lng').pointAltitude(.011)
        .pointLabel(c=>`<div style="display:flex;align-items:center;gap:7px">${flagMarkup(c,22,16)}<div><b>${escapeHtml(c.name)}</b><br><span style="color:#8ba0b8">Country ${c.number}/195 · ${escapeHtml(c.readiness)}</span></div></div>`)
        .onPointClick(c=>selectCountry(c.name,true))
        .labelLat('lat').labelLng('lng').labelText('text').labelColor(()=> '#eafaff').labelSize(1.2).labelAltitude(.025)
        .ringLat('lat').ringLng('lng').ringColor(()=>[colors.cyan,'rgba(89,221,255,0)']).ringMaxRadius(2.8).ringPropagationSpeed(1.2).ringRepeatPeriod(900)
        .polygonGeoJsonGeometry(f=>f.geometry).polygonStrokeColor(()=> 'rgba(135,166,201,.18)')
        .polygonSideColor(()=> 'rgba(7,13,22,.12)').polygonLabel(f=>escapeHtml(f.properties?.name||''))
        .onPolygonClick(f=>{const c=state.countryByCca3.get(f.id); if(c)selectCountry(c.name,true)});
      state.globe=globe;
      const ctl=globe.controls(); ctl.autoRotate=state.settings.autoRotate; ctl.autoRotateSpeed=.28; ctl.enableDamping=true; ctl.dampingFactor=.08; ctl.minDistance=170; ctl.maxDistance=520;
      updateGlobe();
      loadPolygons().then(features=>{state.polygons=features;updateGlobe()});
      globe.pointOfView({lat:20,lng:12,altitude:2.25},0);
      setTimeout(()=>$('#globeLoader').classList.add('hidden'),550);
      window.addEventListener('resize',()=>globe.width(el.clientWidth).height(el.clientHeight));
    }catch(e){console.error(e); $('#globeLoader').classList.add('hidden'); $('#globeFallback').classList.remove('hidden');}
  }

  function updateGlobe(){
    if(!state.globe) return;
    const segs=visibleSegments(); const sel=state.segments.find(s=>s.id===state.selectedSegmentId);
    state.globe
      .arcsData(segs)
      .arcColor(s=>{
        const c=arcColor(s); return s.id===state.selectedSegmentId && state.settings.routeGlow ? [c,'#ffffff'] : c;
      })
      .arcStroke(s=>s.id===state.selectedSegmentId ? Math.max(1.05,state.settings.arcWidth*1.8) : state.settings.arcWidth)
      .arcDashLength(s => s.id === state.selectedSegmentId ? .65 : 1)
      .arcDashGap(s => s.id === state.selectedSegmentId ? .18 : 0)
      .arcDashAnimateTime(s=>s.id===state.selectedSegmentId && !state.settings.reducedMotion?1600:0)
      .pointsData(state.settings.showPoints ? state.countries : [])
      .pointRadius(c => c.name === state.selectedCountry?.name ? .22 : .075)
      .pointColor(c=>c.name===state.selectedCountry?.name?colors.cyan:(c.readiness==='BLOCKED'?colors.red:'rgba(188,215,239,.62)'))
      .labelsData(state.selectedCountry ? [{lat:state.selectedCountry.lat,lng:state.selectedCountry.lng,text:state.selectedCountry.name}] : sel ? [{lat:sel.endLat,lng:sel.endLng,text:sel.to}] : [])
      .ringsData(state.selectedCountry ? [state.selectedCountry] : sel ? [{lat:sel.endLat,lng:sel.endLng}] : [])
      .polygonsData(state.polygons)
      .polygonCapColor(f=>{
        const c=state.countryByCca3.get(f.id); if(!c)return 'rgba(16,23,36,.16)';
        if(state.selectedCountry?.cca3===f.id)return 'rgba(89,221,255,.34)';
        return c.readiness==='BLOCKED'?'rgba(255,77,103,.22)':'rgba(80,118,160,.18)';
      })
      .polygonAltitude(f=>state.selectedCountry?.cca3 === f.id ? .012 : .002);
    if(state.globe.controls()) state.globe.controls().autoRotate=state.settings.autoRotate && !state.playing;
    updateLegend(); updateFloatingStats(); $('#filterCount').textContent=`${segs.length} / 194`;
  }

  function focusSegment(s,duration=900){ if(state.globe) state.globe.pointOfView({lat:s.endLat,lng:s.endLng,altitude:1.65}, state.settings.reducedMotion?0:duration); }
  function focusCountry(c,duration=900){ if(state.globe) state.globe.pointOfView({lat:c.lat,lng:c.lng,altitude:1.45}, state.settings.reducedMotion?0:duration); }

  function selectSegment(id,focus=false){
    const s=state.segments.find(x=>x.id===Number(id)); if(!s)return;
    state.selectedSegmentId=s.id; state.selectedCountry=null; state.activeTab=state.mode==='operations'?'operations':'overview';
    $('#routeRange').value=s.id; updateRange(); updateGlobe(); renderDetail(); updateTimeline(); updateUrl(); if(focus)focusSegment(s);
  }
  function countryContextSegment(c){
    if(!c)return null;
    const incoming=state.segments.find(s=>s.to===c.name);
    const outgoing=state.segments.find(s=>s.from===c.name);
    if(c.name==='Deutschland') return state.selectedSegmentId>120 ? (incoming||outgoing) : (outgoing||incoming);
    return incoming||outgoing||null;
  }

  function selectCountry(name,focus=false){
    const c=state.countries.find(x=>x.name===name); if(!c)return;
    const context=countryContextSegment(c);
    if(context){
      state.selectedSegmentId=context.id;
      $('#routeRange').value=context.id;
      updateRange();
      updateTimeline();
      if(state.phase!=='all' && Number(state.phase)!==context.phaseId){state.phase=String(context.phaseId);renderChrome();}
    }
    state.selectedCountry=c;
    state.activeTab=state.mode==='operations'?'operations':'overview';
    updateGlobe(); renderDetail(); updateUrl(); if(focus)focusCountry(c);
  }

  function updateUrl(){
    const p=new URLSearchParams();
    if(state.selectedCountry) p.set('country',state.selectedCountry.name); else p.set('segment',state.selectedSegmentId);
    if(state.layer!=='route')p.set('layer',state.layer); if(state.phase!=='all')p.set('phase',state.phase); if(state.mode!=='explore')p.set('mode',state.mode);
    history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
  }
  function restoreUrl(){
    const p=new URLSearchParams(location.search); if(p.get('layer'))state.layer=p.get('layer'); if(p.get('phase'))state.phase=p.get('phase'); if(p.get('mode'))state.mode=p.get('mode');
    if(p.get('country')){
      state.selectedCountry=state.countries.find(c=>c.name===p.get('country'))||null;
      const context=countryContextSegment(state.selectedCountry);
      if(context){
        state.selectedSegmentId=context.id;
        if(state.phase!=='all' && Number(state.phase)!==context.phaseId)state.phase=String(context.phaseId);
      }
      state.activeTab=state.mode==='operations'?'operations':'overview';
    } else if(p.get('segment')) state.selectedSegmentId=Math.min(194,Math.max(1,Number(p.get('segment'))||1));
  }

  function renderChrome(){
    $('#topKpis').innerHTML=`<div class="kpi"><b>195</b><span>countries</span></div><div class="kpi"><b>379</b><span>planned days</span></div><div class="kpi"><b>194</b><span>executable</span></div><div class="kpi"><b>€90.6k</b><span>base model</span></div>`;
    $('#phaseRail').innerHTML=`<button data-phase="all" class="${state.phase==='all'?'active':''}">All route</button>`+PHASES.map(p=>`<button data-phase="${p.id}" class="${String(state.phase)===String(p.id)?'active':''}" title="${p.name}"><span class="phase-dot" style="background:${p.color}"></span>${String(p.id).padStart(2,'0')} ${p.short}</button>`).join('');
    $$('#phaseRail button').forEach(b=>b.onclick=()=>{state.phase=b.dataset.phase;renderChrome();updateGlobe();renderDetail();updateUrl();const p=PHASES.find(x=>String(x.id)===state.phase);if(p)selectSegment(p.range[0],true)});
    $$('#layerGrid button').forEach(b=>b.classList.toggle('active',b.dataset.layer===state.layer));
    $$('.mode-switch button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));
  }

  function fillFilters(){
    const modes=[...new Set(state.segments.map(s=>s.mode))].sort(); $('#modeFilter').innerHTML='<option value="all">All modes</option>'+modes.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
    const feas=[...new Set(state.segments.map(s=>s.feasibility))].filter(Boolean).sort(); $('#feasibilityFilter').innerHTML='<option value="all">All</option>'+feas.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
  }

  function badge(label,color){return `<span class="status-badge" style="color:${color}">${escapeHtml(label||'Unknown')}</span>`}
  function dataCard(label,value,sub=''){return `<div class="data-card"><span>${escapeHtml(label)}</span><b>${escapeHtml(value??'—')}</b>${sub?`<small class="route-sub">${escapeHtml(sub)}</small>`:''}</div>`}
  function relatedSegments(country){return state.segments.filter(s=>s.from===country.name||s.to===country.name)}

  function renderDetail(){
    const tabBtns=$$('#detailTabs button'); tabBtns.forEach(b=>b.classList.toggle('active',b.dataset.tab===state.activeTab));
    const box=$('#detailContent');
    if(state.selectedCountry){ renderCountryDetail(box,state.selectedCountry); return; }
    const s=state.segments.find(x=>x.id===state.selectedSegmentId);
    if(s){ renderSegmentDetail(box,s); return; }
    renderProjectOverview(box);
  }

  function renderSegmentDetail(box,s){
    $('#detailEyebrow').textContent=`SEGMENT ${s.id} · ${s.phaseName}`; $('#detailTitle').textContent=`${s.from} → ${s.to}`;
    if(state.activeTab==='overview'){
      box.innerHTML=`<div class="overview-number">${String(s.id).padStart(2,'0')}<small>/194</small></div><p class="detail-copy">${escapeHtml(s.corridor||'')}</p>
      <div class="data-grid">${dataCard('Departure',fmtDate(s.planDeparture),`Day ${daysFromStart(s.planDeparture)||'—'}`)}${dataCard('Transport',s.mode)}${dataCard('Phase',s.phaseName)}${dataCard('Plan budget',eur(s.transportBudgetEur))}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${badge(s.alertLevel,statusColor(s.alertLevel))}${badge(s.feasibility,s.feasibility==='Kritisch'?colors.red:s.feasibility==='Bedingt'?colors.orange:colors.green)}</div>
      <div class="op-callout"><b>Why this route?</b><br>${escapeHtml(s.planB ? `Primary corridor: ${s.corridor}. A documented fallback exists and is shown under Operations.` : `This is the current operational corridor in the public master plan.`)}</div>`;
    } else if(state.activeTab==='details'){
      box.innerHTML=`<div class="data-grid">${dataCard('From',s.from)}${dataCard('To',s.to)}${dataCard('Plan depart',fmtDate(s.planDeparture))}${dataCard('Plan arrive',fmtDate(s.planArrival))}${dataCard('Booking tier',s.bookingTier||'—')}${dataCard('Data quality',s.dataQuality||'—')}${dataCard('Plan status',s.planStatus||'—')}${dataCard('Budget',eur(s.transportBudgetEur))}</div><h3>Corridor</h3><p class="detail-copy">${escapeHtml(s.corridor||'—')}</p>`;
    } else if(state.activeTab==='operations'){
      box.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${badge(s.alertLevel,statusColor(s.alertLevel))}${badge(`Tier ${s.bookingTier||'—'}`,colors.blue)}${state.criticalIds.has(s.id)?badge('Critical path',colors.red):''}</div>
      <div class="data-grid">${dataCard('Visa target',s.visaTypeTarget||'—',s.visaStatusTarget||'')}${dataCard('Health',`Priority ${s.healthPriorityTarget??'—'}`,s.healthStatusTarget||'')}${dataCard('Verified',fmtDate(s.lastVerified))}${dataCard('Criticality',`${s.criticalScore}/100-ish`)}</div>
      ${s.alertMessage?`<div class="op-callout">${escapeHtml(s.alertMessage)}</div>`:''}<h3>Plan B</h3><p class="detail-copy">${escapeHtml(s.planB||'No specific fallback recorded; use surrounding hub/next published service logic.')}</p>`;
    } else {
      const links=sourceList(s.source); box.innerHTML=links.length?`<p class="detail-copy">Source links attached to this segment. “Verified” refers to the planning snapshot date, not a guarantee that conditions remain unchanged.</p>${links.map((u,i)=>`<a class="source-link" target="_blank" rel="noopener" href="${escapeHtml(u)}">Source ${i+1} · ${escapeHtml(trim(u,62))}</a>`).join('')}`:`<p class="detail-copy">No public source URL is attached to this segment in the current snapshot.</p>`;
    }
  }

  function renderCountryDetail(box,c){
    $('#detailEyebrow').textContent=`COUNTRY ${c.number} · ${c.region||'WORLD'}`; $('#detailTitle').innerHTML=`<span style="display:inline-flex;align-items:center;gap:9px">${flagMarkup(c,24,18)}<span>${escapeHtml(c.name)}</span></span>`;
    const rel=relatedSegments(c); const incoming=rel.find(s=>s.to===c.name), outgoing=rel.find(s=>s.from===c.name);
    if(state.activeTab==='overview'){
      box.innerHTML=`<div class="overview-number">${c.number}<small>/195</small></div><p class="detail-copy">Planned entry ${fmtDate(c.planEntry)} · ${escapeHtml(c.subregion||c.region||'')}</p><div class="data-grid">${dataCard('Readiness',c.readiness)}${dataCard('Visa',c.visaType||'—',c.visaStatus||'')}${dataCard('Health',`Priority ${c.healthPriority??'—'}`,c.healthStatus||'')}${dataCard('Planned entry',fmtDate(c.planEntry))}</div><div style="display:flex;gap:6px">${badge(c.readiness,readinessColor(c.readiness))}</div>${incoming?`<h3>Arrival</h3><div class="route-row" data-segment="${incoming.id}"><span class="route-id">#${incoming.id}</span><div><div class="route-name">${incoming.from} → ${incoming.to}</div><div class="route-sub">${incoming.mode} · ${fmtDate(incoming.planDeparture)}</div></div><span>›</span></div>`:''}${outgoing?`<h3>Next</h3><div class="route-row" data-segment="${outgoing.id}"><span class="route-id">#${outgoing.id}</span><div><div class="route-name">${outgoing.from} → ${outgoing.to}</div><div class="route-sub">${outgoing.mode} · ${fmtDate(outgoing.planDeparture)}</div></div><span>›</span></div>`:''}`;
    } else if(state.activeTab==='details'){
      box.innerHTML=`<h3>Entry planning</h3><p class="detail-copy">${escapeHtml(c.visaAction||'No public action recorded.')}</p><div class="data-grid">${dataCard('Visa priority',c.visaPriority??'—')}${dataCard('Health priority',c.healthPriority??'—')}${dataCard('Entry docs',c.entryDocs||'—')}${dataCard('Visited',c.visited||'No')}</div>${c.entryConflict?`<div class="op-callout">${escapeHtml(c.entryConflict)}</div>`:''}`;
    } else if(state.activeTab==='operations'){
      box.innerHTML=`<div class="data-grid">${dataCard('Readiness',c.readiness)}${dataCard('Visa status',c.visaStatus||'—')}${dataCard('Health status',c.healthStatus||'—')}${dataCard('Region',c.subregion||c.region||'—')}</div><h3>Health note</h3><p class="detail-copy">${escapeHtml(c.healthNote||'No special public route note.')}</p><h3>Related route</h3><div class="route-list">${rel.map(s=>`<div class="route-row" data-segment="${s.id}"><span class="route-id">#${s.id}</span><div><div class="route-name">${s.from} → ${s.to}</div><div class="route-sub">${s.mode} · ${s.alertLevel}</div></div><span>›</span></div>`).join('')}</div>`;
    } else {
      const urls=[...new Set(rel.flatMap(s=>sourceList(s.source)))]; box.innerHTML=urls.length?urls.map((u,i)=>`<a class="source-link" target="_blank" rel="noopener" href="${escapeHtml(u)}">Related source ${i+1} · ${escapeHtml(trim(u,62))}</a>`).join(''):`<p class="detail-copy">No related public URLs in this snapshot.</p>`;
    }
    $$('[data-segment]',box).forEach(x=>x.onclick=()=>selectSegment(Number(x.dataset.segment),true));
  }

  function renderProjectOverview(box){
    $('#detailEyebrow').textContent='PROJECT OVERVIEW'; $('#detailTitle').textContent='The route at a glance';
    const segs=visibleSegments();
    box.innerHTML=`<div class="overview-number">195<small> countries</small></div><p class="detail-copy">One continuous, data-driven route. The globe is the interface: select a route line or country to inspect the plan.</p><div class="data-grid">${dataCard('Route legs','194')}${dataCard('Planned days','379')}${dataCard('Base model','€90.6k')}${dataCard('Executable now','194 / 195')}</div><h3>Visible route</h3><div class="route-list">${segs.slice(0,14).map(s=>`<div class="route-row" data-segment="${s.id}"><span class="route-id">#${s.id}</span><div><div class="route-name">${s.from} → ${s.to}</div><div class="route-sub">${s.mode} · ${s.phaseName}</div></div><span>›</span></div>`).join('')}</div>`;
    $$('[data-segment]',box).forEach(x=>x.onclick=()=>selectSegment(Number(x.dataset.segment),true));
  }

  function updateLegend(){
    const sets={
      route:PHASES.slice(0,6).map(p=>[p.short,p.color]),status:[['Ready / green',colors.green],['Watch',colors.amber],['Action',colors.orange],['Blocked',colors.red]],
      visa:[['Clear / approved',colors.green],['Pending',colors.orange],['Review',colors.amber],['Blocked',colors.red]],health:[['Low',colors.green],['Medium',colors.amber],['High',colors.red]],
      cost:[['< €150',colors.cyan],['€150–350',colors.blue],['€350–600',colors.violet],['> €600',colors.red]],risk:[['Planbar / verified',colors.green],['Review',colors.amber],['Conditional',colors.orange],['Critical',colors.red]],
      progress:[['Planned',colors.blue],['Visited',colors.green]],critical:[['Top 20 constraint',colors.red],['Other hidden',colors.muted]]
    };
    $('#legend').innerHTML=(sets[state.layer]||sets.route).map(([l,c])=>`<div class="legend-item" style="color:${c}"><i class="legend-dot"></i><span style="color:var(--muted)">${l}</span></div>`).join('');
  }

  function updateFloatingStats(){
    const segs=visibleSegments(), budget=segs.reduce((a,s)=>a+Number(s.transportBudgetEur||0),0), crit=segs.filter(s=>state.criticalIds.has(s.id)).length;
    $('#floatingStats').innerHTML=`<div class="float-card"><b>${segs.length}</b><span>visible legs</span></div><div class="float-card"><b>${eur(budget)}</b><span>transport model</span></div><div class="float-card"><b>${crit}</b><span>critical</span></div>`;
  }

  function updateTimeline(){
    const s=state.segments.find(x=>x.id===state.selectedSegmentId)||state.segments[0]; if(!s)return;
    $('#timelineTitle').textContent=`${s.from} → ${s.to}`; $('#timelineMeta').textContent=`Segment ${s.id} · Day ${daysFromStart(s.planDeparture)||'—'} · ${s.mode}`;
  }
  function updateRange(){const r=$('#routeRange'),p=((Number(r.value)-1)/193)*100;r.style.setProperty('--range-progress',`${p}%`);}

  function search(q){
    q=normalize(q); if(!q)return[];
    const cs=state.countries.filter(c=>normalize(`${c.name} ${c.region} ${c.subregion} ${c.visaType}`).includes(q)).slice(0,8).map(c=>({type:'country',title:c.name,sub:`Country ${c.number} · ${c.readiness}`,obj:c}));
    const ss=state.segments.filter(s=>normalize(`${s.from} ${s.to} ${s.mode} ${s.corridor} ${s.phaseName} ${s.alertLevel}`).includes(q)).slice(0,10).map(s=>({type:'segment',title:`${s.from} → ${s.to}`,sub:`#${s.id} · ${s.mode} · ${s.phaseName}`,obj:s}));
    return [...cs,...ss].slice(0,14);
  }
  function showInlineResults(q){
    const hits=search(q),box=$('#searchResults'); if(!q||!hits.length){box.classList.add('hidden');return} box.classList.remove('hidden');
    box.innerHTML=hits.slice(0,7).map((h,i)=>`<div class="search-hit" data-i="${i}">${escapeHtml(h.title)}<small>${escapeHtml(h.sub)}</small></div>`).join('');
    $$('.search-hit',box).forEach(x=>x.onclick=()=>activateHit(hits[Number(x.dataset.i)]));
  }
  function activateHit(h){ if(!h)return; $('#searchResults').classList.add('hidden'); $('#commandPalette').classList.add('hidden'); if(h.type==='country')selectCountry(h.obj.name,true);else selectSegment(h.obj.id,true); }
  function renderCommand(q=''){
    const hits=q?search(q):state.segments.slice(0,8).map(s=>({type:'segment',title:`${s.from} → ${s.to}`,sub:`#${s.id} · ${s.phaseName}`,obj:s}));
    $('#commandResults').innerHTML=`<div class="command-group">${q?'Search results':'Jump to route'}</div>${hits.map((h,i)=>`<div class="command-item" data-i="${i}"><b>${escapeHtml(h.title)}</b><span>${escapeHtml(h.sub)}</span></div>`).join('')}`;
    $$('.command-item','#commandResults').forEach(x=>x.onclick=()=>activateHit(hits[Number(x.dataset.i)]));
  }
  function openCommand(){const m=$('#commandPalette');m.classList.remove('hidden');$('#commandInput').value='';renderCommand();setTimeout(()=>$('#commandInput').focus(),30)}

  function play(){
    if(state.playing){stopPlay();return} state.playing=true;$('#playBtn').textContent='Ⅱ'; if(state.globe?.controls())state.globe.controls().autoRotate=false;
    const tick=()=>{if(!state.playing)return;let n=state.selectedSegmentId+1;if(n>194)n=1;selectSegment(n,true);state.playTimer=setTimeout(tick,state.speed)}; state.playTimer=setTimeout(tick,200);
  }
  function stopPlay(){state.playing=false;clearTimeout(state.playTimer);$('#playBtn').textContent='▶';if(state.globe?.controls())state.globe.controls().autoRotate=state.settings.autoRotate}

  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),2200)}

  function bindUI(){
    $$('.mode-switch button').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;if(state.mode==='operations'){state.layer='status';state.activeTab='operations'}else{state.layer='route';state.activeTab='overview'}renderChrome();updateGlobe();renderDetail();updateUrl()});
    $$('#layerGrid button').forEach(b=>b.onclick=()=>{state.layer=b.dataset.layer;renderChrome();updateGlobe();renderDetail();updateUrl()});
    ['mode','tier','feasibility','alert'].forEach(k=>{$(`#${k}Filter`).onchange=e=>{state.filters[k]=e.target.value;updateGlobe();renderDetail()}});
    $('#clearFilters').onclick=()=>{state.filters={mode:'all',tier:'all',feasibility:'all',alert:'all'};['mode','tier','feasibility','alert'].forEach(k=>$(`#${k}Filter`).value='all');state.phase='all';renderChrome();updateGlobe();renderDetail();updateUrl()};
    $('#inlineSearch').oninput=e=>showInlineResults(e.target.value); $('#searchBtn').onclick=openCommand; $('#commandInput').oninput=e=>renderCommand(e.target.value);
    $('#routeRange').oninput=e=>{selectSegment(Number(e.target.value),false);updateRange()}; $('#playBtn').onclick=play;
    $$('.speed-control button').forEach(b=>b.onclick=()=>{$$('.speed-control button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.speed=Number(b.dataset.speed)});
    $$('#detailTabs button').forEach(b=>b.onclick=()=>{state.activeTab=b.dataset.tab;renderDetail()});
    $('#brandBtn').onclick=()=>{state.selectedCountry=null;state.selectedSegmentId=1;state.phase='all';state.layer='route';renderChrome();selectSegment(1,true)};
    $('#infoBtn').onclick=()=>$('#infoModal').classList.remove('hidden'); $$('.modal-close').forEach(x=>x.onclick=()=>x.closest('.modal').classList.add('hidden')); $('#infoModal').onclick=e=>{if(e.target.id==='infoModal')e.currentTarget.classList.add('hidden')};
    $('#settingsBtn').onclick=()=>$('#settingsPopover').classList.toggle('hidden');
    $('#autoRotate').onchange=e=>{state.settings.autoRotate=e.target.checked;updateGlobe()}; $('#showPoints').onchange=e=>{state.settings.showPoints=e.target.checked;updateGlobe()}; $('#routeGlow').onchange=e=>{state.settings.routeGlow=e.target.checked;updateGlobe()}; $('#arcWidth').oninput=e=>{state.settings.arcWidth=Number(e.target.value);updateGlobe()}; $('#reducedMotion').onchange=e=>state.settings.reducedMotion=e.target.checked;
    $('#shareBtn').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Share link copied')}catch{toast('Copy the URL from your browser')}};
    $('#mobileFilters').onclick=()=>$('#leftPanel').classList.toggle('mobile-open'); $('#mobileDetails').onclick=()=>$('#rightPanel').classList.toggle('mobile-open'); $('#closeDetails').onclick=()=>$('#rightPanel').classList.remove('mobile-open');
    document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommand()}else if(e.key==='Escape'){$('#commandPalette').classList.add('hidden');$('#infoModal').classList.add('hidden');$('#settingsPopover').classList.add('hidden')}else if(e.code==='Space'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();play()}else if(e.key==='ArrowRight')selectSegment(Math.min(194,state.selectedSegmentId+1),true);else if(e.key==='ArrowLeft')selectSegment(Math.max(1,state.selectedSegmentId-1),true)});
  }

  window.__ONE_WORLD_ROUTE_APP__={
    selectSegment:(id,focus=true)=>selectSegment(Number(id),Boolean(focus)),
    selectCountry:(name,focus=true)=>selectCountry(String(name),Boolean(focus)),
    getState:()=>({selectedSegmentId:state.selectedSegmentId,selectedCountry:state.selectedCountry?.name||null,layer:state.layer,phase:state.phase,mode:state.mode,filters:{...state.filters},settings:{...state.settings},playing:state.playing,speed:state.speed})
  };

  async function init(){
    try{
      const [raw,geo]=await Promise.all([fetch('./data/public-route.json').then(r=>{if(!r.ok)throw new Error('public data');return r.json()}),loadGeo()]);
      state.raw=raw; state.geo=geo; buildGeoIndex(geo); enrich(); restoreUrl(); fillFilters(); bindUI(); renderChrome(); updateRange(); updateTimeline(); renderDetail(); initGlobe();
      if(state.selectedCountry)focusCountry(state.selectedCountry,0);else{const s=state.segments.find(x=>x.id===state.selectedSegmentId);if(s&&state.selectedSegmentId!==1)focusSegment(s,0)}
      const missing=state.countries.filter(c=>!c.lat&&!c.lng).map(c=>c.name); if(missing.length)console.warn('Countries without coordinates',missing);
    }catch(e){console.error(e);$('#globeLoader').classList.add('hidden');$('#globeFallback').classList.remove('hidden');$('#globeFallback').textContent='Public route data could not be loaded. Run this site through a local/static web server rather than opening index.html directly.';}
  }

  window.addEventListener('DOMContentLoaded',init);
})();