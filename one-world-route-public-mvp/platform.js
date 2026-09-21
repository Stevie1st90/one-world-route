(() => {
  'use strict';

  const CATALOG_URL = './data/platform/trips.json';
  const PROFILE_KEY = 'one-world-route:traveller-context:v1';
  const PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const LocaleData=PLATFORM_MODULES.i18n;
  const Model=PLATFORM_MODULES.model;
  const Traveller=PLATFORM_MODULES.traveller;
  const Discovery=PLATFORM_MODULES.discovery;
  const Extensions=PLATFORM_MODULES.extensions;
  if(!LocaleData||!Model||!Traveller||!Discovery||!Extensions)throw new Error('ONE WORLD ROUTE platform modules unavailable');
  const SUPPORTED_LOCALES=LocaleData.supportedLocales;
  const I18N=LocaleData.messages;
  const LEGACY_WORLD_TEXT=LocaleData.legacyWorldText;
  const LEGACY_PHASES=LocaleData.legacyPhases;
  const LEGACY_EXTRA=LocaleData.legacyExtra;
  const LEGACY_SHORT=LocaleData.legacyShort;
  let legacyLocaleObserver=null,legacyLocaleScheduled=false;
  function legacyTranslate(raw){
    const text=String(raw||'').trim();
    if(!text||locale==='en')return text;
    const dict={...(LEGACY_WORLD_TEXT[locale]||{}),...(LEGACY_EXTRA[locale]||{}),...(LEGACY_SHORT[locale]||{})};
    if(dict[text])return dict[text];
    const exactKey=Object.keys(dict).find(k=>k.toLocaleLowerCase('en')===text.toLocaleLowerCase('en'));
    if(exactKey)return dict[exactKey];
    if(LEGACY_PHASES[locale]?.[text])return LEGACY_PHASES[locale][text];
    let m=text.match(/^(\d{2})\s+(.+)$/);
    if(m&&LEGACY_PHASES[locale]?.[m[2]])return `${m[1]} ${LEGACY_PHASES[locale][m[2]]}`;
    m=text.match(/^CHAPTER\s+(\d+)\s*\/\s*(\d+)$/i);
    if(m)return `${locale==='de'?'KAPITEL':locale==='it'?'CAPITOLO':locale==='es'?'CAPÍTULO':locale==='fr'?'CHAPITRE':locale==='pt'?'CAPÍTULO':'CHAPTER'} ${m[1]} / ${m[2]}`;
    m=text.match(/^Country\s+(\d+)\s*\/\s*195$/i);
    if(m)return `${t('country')} ${m[1]}/195`;
    m=text.match(/^Country\s+(\d+)\s*·\s*(.+)$/i);
    if(m)return `${t('country')} ${m[1]} · ${legacyTranslate(m[2])}`;
    m=text.match(/^Day\s+(\d+)$/i);
    if(m)return `${t('day')} ${m[1]}`;
    m=text.match(/^Segment\s+(\d+)\s*·\s*Day\s+([^·]+)\s*·\s*(.+)$/i);
    if(m)return `${t('segment')} ${m[1]} · ${t('day')} ${m[2].trim()} · ${m[3]}`;
    m=text.match(/^Segment\s+(\d+)\s*\/\s*(\d+)$/i);
    if(m)return `${t('segment')} ${m[1]} / ${m[2]}`;
    return text;
  }

  function localizeLegacyNode(root=document){
    if(locale==='en'||document.body.classList.contains('platform-regional-trip'))return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const raw=node.nodeValue,trimmed=String(raw||'').trim();if(!trimmed)continue;
      const translated=legacyTranslate(trimmed);
      if(translated!==trimmed)node.nodeValue=raw.replace(trimmed,translated);
    }
    for(const el of root.querySelectorAll?.('[placeholder],[title],[aria-label]')||[]){
      for(const attr of ['placeholder','title','aria-label']){
        const raw=el.getAttribute(attr);if(!raw)continue;
        const translated=legacyTranslate(raw);if(translated!==raw)el.setAttribute(attr,translated);
      }
    }
  }

  function activateLegacyLocalization(){
    document.documentElement.lang=locale;
    localizeLegacyNode(document.body);
    if(legacyLocaleObserver)legacyLocaleObserver.disconnect();
    legacyLocaleObserver=new MutationObserver(mutations=>{
      if(legacyLocaleScheduled||document.body.classList.contains('platform-regional-trip'))return;
      legacyLocaleScheduled=true;
      requestAnimationFrame(()=>{
        legacyLocaleScheduled=false;
        for(const mutation of mutations){
          for(const node of mutation.addedNodes){
            if(node.nodeType===Node.ELEMENT_NODE)localizeLegacyNode(node);
            else if(node.nodeType===Node.TEXT_NODE&&node.parentElement)localizeLegacyNode(node.parentElement);
          }
          if(mutation.type==='characterData'&&mutation.target.parentElement)localizeLegacyNode(mutation.target.parentElement);
        }
      });
    });
    legacyLocaleObserver.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  }

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const initialLocale = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    const b = String(q || navigator.language || 'en').toLowerCase().split('-')[0];
    return SUPPORTED_LOCALES.includes(b) ? b : 'en';
  })();
  let locale = initialLocale;
  const t = key => I18N[locale]?.[key] || I18N.en[key] || key;
  const local = value => typeof value === 'string' ? value : value?.[locale] || value?.en || Object.values(value || {})[0] || '';
  const facetLabel = value => {
    const key='facet_'+String(value||'').replaceAll('-','_');
    const translated=t(key);
    return translated===key?String(value||'').replaceAll('-',' '):translated;
  };
  const countryDisplay = code => {
    if(!code)return '—';
    try{return new Intl.DisplayNames([locale],{type:'region'}).of(String(code).toUpperCase())||String(code)}
    catch{return String(code)}
  };
  const statusLabel = trip => {
    if(trip.id===catalog?.defaultTripId)return t('flagship');
    const key='status_'+String(trip.status||'draft').replaceAll('-','_');
    const translated=t(key);
    return translated===key?facetLabel(trip.status||'draft'):translated;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const money = (v,c='EUR',digits=0) => Number.isFinite(Number(v)) ? new Intl.NumberFormat(locale,{style:'currency',currency:c,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(v)) : '—';
  const durationLabel = p => {
    if(Number.isFinite(Number(p?.durationMinutes))) return Number(p.durationMinutes)+' min';
    if(Array.isArray(p?.durationRangeMinutes)&&p.durationRangeMinutes.length===2) return p.durationRangeMinutes[0]+'–'+p.durationRangeMinutes[1]+' min';
    if(Number.isFinite(Number(p?.minimumInVehicleMinutes))) return '≥ '+Number(p.minimumInVehicleMinutes)+' min';
    return '—';
  };
  const costLabel = p => {
    const cost=p?.cost;if(cost?.amount==null)return '—';
    const prefix=/from|floor|known-stage/.test(String(cost.basis||''))?t('publishedFrom')+' ':'';
    return prefix+money(cost.amount,cost.currency||currentTrip?.planning?.currency||'EUR',Number(cost.amount)%1?2:0);
  };
  const EDITORIAL_NOTES={
    'This is one source-backed direct operator option, not a claim that no faster option exists on another operator/date.':{
      de:'Dies ist eine quellenbasierte direkte Betreiberoption; daraus folgt nicht, dass an einem anderen Datum oder bei einem anderen Anbieter keine schnellere Verbindung existiert.',
      it:'Questa è una delle opzioni dirette supportate da fonti; non significa che in un’altra data o con un altro operatore non esista un collegamento più rapido.',
      es:'Esta es una opción directa respaldada por fuentes; no implica que no exista una conexión más rápida con otro operador o en otra fecha.',
      fr:'Il s’agit d’une option directe étayée par des sources ; cela ne signifie pas qu’aucune liaison plus rapide n’existe avec un autre opérateur ou à une autre date.',
      pt:'Esta é uma opção direta sustentada por fontes; não significa que não exista uma ligação mais rápida com outro operador ou noutra data.'
    },
    'Endpoint cruise facilities are source-backed. No specific ship service or sailing time is asserted.':{
      de:'Die Kreuzfahrtanlagen an beiden Endpunkten sind quellenbasiert. Es wird keine konkrete Schiffsverbindung oder Abfahrtszeit behauptet.',
      it:'Le strutture crocieristiche ai due estremi sono supportate da fonti. Non viene indicato uno specifico servizio navale né un orario di partenza.',
      es:'Las instalaciones de crucero en ambos extremos están respaldadas por fuentes. No se afirma ningún servicio de barco ni horario de salida concreto.',
      fr:'Les installations de croisière aux deux extrémités sont étayées par des sources. Aucun service de navire ni horaire de départ précis n’est affirmé.',
      pt:'As instalações de cruzeiro nos dois extremos são sustentadas por fontes. Não é indicado qualquer serviço de navio ou horário de partida específico.'
    },
    'This leg leaves the Schengen area. Endpoint ports are source-backed; the sailing itself is illustrative.':{
      de:'Dieses Segment verlässt den Schengen-Raum. Die Häfen an beiden Endpunkten sind quellenbasiert; die konkrete Seeverbindung ist illustrativ.',
      it:'Questa tratta esce dall’area Schengen. I porti alle estremità sono supportati da fonti; la traversata è illustrativa.',
      es:'Este tramo sale del espacio Schengen. Los puertos de ambos extremos están respaldados por fuentes; la travesía es ilustrativa.',
      fr:'Cette étape quitte l’espace Schengen. Les ports aux deux extrémités sont étayés par des sources ; la traversée reste illustrative.',
      pt:'Este trecho sai do espaço Schengen. Os portos nos dois extremos são sustentados por fontes; a travessia é ilustrativa.'
    },
    'Includes one modelled sea day. This leg re-enters the Schengen area; actual immigration handling depends on the traveller and selected sailing.':{
      de:'Enthält einen modellierten Seetag. Dieses Segment führt zurück in den Schengen-Raum; die tatsächliche Einreiseabwicklung hängt vom Reisenden und der gewählten Abfahrt ab.',
      it:'Include un giorno di navigazione modellato. Questa tratta rientra nell’area Schengen; le formalità effettive dipendono dal viaggiatore e dalla partenza selezionata.',
      es:'Incluye un día de navegación modelado. Este tramo vuelve a entrar en el espacio Schengen; las formalidades reales dependen del viajero y de la salida elegida.',
      fr:'Comprend une journée en mer modélisée. Cette étape revient dans l’espace Schengen ; les formalités réelles dépendent du voyageur et du départ choisi.',
      pt:'Inclui um dia de navegação modelado. Este trecho volta a entrar no espaço Schengen; as formalidades reais dependem do viajante e da partida escolhida.'
    }
  };
  const editorialNote = value => {
    if(value==null)return '';
    if(typeof value==='object')return local(value);
    if(locale==='en')return String(value);
    return EDITORIAL_NOTES[String(value)]?.[locale]||String(value);
  };

  function setRegionalDetailMode(mode){
    for(const key of ['overview','stop','segment'])document.body.classList.toggle('platform-detail-'+key,key===mode);
    const panel=$('#rightPanel');if(panel)panel.scrollTop=0;
  }

  const sourceMap = () => Model.sourceMap(currentTrip);
  const verificationLabel = s => s?.verification?.status==='verified'?t('verified'):(s?.verification?.status==='illustrative'?t('illustrative'):t('currentCheck'));
  const sourceLinks = ids => {
    const map=sourceMap(),seen=new Set();
    return (ids||[]).filter(id=>!seen.has(id)&&seen.add(id)).map(id=>map.get(id)).filter(Boolean).map(src=>`<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(src.issuer||src.title)}</b><span>${esc(src.title)}</span><small>${esc(t('lastChecked'))}: ${esc(src.checkedAt||'—')}</small></a>`).join('');
  };

  let catalog = null;
  let currentTrip = null;
  let currentTripMeta = null;
  let selectedSegmentIndex = 0;
  let playTimer = null;
  let countries = [];
  const regionalStory={active:false,playing:false,timer:null};
  const regionalTerrain={map:null,ready:false,loading:null,maplibre:null,highDetailWasDisabled:null,autoRotateWasDisabled:null};

  function profileDefaults(){return Traveller.defaults(locale)}
  function loadProfile(){return Traveller.load(localStorage,PROFILE_KEY,locale)}
  function saveProfile(profile){return Traveller.save(localStorage,PROFILE_KEY,profile,locale)}

  async function waitForCore(max=70){
    for(let i=0;i<max;i++){
      if(window.__ONE_WORLD_ROUTE_APP__ && window.__ONE_WORLD_ROUTE_GLOBE__) return true;
      await sleep(80);
    }
    return false;
  }

  function buildTripUrl(id){
    const p = new URLSearchParams(location.search);
    const defaultTripId=catalog?.defaultTripId||'world-195';
    if(id === defaultTripId) p.delete('trip'); else p.set('trip',id);
    p.delete('segment'); p.delete('country'); p.delete('phase'); p.delete('view');
    return `/${p.toString()?`?${p}`:''}`;
  }

  function setQueryTrip(id){
    if(!catalog?.trips?.some(t=>t.id===id||t.slug===id))return;
    location.assign(buildTripUrl(id));
  }

  function ensureGlobalUi(){
    const top = $('.topbar');
    if(!top || $('#platformRouteBtn')) return;
    const actions = $('.top-actions',top);
    const wrap = document.createElement('div');
    wrap.className='platform-actions';
    wrap.innerHTML=`<button id="platformRouteBtn" class="platform-pill" type="button" aria-label="${esc(t('routes'))}" title="${esc(t('routes'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg></span><span class="platform-pill-label">${esc(t('routes'))}</span></button><button id="platformTravellerBtn" class="platform-pill secondary" type="button" aria-label="${esc(t('traveller'))}" title="${esc(t('traveller'))}"><span class="platform-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-4.2 3-6.3 6.5-6.3s5.7 2.1 6.5 6.3"/></svg></span><span class="platform-pill-label">${esc(t('traveller'))}</span></button>`;
    top.insertBefore(wrap, actions || null);
    $('#platformRouteBtn').onclick=openRouteLibrary;
    $('#platformTravellerBtn').onclick=openTraveller;
  }

  function ensureDialog(id, cls='platform-modal'){
    let modal=$('#'+id);
    if(modal) return modal;
    modal=document.createElement('div');modal.id=id;modal.className=`${cls} hidden`;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});
    document.body.appendChild(modal);return modal;
  }

  function openRouteLibrary(){
    const modal=ensureDialog('platformRouteModal');
    const {kinds,regions,modes,themes,paces,seasons,parties,starts}=Discovery.facets(catalog);
    modal.innerHTML=`<div class="platform-modal-card route-library-card glass"><button class="platform-x" aria-label="Close">×</button><div class="platform-eyebrow">ONE WORLD ROUTE</div><h2>${esc(t('routeLibrary'))}</h2><p class="platform-lead">${esc(t('routeLibraryLead'))}</p><div class="platform-route-filters"><label class="route-search"><span>${esc(t('searchRoutes'))}</span><input id="platformRouteSearch" type="search" autocomplete="off" placeholder="${esc(t('searchRoutes'))}"></label><label><span>${esc(t('filterType'))}</span><select id="platformRouteKind"><option value="">${esc(t('all'))}</option>${kinds.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterRegion'))}</span><select id="platformRouteRegion"><option value="">${esc(t('all'))}</option>${regions.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterDuration'))}</span><select id="platformRouteDuration"><option value="">${esc(t('all'))}</option><option value="7-14">7–14 ${esc(t('days'))}</option><option value="15-30">15–30 ${esc(t('days'))}</option><option value="31-89">31–89 ${esc(t('days'))}</option><option value="90-plus">90+ ${esc(t('days'))}</option></select></label><label><span>${esc(t('filterMode'))}</span><select id="platformRouteMode"><option value="">${esc(t('all'))}</option>${modes.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterTheme'))}</span><select id="platformRouteTheme"><option value="">${esc(t('all'))}</option>${themes.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label></div><div class="platform-fit-head"><button id="platformFitToggle" type="button" aria-expanded="false">${esc(t('showFit'))}</button></div><div id="platformFitFilters" class="platform-fit-filters hidden"><div class="platform-fit-title">${esc(t('routeFit'))}</div><label><span>${esc(t('fitPace'))}</span><select id="platformRoutePace"><option value="">${esc(t('all'))}</option>${paces.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitSeason'))}</span><select id="platformRouteSeason"><option value="">${esc(t('all'))}</option>${seasons.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitParty'))}</span><select id="platformRouteParty"><option value="">${esc(t('all'))}</option>${parties.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('fitStart'))}</span><select id="platformRouteStart"><option value="">${esc(t('all'))}</option>${starts.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label></div><div class="platform-route-resultbar"><span id="platformRouteCount"></span><button id="platformRouteReset" type="button">${esc(t('resetFilters'))}</button></div><div id="platformRouteResults" class="platform-route-grid"></div></div>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    const render=()=>{
      const q=String($('#platformRouteSearch',modal)?.value||'').trim().toLowerCase();
      const kind=$('#platformRouteKind',modal)?.value||'',region=$('#platformRouteRegion',modal)?.value||'',duration=$('#platformRouteDuration',modal)?.value||'',mode=$('#platformRouteMode',modal)?.value||'',theme=$('#platformRouteTheme',modal)?.value||'',pace=$('#platformRoutePace',modal)?.value||'',season=$('#platformRouteSeason',modal)?.value||'',party=$('#platformRouteParty',modal)?.value||'',start=$('#platformRouteStart',modal)?.value||'';
      const filters={q,kind,region,duration,mode,theme,pace,season,party,start};
      const filtered=Discovery.filter(catalog,filters,r=>[local(r.title),local(r.subtitle),r.kind,...(r.discovery?.regions||[]),...(r.discovery?.themes||[]),...(r.discovery?.modes||[])].join(' '));
      const host=$('#platformRouteResults',modal);
      host.innerHTML=filtered.length?filtered.map(routeCard).join(''):`<div class="platform-no-routes">${esc(t('noRoutes'))}</div>`;
      const count=$('#platformRouteCount',modal);if(count)count.textContent=filtered.length===1?`1 ${t('resultOne')}`:`${filtered.length} ${t('results')}`;
      // Route buttons are handled by event delegation below so filtering/re-rendering stays reliable.
    };
    $('#platformFitToggle',modal)?.addEventListener('click',e=>{
      const filters=$('#platformFitFilters',modal),button=e.currentTarget,opening=filters?.classList.contains('hidden');
      filters?.classList.toggle('hidden',!opening);
      button.setAttribute('aria-expanded',String(Boolean(opening)));
      button.textContent=t(opening?'hideFit':'showFit');
    });
    const results=$('#platformRouteResults',modal);
    results.addEventListener('click',e=>{
      const button=e.target.closest('[data-platform-trip]');
      if(!button||!results.contains(button))return;
      e.preventDefault();
      setQueryTrip(button.dataset.platformTrip);
    });
    ['platformRouteSearch','platformRouteKind','platformRouteRegion','platformRouteDuration','platformRouteMode','platformRouteTheme','platformRoutePace','platformRouteSeason','platformRouteParty','platformRouteStart'].forEach(id=>$('#'+id,modal)?.addEventListener(id==='platformRouteSearch'?'input':'change',render));
    $('#platformRouteReset',modal)?.addEventListener('click',()=>{
      const search=$('#platformRouteSearch',modal);if(search)search.value='';
      ['platformRouteKind','platformRouteRegion','platformRouteDuration','platformRouteMode','platformRouteTheme','platformRoutePace','platformRouteSeason','platformRouteParty','platformRouteStart'].forEach(id=>{const el=$('#'+id,modal);if(el)el.value=''});
      render();
    });
    render();
  }

  function routeCard(r){
    const metrics=[];
    if(r.metrics?.days)metrics.push(`${r.metrics.days} ${t('days')}`);
    if(r.metrics?.stops)metrics.push(`${r.metrics.stops} ${t('stops')}`);
    if(r.metrics?.countries)metrics.push(`${r.metrics.countries} ${t(r.metrics.countries===1?'countryUnit':'countriesUnit')}`);
    if(r.metrics?.nights)metrics.push(`${r.metrics.nights} ${t('onboardNights')}`);
    if(r.metrics?.seaDays)metrics.push(`${r.metrics.seaDays} ${t('seaDays')}`);
    return `<article class="platform-route-card ${r.id===currentTripMeta?.id?'active':''}"><div class="platform-route-top"><span>${esc(facetLabel(r.kind))}</span><b>${esc(statusLabel(r))}</b></div><h3>${esc(local(r.title))}</h3><p>${esc(local(r.subtitle))}</p><div class="platform-route-metrics">${metrics.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button type="button" data-platform-trip="${esc(r.id)}">${esc(t('open'))} →</button></article>`;
  }

  async function loadCountries(){
    if(countries.length) return countries;
    try{countries=await fetch('./data/country-centroids.json',{cache:'force-cache'}).then(r=>r.json())}catch{countries=[]}
    return countries;
  }

  async function openTraveller(){
    await loadCountries();
    const profile=loadProfile();
    const modal=ensureDialog('platformTravellerModal');
    const display = (()=>{try{return new Intl.DisplayNames([locale],{type:'region'})}catch{return null}})();
    const options=[...countries].filter(c=>c.cca2).map(c=>({code:c.cca2,name:display?.of(c.cca2)||c.name})).sort((a,b)=>a.name.localeCompare(b.name,locale));
    const countryOptions=(selected,blank=true)=>`${blank?`<option value="">${esc(t('notSet'))}</option>`:''}${options.map(o=>`<option value="${o.code}" ${selected===o.code?'selected':''}>${esc(o.name)}</option>`).join('')}`;
    const currencies = typeof Intl.supportedValuesOf==='function' ? Intl.supportedValuesOf('currency') : ['EUR','USD','GBP','CHF','JPY','CAD','AUD','NZD','CNY','INR','BRL','MXN','ZAR','SGD'];
    modal.innerHTML=`<form id="platformTravellerForm" class="platform-modal-card traveller-card glass"><button class="platform-x" type="button" aria-label="Close">×</button><div class="platform-eyebrow">${esc(t('global'))}</div><h2>${esc(t('contextTitle'))}</h2><p class="platform-lead">${esc(t('contextLead'))}</p><div class="traveller-grid"><label>${esc(t('passports'))}<select name="passport">${countryOptions(profile.passports?.[0]||null)}</select></label><label>${esc(t('secondPassport'))}<select name="passport2">${countryOptions(profile.passports?.[1]||null)}</select></label><label>${esc(t('residence'))}<select name="residence">${countryOptions(profile.residenceCountry)}</select></label><label>${esc(t('language'))}<select name="language">${SUPPORTED_LOCALES.map(l=>`<option value="${l}" ${profile.language===l?'selected':''}>${l.toUpperCase()}</option>`).join('')}</select></label><label>${esc(t('currency'))}<select name="currency">${currencies.map(c=>`<option value="${c}" ${profile.currency===c?'selected':''}>${c}</option>`).join('')}</select></label><label class="span-2">${esc(t('origin'))}<input name="origin" value="${esc(profile.origin||'')}" autocomplete="off" placeholder="e.g. Toronto / YYZ"></label><label>${esc(t('adults'))}<input name="adults" type="number" min="1" max="20" value="${Number(profile.party?.adults||1)}"></label><label>${esc(t('children'))}<input name="children" type="number" min="0" max="20" value="${Number(profile.party?.children||0)}"></label><label class="check span-2"><input name="mobility" type="checkbox" ${profile.accessibility?.reducedMobility?'checked':''}><span>${esc(t('mobility'))}</span></label><div class="traveller-subhead span-2">${esc(t('vehicleSection'))}</div><label>${esc(t('vehicleType'))}<select name="vehicleType"><option value="">${esc(t('notSet'))}</option><option value="private-car" ${profile.vehicle?.type==='private-car'?'selected':''}>${esc(t('privateCar'))}</option><option value="rental-car" ${profile.vehicle?.type==='rental-car'?'selected':''}>${esc(t('rentalCar'))}</option><option value="camper" ${profile.vehicle?.type==='camper'?'selected':''}>${esc(t('camper'))}</option><option value="motorcycle" ${profile.vehicle?.type==='motorcycle'?'selected':''}>${esc(t('motorcycle'))}</option><option value="other" ${profile.vehicle?.type==='other'?'selected':''}>${esc(t('otherVehicle'))}</option></select></label><label>${esc(t('registrationCountry'))}<select name="vehicleRegistration">${countryOptions(profile.vehicle?.registrationCountry||null)}</select></label><label>${esc(t('fuelType'))}<select name="vehicleFuel"><option value="unknown">${esc(t('unknown'))}</option><option value="petrol" ${profile.vehicle?.fuelType==='petrol'?'selected':''}>${esc(t('petrol'))}</option><option value="diesel" ${profile.vehicle?.fuelType==='diesel'?'selected':''}>${esc(t('diesel'))}</option><option value="hybrid" ${profile.vehicle?.fuelType==='hybrid'?'selected':''}>${esc(t('hybrid'))}</option><option value="plug-in-hybrid" ${profile.vehicle?.fuelType==='plug-in-hybrid'?'selected':''}>${esc(t('pluginHybrid'))}</option><option value="electric" ${profile.vehicle?.fuelType==='electric'?'selected':''}>${esc(t('electric'))}</option><option value="hydrogen" ${profile.vehicle?.fuelType==='hydrogen'?'selected':''}>${esc(t('hydrogen'))}</option><option value="other" ${profile.vehicle?.fuelType==='other'?'selected':''}>${esc(t('otherVehicle'))}</option></select></label><label>${esc(t('euroClass'))}<select name="vehicleEuro"><option value="unknown">${esc(t('unknown'))}</option>${['Euro 1','Euro 2','Euro 3','Euro 4','Euro 5','Euro 6'].map(v=>`<option value="${v}" ${profile.vehicle?.euroClass===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="check span-2"><input name="rentalCrossBorder" type="checkbox" ${profile.vehicle?.rentalCrossBorderApproved===true?'checked':''}><span>${esc(t('rentalCrossBorder'))}</span></label></div><p class="platform-privacy">${esc(t('private'))}</p><div class="platform-form-actions"><button class="ghost" type="button" id="platformClearTraveller">${esc(t('clear'))}</button><button class="primary" type="submit">${esc(t('save'))}</button></div></form>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    $('#platformClearTraveller').onclick=()=>{localStorage.removeItem(PROFILE_KEY);modal.classList.add('hidden');location.reload()};
    $('#platformTravellerForm').onsubmit=e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);
      const passports=[f.get('passport'),f.get('passport2')].filter(Boolean).map(String).filter((v,i,a)=>a.indexOf(v)===i);const vehicleType=String(f.get('vehicleType')||'');const vehicle=vehicleType?{type:vehicleType,registrationCountry:f.get('vehicleRegistration')||null,fuelType:String(f.get('vehicleFuel')||'unknown'),euroClass:String(f.get('vehicleEuro')||'unknown'),rentalCrossBorderApproved:vehicleType==='rental-car'?(f.get('rentalCrossBorder')==='on'):null}:null;const next={passports,residenceCountry:f.get('residence')||null,language:String(f.get('language')||'en'),currency:String(f.get('currency')||'EUR'),origin:String(f.get('origin')||'').trim()||null,party:{adults:Number(f.get('adults')||1),children:Number(f.get('children')||0)},accessibility:{reducedMobility:f.get('mobility')==='on'},vehicle};
      saveProfile(next);locale=SUPPORTED_LOCALES.includes(next.language)?next.language:locale;modal.classList.add('hidden');const p=new URLSearchParams(location.search);p.set('lang',locale);location.assign(`${location.pathname}?${p.toString()}`);
    };
  }

  const placeMap=trip=>Model.placeMap(trip);
  const stopMap=trip=>Model.stopMap(trip);
  const stopPlace=(trip,stop)=>Model.stopPlace(trip,stop);

  function syncRegionalUrl(){
    if(!currentTripMeta||currentTripMeta.renderer==='legacy-world')return;
    const existing=new URLSearchParams(location.search),p=new URLSearchParams();
    p.set('trip',currentTripMeta.id);
    p.set('lang',locale);
    if(existing.get('view')==='terrain'||document.body.classList.contains('terrain-view'))p.set('view','terrain');
    history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
  }


  function platformToast(message){
    const toast=$('#toast');if(!toast)return;
    toast.textContent=message;toast.classList.add('show');clearTimeout(toast._platformTimer);
    toast._platformTimer=setTimeout(()=>toast.classList.remove('show'),2600);
  }

  function regionalSettings(){
    return {
      autoRotate:$('#autoRotate')?.checked===true,
      showPoints:$('#showPoints')?.checked!==false,
      routeGlow:$('#routeGlow')?.checked!==false,
      arcWidth:Number($('#arcWidth')?.value||.55),
      reducedMotion:$('#reducedMotion')?.checked===true
    };
  }

  function routeCamera(){
    const places=[...placeMap(currentTrip).values()].filter(p=>Number.isFinite(Number(p.coordinates?.lat))&&Number.isFinite(Number(p.coordinates?.lng)));
    if(!places.length)return currentTrip.rendering?.camera||{lat:20,lng:12,altitude:.8};
    const lats=places.map(p=>Number(p.coordinates.lat)),lngs=places.map(p=>Number(p.coordinates.lng));
    const lat=(Math.min(...lats)+Math.max(...lats))/2,lng=(Math.min(...lngs)+Math.max(...lngs))/2;
    const latSpan=Math.max(...lats)-Math.min(...lats),lngSpan=(Math.max(...lngs)-Math.min(...lngs))*Math.max(.35,Math.cos(lat*Math.PI/180));
    const span=Math.max(latSpan,lngSpan);
    let altitude=span<7?.15:span<13?.21:span<22?.30:span<34?.40:.54;
    if(innerWidth<=820)altitude+=.07;
    return {lat,lng,altitude};
  }

  function regionalChapterForSegment(index){return Model.chapterForSegment(currentTrip,index)}

  function ensureRegionalStoryUi(){
    const stage=$('.globe-stage');if(!stage)return;
    if(!Model.hasCapability(currentTripMeta,'story')){$('#platformStoryBtn')?.remove();$('#platformStoryHud')?.remove();return}
    if(!$('#platformStoryBtn')){
      const b=document.createElement('button');b.id='platformStoryBtn';b.className='platform-story-btn glass';b.type='button';
      stage.appendChild(b);b.addEventListener('click',startRegionalStory);
    }
    const storyButton=$('#platformStoryBtn');if(storyButton)storyButton.innerHTML=`<span class="platform-story-icon">▶</span><span><b>${esc(t('storyPlay'))}</b><small>${currentTrip.segments.length} ${esc(t('segments'))}</small></span>`;
    if(!$('#platformStoryHud')){
      const hud=document.createElement('section');hud.id='platformStoryHud';hud.className='platform-story-hud glass hidden';hud.setAttribute('aria-live','polite');
      hud.innerHTML=`<div class="platform-story-head"><div><span id="platformStoryKicker"></span><b id="platformStoryChapter"></b></div><button id="platformStoryExit" type="button">${esc(t('storyExit'))}</button></div><div id="platformStoryRoute" class="platform-story-route"></div><div class="platform-story-controls"><button id="platformStoryPrev" type="button" aria-label="${esc(t('previous'))}">‹</button><button id="platformStoryPlay" type="button" aria-label="${esc(t('storyPlay'))}">Ⅱ</button><button id="platformStoryNext" type="button" aria-label="${esc(t('next'))}">›</button><div class="platform-story-track"><i></i></div><strong id="platformStoryPct">0%</strong></div>`;
      stage.appendChild(hud);
      $('#platformStoryExit',hud).addEventListener('click',stopRegionalStory);
      $('#platformStoryPrev',hud).addEventListener('click',()=>storyStep(-1));
      $('#platformStoryNext',hud).addEventListener('click',()=>storyStep(1));
      $('#platformStoryPlay',hud).addEventListener('click',toggleRegionalStoryPlayback);
    }
  }

  function updateRegionalStoryHud(){
    if(!currentTrip)return;
    const seg=currentTrip.segments[selectedSegmentIndex],sm=stopMap(currentTrip),pm=placeMap(currentTrip);
    const a=pm.get(sm.get(seg?.fromStopId)?.placeId),b=pm.get(sm.get(seg?.toStopId)?.placeId);
    const chapter=regionalChapterForSegment(selectedSegmentIndex);
    const kicker=$('#platformStoryKicker'),title=$('#platformStoryChapter'),route=$('#platformStoryRoute'),pct=$('#platformStoryPct'),bar=$('#platformStoryHud .platform-story-track i');
    const progress=currentTrip.segments.length<=1?100:Math.round(selectedSegmentIndex/(currentTrip.segments.length-1)*100);
    if(kicker)kicker.textContent=chapter?`${t('chapter')} · ${local(chapter.title)}`:`${t('storyRoute')} · ${selectedSegmentIndex+1}/${currentTrip.segments.length}`;
    if(title)title.textContent=chapter?local(chapter.title):local(currentTrip.title);
    if(route)route.textContent=`${local(a?.name)} → ${local(b?.name)} · ${facetLabel(seg?.transport?.mode||'')}`;
    if(pct)pct.textContent=`${progress}%`;if(bar)bar.style.width=`${progress}%`;
  }

  function storyStep(delta){
    if(!regionalStory.active)return;
    const next=Math.max(0,Math.min(currentTrip.segments.length-1,selectedSegmentIndex+delta));
    if(next===selectedSegmentIndex&&delta>0){pauseRegionalStory();const title=$('#platformStoryChapter');if(title)title.textContent=t('storyComplete');return}
    selectSegmentIndex(next,true);updateRegionalStoryHud();
  }

  function pauseRegionalStory(){
    clearInterval(regionalStory.timer);regionalStory.timer=null;regionalStory.playing=false;
    const b=$('#platformStoryPlay');if(b)b.textContent='▶';
  }

  function playRegionalStory(){
    clearInterval(regionalStory.timer);regionalStory.playing=true;
    const b=$('#platformStoryPlay');if(b)b.textContent='Ⅱ';
    regionalStory.timer=setInterval(()=>{
      if(selectedSegmentIndex>=currentTrip.segments.length-1){pauseRegionalStory();const title=$('#platformStoryChapter');if(title)title.textContent=t('storyComplete');return}
      selectSegmentIndex(selectedSegmentIndex+1,true);updateRegionalStoryHud();
    },2200);
  }

  function toggleRegionalStoryPlayback(){regionalStory.playing?pauseRegionalStory():playRegionalStory()}

  async function startRegionalStory(){
    if(!currentTrip||regionalStory.active||!Model.hasCapability(currentTripMeta,'story'))return;
    if(document.body.classList.contains('terrain-view'))await setRegionalTerrain(false);
    if(playTimer){clearInterval(playTimer);playTimer=null}
    regionalStory.active=true;document.body.classList.add('platform-story-mode');
    $('#platformStoryHud')?.classList.remove('hidden');
    updateRegionalStoryHud();playRegionalStory();
  }

  function stopRegionalStory(){
    pauseRegionalStory();regionalStory.active=false;document.body.classList.remove('platform-story-mode');
    $('#platformStoryHud')?.classList.add('hidden');renderRegionalGlobe();
  }

  function regionalRouteGeoJson(){
    return {type:'FeatureCollection',features:routeGeometry().map(d=>({type:'Feature',properties:{id:d._index+1,active:d._index===selectedSegmentIndex?1:0,mode:d.transport?.mode||''},geometry:{type:'LineString',coordinates:[[Number(d.start.lng),Number(d.start.lat)],[Number(d.end.lng),Number(d.end.lat)]]}}))};
  }

  function regionalStopGeoJson(){
    return {type:'FeatureCollection',features:[...placeMap(currentTrip).values()].filter(p=>p.coordinates).map(p=>({type:'Feature',properties:{id:p.id,name:local(p.name)},geometry:{type:'Point',coordinates:[Number(p.coordinates.lng),Number(p.coordinates.lat)]}}))};
  }
  function regionalRouteBounds(){return Model.routeBounds(currentTrip)}

  function focusRegionalTerrainRoute(){
    const map=regionalTerrain.map,bounds=regionalRouteBounds();if(!map||!bounds)return;
    const padding=innerWidth<=820?{top:90,right:26,bottom:132,left:26}:{top:78,right:380,bottom:90,left:330};
    map.fitBounds(bounds,{padding,maxZoom:7.4,duration:regionalSettings().reducedMotion?0:750,essential:true});
  }


  async function loadRegionalMapLibre(){
    if(regionalTerrain.maplibre)return regionalTerrain.maplibre;
    if(!document.querySelector('link[data-platform-maplibre]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css';link.dataset.platformMaplibre='1';document.head.appendChild(link);
    }
    const module=await import('https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs');
    if(typeof module?.Map!=='function')throw new Error('MapLibre unavailable');
    regionalTerrain.maplibre=module;return module;
  }

  function localizeRegionalMapStyle(style){
    const lang=SUPPORTED_LOCALES.includes(locale)?locale:'en';
    const nameExpr=['coalesce',['get',`name:${lang}`],['get',`name_${lang}`],['get','name:latin'],['get','name_en'],['get','name']];
    for(const layer of style?.layers||[]){
      if(layer?.type!=='symbol'||!layer.layout)continue;
      if(/^(label_(country|city|state|other)|water_name)/.test(String(layer.id||'')))layer.layout['text-field']=nameExpr;
    }
    return style;
  }

  function brandRegionalTerrainStyle(style){
    for(const layer of style?.layers||[]){
      const id=String(layer.id||'').toLowerCase(),type=layer.type;
      layer.paint=layer.paint||{};
      if(type==='background'){
        layer.paint['background-color']='#071019';
        continue;
      }
      if(type==='fill'){
        if(/water|ocean|lake|river/.test(id)){
          layer.paint['fill-color']='#071b2a';
          layer.paint['fill-opacity']=.98;
        }else if(/park|wood|forest|grass|nature|landcover/.test(id)){
          layer.paint['fill-color']='#102018';
          layer.paint['fill-opacity']=.72;
        }else if(/building/.test(id)){
          layer.paint['fill-color']='#16232d';
          layer.paint['fill-outline-color']='#20333e';
          layer.paint['fill-opacity']=.78;
        }else{
          layer.paint['fill-color']='#0d1720';
          if(layer.paint['fill-opacity']===undefined)layer.paint['fill-opacity']=.94;
        }
      }else if(type==='line'){
        if(/boundary|admin/.test(id)){
          layer.paint['line-color']='#466076';
          layer.paint['line-opacity']=.5;
        }else if(/motorway|trunk|primary/.test(id)){
          layer.paint['line-color']='#5b6571';
          layer.paint['line-opacity']=.66;
        }else if(/road|street|transport/.test(id)){
          layer.paint['line-color']='#33424f';
          layer.paint['line-opacity']=.52;
        }else if(/water|river/.test(id)){
          layer.paint['line-color']='#234f65';
          layer.paint['line-opacity']=.7;
        }else{
          layer.paint['line-color']=layer.paint['line-color']||'#2e3d49';
          if(layer.paint['line-opacity']===undefined)layer.paint['line-opacity']=.48;
        }
      }else if(type==='symbol'){
        layer.paint['text-color']=/water|marine/.test(id)?'#7098ae':(/country/.test(id)?'#dfeaf2':'#aebfcb');
        layer.paint['text-halo-color']='#071019';
        layer.paint['text-halo-width']=1.2;
        layer.paint['text-halo-blur']=.45;
        if(layer.paint['icon-opacity']===undefined)layer.paint['icon-opacity']=.72;
      }else if(type==='fill-extrusion'){
        layer.paint['fill-extrusion-color']='#172630';
        layer.paint['fill-extrusion-opacity']=.72;
      }else if(type==='hillshade'){
        layer.paint['hillshade-shadow-color']='#02070b';
        layer.paint['hillshade-highlight-color']='#50606b';
        layer.paint['hillshade-accent-color']='#1f3440';
        layer.paint['hillshade-exaggeration']=.42;
      }
    }
    return style;
  }

  async function regionalTerrainStyle(){
    let base;
    try{
      const response=await fetch('https://tiles.openfreemap.org/styles/liberty',{cache:'force-cache'});
      if(!response.ok)throw new Error(String(response.status));base=await response.json();
    }catch{
      base={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#d9e5e8'}}]};
    }
    base=brandRegionalTerrainStyle(localizeRegionalMapStyle(base));
    base.version=8;base.projection={type:'globe'};
    base.sources={...(base.sources||{}),
      terrainSource:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json'},
      regionalRoute:{type:'geojson',data:regionalRouteGeoJson()},
      regionalStops:{type:'geojson',data:regionalStopGeoJson()}
    };
    base.terrain={source:'terrainSource',exaggeration:1.34};
    base.sky={'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.42,3.5,.13,7,0]};
    base.layers.push(
      {id:'regional-route-shadow',type:'line',source:'regionalRoute',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(1,8,15,.68)','line-width':['interpolate',['linear'],['zoom'],2,3,7,6,12,9],'line-opacity':.58}},
      {id:'regional-route',type:'line',source:'regionalRoute',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#6c8eaa','line-width':['interpolate',['linear'],['zoom'],2,1.4,7,2.8,12,4.2],'line-opacity':.78}},
      {id:'regional-selected-shadow',type:'line',source:'regionalRoute',filter:['==',['get','id'],selectedSegmentIndex+1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'rgba(2,8,14,.88)','line-width':['interpolate',['linear'],['zoom'],2,6,7,10,12,15]}},
      {id:'regional-selected',type:'line',source:'regionalRoute',filter:['==',['get','id'],selectedSegmentIndex+1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#59ddff','line-width':['interpolate',['linear'],['zoom'],2,2.8,7,5.2,12,7.5]}},
      {id:'regional-route-hit',type:'line',source:'regionalRoute',paint:{'line-color':'rgba(0,0,0,.001)','line-width':18,'line-opacity':.001}},
      {id:'regional-stop-points',type:'circle',source:'regionalStops',paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,3,8,5,12,7],'circle-color':'#dff8ff','circle-stroke-width':2,'circle-stroke-color':'#1388a7'}}
    );
    return base;
  }

  async function ensureRegionalTerrain(){
    if(regionalTerrain.ready&&regionalTerrain.map)return regionalTerrain.map;
    if(regionalTerrain.loading)return regionalTerrain.loading;
    regionalTerrain.loading=(async()=>{
      let host=$('#terrainMap');
      if(!host){host=document.createElement('div');host.id='terrainMap';$('.globe-stage')?.appendChild(host)}
      let badge=$('.terrain-badge');
      if(!badge){badge=document.createElement('div');badge.className='terrain-badge';badge.innerHTML='<b>3D GLOBE TERRAIN</b><span></span>';$('.globe-stage')?.appendChild(badge)}
      const [maplibre,style]=await Promise.all([loadRegionalMapLibre(),regionalTerrainStyle()]);
      const cam=routeCamera();
      const map=new maplibre.Map({container:'terrainMap',style,center:[cam.lng,cam.lat],zoom:4.6,pitch:36,bearing:-5,minZoom:2.5,maxZoom:18,maxPitch:65,renderWorldCopies:false,attributionControl:false,canvasContextAttributes:{antialias:true}});
      map.on('style.load',()=>{try{map.setProjection({type:'globe'});map.setTerrain({source:'terrainSource',exaggeration:1.34})}catch{}});
      map.on('load',()=>{
        map.on('click','regional-route-hit',e=>{const id=Number(e.features?.[0]?.properties?.id);if(Number.isFinite(id))selectSegmentIndex(id-1,true)});
        map.on('mouseenter','regional-route-hit',()=>map.getCanvas().style.cursor='pointer');
        map.on('mouseleave','regional-route-hit',()=>map.getCanvas().style.cursor='');
      });
      map.addControl(new maplibre.AttributionControl({compact:true}),'bottom-left');
      if(innerWidth>820){map.addControl(new maplibre.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');if(maplibre.TerrainControl)map.addControl(new maplibre.TerrainControl({source:'terrainSource',exaggeration:1.34}),'top-right');if(maplibre.GlobeControl)map.addControl(new maplibre.GlobeControl(),'top-right')}
      await new Promise(resolve=>{
        if(map.loaded?.())resolve();
        else map.once('load',resolve);
      });
      regionalTerrain.map=map;regionalTerrain.ready=true;window.__ONE_WORLD_REGIONAL_TERRAIN__=map;
      return map;
    })().finally(()=>{regionalTerrain.loading=null});
    return regionalTerrain.loading;
  }

  function updateRegionalTerrain(){
    const map=regionalTerrain.map;if(!map)return;
    map.getSource?.('regionalRoute')?.setData?.(regionalRouteGeoJson());
    map.getSource?.('regionalStops')?.setData?.(regionalStopGeoJson());
    for(const id of ['regional-selected','regional-selected-shadow'])if(map.getLayer?.(id))map.setFilter(id,['==',['get','id'],selectedSegmentIndex+1]);
    const settings=regionalSettings();
    if(map.getLayer?.('regional-stop-points'))map.setLayoutProperty('regional-stop-points','visibility',settings.showPoints?'visible':'none');
    if(map.getLayer?.('regional-route'))map.setPaintProperty('regional-route','line-opacity',settings.routeGlow?.82:.48);
  }

  function focusRegionalTerrain(index=selectedSegmentIndex){
    const map=regionalTerrain.map,seg=routeGeometry()[index];if(!map||!seg)return;
    const a=[Number(seg.start.lng),Number(seg.start.lat)],b=[Number(seg.end.lng),Number(seg.end.lat)];
    const lng=(a[0]+b[0])/2,lat=(a[1]+b[1])/2,spread=Math.max(Math.abs(a[0]-b[0])*Math.cos(lat*Math.PI/180),Math.abs(a[1]-b[1]));
    const zoom=spread<.5?9.2:spread<1.5?7.9:spread<4?6.7:spread<9?5.5:4.6;
    map.easeTo({center:[lng,lat],zoom:innerWidth<=820?zoom-.25:zoom,pitch:spread<4?46:34,bearing:0,duration:regionalSettings().reducedMotion?0:700,essential:true});
  }

  async function setRegionalTerrain(active){
    if(!currentTrip||currentTripMeta?.renderer==='legacy-world'||!Model.hasCapability(currentTripMeta,'terrain'))return;
    const toggle=$('#terrainView');if(toggle)toggle.checked=Boolean(active);
    if(!active){
      document.body.classList.remove('terrain-loading','terrain-view');
      const high=$('#highDetailGlobe'),auto=$('#autoRotate');
      if(high&&regionalTerrain.highDetailWasDisabled!==null){high.disabled=regionalTerrain.highDetailWasDisabled;regionalTerrain.highDetailWasDisabled=null}
      if(auto&&regionalTerrain.autoRotateWasDisabled!==null){auto.disabled=regionalTerrain.autoRotateWasDisabled;regionalTerrain.autoRotateWasDisabled=null}
      const p=new URLSearchParams(location.search);p.delete('view');history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
      renderRegionalGlobe();return;
    }
    if(regionalStory.active)stopRegionalStory();
    const high=$('#highDetailGlobe'),auto=$('#autoRotate');
    if(high){if(regionalTerrain.highDetailWasDisabled===null)regionalTerrain.highDetailWasDisabled=high.disabled;high.disabled=true}
    if(auto){if(regionalTerrain.autoRotateWasDisabled===null)regionalTerrain.autoRotateWasDisabled=auto.disabled;auto.disabled=true}
    document.body.classList.add('terrain-loading');
    const badge=$('.terrain-badge span');if(badge)badge.textContent=t('terrainLoading');
    try{
      const map=await ensureRegionalTerrain();map.resize();updateRegionalTerrain();
      document.body.classList.remove('terrain-loading');document.body.classList.add('terrain-view');focusRegionalTerrainRoute();
      if(badge)badge.textContent=t('terrainHint');
      const p=new URLSearchParams(location.search);p.set('view','terrain');history.replaceState(null,'',`${location.pathname}?${p.toString()}`);
    }catch(e){
      console.warn('Regional terrain unavailable',e);document.body.classList.remove('terrain-loading','terrain-view');if(toggle)toggle.checked=false;
      const high=$('#highDetailGlobe'),auto=$('#autoRotate');
      if(high&&regionalTerrain.highDetailWasDisabled!==null){high.disabled=regionalTerrain.highDetailWasDisabled;regionalTerrain.highDetailWasDisabled=null}
      if(auto&&regionalTerrain.autoRotateWasDisabled!==null){auto.disabled=regionalTerrain.autoRotateWasDisabled;regionalTerrain.autoRotateWasDisabled=null}
      platformToast('3D terrain unavailable');
    }
  }

  function configureRegionalMethodology(){
    const modal=$('#infoModal'),card=$('.modal-card',modal);if(!modal||!card)return;
    const sourced=currentTrip.segments.filter(s=>(s.verification?.sourceIds||[]).length).length;
    card.innerHTML=`<button class="modal-close" aria-label="Close">×</button><div class="eyebrow">${esc(t('methodology').toUpperCase())}</div><h2>${esc(t('routeMethodTitle'))}</h2><p>${esc(t('routeMethodText'))}</p><div class="method-grid"><article><b>${currentTrip.stops.length}</b><span>${esc(t('stops'))}</span></article><article><b>${currentTrip.segments.length}</b><span>${esc(t('segments'))}</span></article><article><b>${currentTrip.planning?.days||'—'}</b><span>${esc(t('days'))}</span></article><article><b>${sourced}/${currentTrip.segments.length}</b><span>${esc(t('evidenceCoverage'))}</span></article></div><h3>${esc(t('editorialStatus'))}</h3><p>${esc(t('editorial'))}</p>`;
    $('.modal-close',card)?.addEventListener('click',()=>modal.classList.add('hidden'));
  }

  function configureRegionalSettings(){
    const actions=$('.top-actions');if(actions)actions.classList.add('platform-regional-actions');
    const brand=$('#brandBtn');if(brand)brand.onclick=()=>{selectedSegmentIndex=0;renderTripOverview();renderRegionalGlobe();if(document.body.classList.contains('terrain-view'))focusRegionalTerrain(0);else window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView(routeCamera(),regionalSettings().reducedMotion?0:650)};
    const settingsButton=$('#settingsBtn');if(settingsButton){settingsButton.title=t('settings');settingsButton.setAttribute('aria-label',t('settings'))}
    const infoButton=$('#infoBtn');if(infoButton){infoButton.title=t('methodology');infoButton.setAttribute('aria-label',t('methodology'))}
    const shareButton=$('#shareBtn');if(shareButton){shareButton.title=t('share');shareButton.setAttribute('aria-label',t('share'))}
    const search=$('#searchBtn');if(search)search.hidden=true;
    const labels=[['autoRotate','autoRotate'],['highDetailGlobe','highDetail'],['terrainView','terrain'],['showPoints','showPoints'],['routeGlow','routeGlow'],['arcWidth','arcThickness'],['reducedMotion','reducedMotion']];
    const terrainToggle=$('#terrainView'),terrainLabel=terrainToggle?.closest('label');
    if(terrainLabel)terrainLabel.hidden=!Model.hasCapability(currentTripMeta,'terrain');
    for(const [id,key] of labels){const span=$('#'+id)?.closest('label')?.querySelector('span');if(span)span.textContent=t(key)}
    const title=$('#settingsPopover .settings-head h3');if(title)title.textContent=t('settings');
    const share=$('#mobileShareBtn');if(share)share.textContent=t('share');
    const info=$('#mobileInfoBtn');if(info)info.textContent=t('methodology');
    let storyBtn=$('#regionalStorySettingsBtn');
    if(!storyBtn){storyBtn=document.createElement('button');storyBtn.id='regionalStorySettingsBtn';storyBtn.type='button';storyBtn.addEventListener('click',()=>{$('#settingsPopover')?.classList.add('hidden');startRegionalStory()});$('#settingsPopover .mobile-settings-actions')?.appendChild(storyBtn)}
    if(storyBtn){storyBtn.textContent=t('storyPlay');storyBtn.hidden=!Model.hasCapability(currentTripMeta,'story')}
    const bind=(id,event,fn)=>{const el=$('#'+id);if(!el||el.dataset.platformRegionalWired)return;el.dataset.platformRegionalWired='1';el.addEventListener(event,fn)};
    bind('autoRotate','change',()=>{const ctl=window.__ONE_WORLD_ROUTE_GLOBE__?.controls?.();if(ctl){ctl.autoRotate=$('#autoRotate').checked&&!regionalStory.active&&!document.body.classList.contains('terrain-view');ctl.autoRotateSpeed=.28}});
    bind('showPoints','change',()=>{renderRegionalGlobe();updateRegionalTerrain()});
    bind('routeGlow','change',()=>{renderRegionalGlobe();updateRegionalTerrain()});
    bind('arcWidth','input',()=>{renderRegionalGlobe();updateRegionalTerrain()});
    bind('reducedMotion','change',()=>{});
    configureRegionalMethodology();
  }

  function isolateRegionalRuntime(){
    document.body.classList.add('platform-regional-trip');
    document.body.classList.remove('story-mode','story-launching');
    window.ONE_WORLD_MOVEMENTS?.clear?.();
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    if(!globe)return;
    try{
      if(typeof globe.ringsData==='function')globe.ringsData([]);
      if(typeof globe.labelsData==='function')globe.labelsData([]);
      if(typeof globe.htmlElementsData==='function')globe.htmlElementsData([]);
      if(typeof globe.onPolygonClick==='function')globe.onPolygonClick(()=>{});
      if(typeof globe.onPolygonHover==='function')globe.onPolygonHover(()=>{});
      if(typeof globe.polygonLabel==='function')globe.polygonLabel(()=> '');
      if(typeof globe.polygonCapColor==='function')globe.polygonCapColor(()=> 'rgba(16,31,46,.10)');
      if(typeof globe.polygonSideColor==='function')globe.polygonSideColor(()=> 'rgba(7,13,22,.08)');
      if(typeof globe.polygonStrokeColor==='function')globe.polygonStrokeColor(()=> 'rgba(135,166,201,.16)');
      if(typeof globe.polygonAltitude==='function')globe.polygonAltitude(()=> .001);
    }catch(e){console.warn('Regional isolation failed',e)}
  }

  function regionalHtmlLabel(place){
    const el=document.createElement('div');
    el.className='platform-globe-label';
    const dot=document.createElement('i');el.appendChild(dot);
    const text=document.createElement('span');text.textContent=local(place?.name);el.appendChild(text);
    return el;
  }

  function applyTripShell(){
    isolateRegionalRuntime();
    syncRegionalUrl();
    document.documentElement.lang=locale;
    document.title=`${local(currentTrip.title)} — ONE WORLD ROUTE`;
    const meta=$('meta[name="description"]');if(meta)meta.content=local(currentTrip.summary);
    const brandSmall=$('.brand small');if(brandSmall)brandSmall.textContent=local(currentTrip.title);
    const hero=$('.hero-copy');
    if(hero){
      hero.innerHTML=`<div class="eyebrow"><span class="live-dot"></span>${esc(facetLabel(currentTrip.kind))} · ${currentTrip.planning?.days||''} ${esc(t('days'))}</div><h1>${esc(local(currentTrip.title))}</h1><p>${esc(local(currentTrip.summary))}</p><div class="platform-template-note">${esc(t('editorial'))}</div>`;
    }
    const kpis=$('#topKpis');
    if(kpis)kpis.innerHTML=`<div class="kpi"><b>${currentTrip.planning?.days||'—'}</b><span>${esc(t('days'))}</span></div><div class="kpi"><b>${currentTrip.stops?.length||0}</b><span>${esc(t('stops'))}</span></div><div class="kpi"><b>${currentTrip.segments?.length||0}</b><span>${esc(t('segments'))}</span></div>`;
    const mobileFilters=$('#mobileFilters');if(mobileFilters)mobileFilters.textContent=t('stops');
    const mobileDetails=$('#mobileDetails');if(mobileDetails)mobileDetails.textContent=t('details');
    buildLeftNavigation();
    buildChapterRail();
    replaceTimeline();
    ensureRegionalStoryUi();
    configureRegionalSettings();
    renderTripOverview();
  }

  function buildLeftNavigation(){
    const panel=$('#leftPanel');if(!panel)return;
    panel.scrollTop=0;
    $('.platform-regional-nav',panel)?.remove();
    const nav=document.createElement('div');nav.className='platform-regional-nav';
    nav.innerHTML=`<div class="section-title"><span>${esc(t('stops'))}</span><span class="pill">${currentTrip.stops.length}</span></div><div class="platform-stop-list">${currentTrip.stops.map((s,i)=>stopButton(s,i)).join('')}</div>`;
    panel.appendChild(nav);
    $$('[data-stop-index]',nav).forEach(b=>b.onclick=()=>selectStop(Number(b.dataset.stopIndex),true));
  }

  function stopButton(stop,index){
    const p=stopPlace(currentTrip,stop);return `<button type="button" data-stop-index="${index}" class="platform-stop ${index===0?'active':''}"><span>${String(stop.sequence).padStart(2,'0')}</span><div><b>${esc(local(p?.name))}</b><small>${esc(t('day'))} ${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''} · ${stop.nights||0} ${esc(t('nights'))}</small></div></button>`;
  }

  function buildChapterRail(){
    const rail=$('#phaseRail');if(!rail)return;
    const chapters=currentTrip.chapters||[];
    rail.classList.toggle('platform-empty-rail',chapters.length===0);
    rail.innerHTML=chapters.map((c,i)=>`<button type="button" data-trip-chapter="${i}" class="${i===0?'active':''}"><span class="phase-dot"></span>${esc(local(c.title))}</button>`).join('');
    $$('[data-trip-chapter]',rail).forEach(b=>b.onclick=()=>{
      $$('[data-trip-chapter]',rail).forEach(x=>x.classList.toggle('active',x===b));
      const c=currentTrip.chapters[Number(b.dataset.tripChapter)],idx=currentTrip.stops.findIndex(s=>s.id===c.stopIds?.[0]);if(idx>=0)selectStop(idx,true);
    });
  }

  function replaceTimeline(){
    const timeline=$('#timeline');if(!timeline)return;
    timeline.innerHTML=`<div class="timeline-top platform-regional-timeline-top"><div class="platform-regional-playback"><button class="timeline-step" id="regionalPrevBtn" type="button" aria-label="${esc(t('previous'))}">‹</button><button class="play-btn" id="regionalPlayBtn" type="button" aria-label="Play">▶</button><button class="timeline-step" id="regionalNextBtn" type="button" aria-label="${esc(t('next'))}">›</button></div><div class="timeline-meta"><strong id="regionalTimelineTitle"></strong><span id="regionalTimelineMeta"></span></div></div><div class="range-wrap"><input id="regionalRouteRange" type="range" min="1" max="${Math.max(1,currentTrip.segments.length)}" value="1" step="1" aria-label="${esc(t('segments'))}"/><div class="range-labels" id="regionalRangeLabels"><span></span><span></span><span></span></div></div>`;
    $('#regionalPlayBtn')?.addEventListener('click',togglePlayback);
    $('#regionalPrevBtn')?.addEventListener('click',()=>selectSegmentIndex(selectedSegmentIndex-1,true));
    $('#regionalNextBtn')?.addEventListener('click',()=>selectSegmentIndex(selectedSegmentIndex+1,true));
    $('#regionalRouteRange')?.addEventListener('input',e=>selectSegmentIndex(Number(e.currentTarget.value)-1,true));
    updateTimelineRegional();
  }

  function updateTimelineRegional(){
    const s=currentTrip.segments[selectedSegmentIndex];if(!s)return;
    const stops=stopMap(currentTrip),places=placeMap(currentTrip),a=places.get(stops.get(s.fromStopId)?.placeId),b=places.get(stops.get(s.toStopId)?.placeId);
    const title=$('#regionalTimelineTitle');if(title)title.textContent=`${local(a?.name)} → ${local(b?.name)}`;
    const meta=$('#regionalTimelineMeta');if(meta)meta.textContent=`${t('segment')} ${s.sequence} / ${currentTrip.segments.length} · ${facetLabel(String(s.transport?.mode||''))}`;
    const range=$('#regionalRouteRange');if(range){range.value=String(selectedSegmentIndex+1);range.style.setProperty('--range-progress',`${currentTrip.segments.length<=1?100:(selectedSegmentIndex/(currentTrip.segments.length-1))*100}%`)}
    const labels=$$('#regionalRangeLabels span');
    if(labels[0])labels[0].innerHTML=`<b>${esc(t('start').toUpperCase())}</b> · ${esc(local(stopPlace(currentTrip,currentTrip.stops[0])?.name))}`;
    if(labels[1])labels[1].textContent=`${currentTrip.planning?.days||'—'} ${t('days')}`;
    if(labels[2])labels[2].innerHTML=`<b>${esc(t('finish').toUpperCase())}</b> · ${esc(local(stopPlace(currentTrip,currentTrip.stops.at(-1))?.name))}`;
  }

  function togglePlayback(){
    const btn=$('#regionalPlayBtn');if(playTimer){clearInterval(playTimer);playTimer=null;if(btn)btn.textContent='▶';return}
    if(btn)btn.textContent='Ⅱ';playTimer=setInterval(()=>{if(selectedSegmentIndex>=currentTrip.segments.length-1){clearInterval(playTimer);playTimer=null;if(btn)btn.textContent='▶';return}selectSegmentIndex(selectedSegmentIndex+1,true)},1400);
  }

  function routeGeometry(){
    const stops=stopMap(currentTrip),places=placeMap(currentTrip);
    return Model.routeGeometry(currentTrip).map(s=>({...s,fromName:local(places.get(stops.get(s.fromStopId)?.placeId)?.name),toName:local(places.get(stops.get(s.toStopId)?.placeId)?.name)}));
  }

  function renderRegionalGlobe(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;if(!globe)return;
    const arcs=routeGeometry();
    const places=[...placeMap(currentTrip).values()];
    const active=arcs[selectedSegmentIndex];
    const activeIds=new Set([active?.start&&currentTrip.stops.find(s=>s.id===active.fromStopId)?.placeId,active?.end&&currentTrip.stops.find(s=>s.id===active.toStopId)?.placeId].filter(Boolean));
    const labelPlaces=places.filter(p=>activeIds.has(p.id));
    try{
      isolateRegionalRuntime();
      const settings=regionalSettings(),story=regionalStory.active,scale=Math.max(.45,settings.arcWidth/.55);
      globe.arcsData(arcs)
        .arcStartLat(d=>d.start.lat).arcStartLng(d=>d.start.lng)
        .arcEndLat(d=>d.end.lat).arcEndLng(d=>d.end.lng)
        .arcAltitude(d=>d._index===selectedSegmentIndex?.075:.045)
        .arcStroke(d=>(d._index===selectedSegmentIndex?.42:.18)*scale)
        .arcColor(d=>d._index===selectedSegmentIndex?(settings.routeGlow?['#59ddff','#ffffff']:'#59ddff'):(story?'rgba(92,124,151,.18)':'rgba(113,151,190,.62)'))
        .arcLabel(()=> '')
        .arcDashLength(d=>d._index===selectedSegmentIndex&&story?.62:1).arcDashGap(d=>d._index===selectedSegmentIndex&&story?.16:0).arcDashAnimateTime(d=>d._index===selectedSegmentIndex&&story&&!settings.reducedMotion?1200:0)
        .onArcClick(d=>{if(!regionalStory.active)selectSegmentIndex(d._index,true)});
      globe.pointsData(settings.showPoints?places:[])
        .pointLat(d=>d.coordinates.lat).pointLng(d=>d.coordinates.lng)
        .pointAltitude(.012)
        .pointRadius(d=>activeIds.has(d.id)?.11:.065)
        .pointColor(d=>activeIds.has(d.id)?'#dff8ff':'rgba(130,185,214,.68)')
        .onPointClick(p=>{const idx=currentTrip.stops.findIndex(s=>s.placeId===p.id);if(idx>=0)selectStop(idx,true)});
      if(typeof globe.labelsData==='function')globe.labelsData([]);
      if(typeof globe.ringsData==='function')globe.ringsData([]);
      if(typeof globe.htmlElementsData==='function'){
        globe.htmlElementsData(labelPlaces).htmlLat(d=>d.coordinates.lat).htmlLng(d=>d.coordinates.lng).htmlAltitude(.018).htmlElement(regionalHtmlLabel).htmlTransitionDuration(0);
      }
      if(typeof globe.onPolygonClick==='function')globe.onPolygonClick(()=>{});
      if(typeof globe.polygonLabel==='function')globe.polygonLabel(()=> '');
      if(globe.controls()){globe.controls().autoRotate=settings.autoRotate&&!story&&!document.body.classList.contains('terrain-view');globe.controls().autoRotateSpeed=.28;globe.controls().enableZoom=true}
      const camera=routeCamera();
      if(!document.body.dataset.regionalCameraReady){document.body.dataset.regionalCameraReady='1';globe.pointOfView(camera,settings.reducedMotion?0:700)}
    }catch(e){console.warn('Regional globe render failed',e)}
  }

  function selectSegmentIndex(index,focus=false){
    selectedSegmentIndex=Math.max(0,Math.min(currentTrip.segments.length-1,index));
    $$('.platform-stop').forEach(x=>x.classList.remove('active'));
    renderRegionalGlobe();updateTimelineRegional();renderSegmentDetail(currentTrip.segments[selectedSegmentIndex]);updateRegionalTerrain();
    if(regionalStory.active)updateRegionalStoryHud();
    if(focus){if(document.body.classList.contains('terrain-view'))focusRegionalTerrain(selectedSegmentIndex);else focusSegment(currentTrip.segments[selectedSegmentIndex])}
  }

  function selectStop(index,focus=false){
    const stop=currentTrip.stops[index],p=stopPlace(currentTrip,stop);if(!stop||!p)return;
    $$('.platform-stop').forEach((x,i)=>x.classList.toggle('active',i===index));
    renderStopDetail(stop,p);
    if(index<currentTrip.segments.length){selectedSegmentIndex=index;updateTimelineRegional();renderRegionalGlobe();updateRegionalTerrain()}
    if(focus){if(document.body.classList.contains('terrain-view'))focusRegionalTerrain(Math.min(index,currentTrip.segments.length-1));else window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView({lat:p.coordinates.lat,lng:p.coordinates.lng,altitude:.48},regionalSettings().reducedMotion?0:650)}
  }

  function focusSegment(seg){
    const sm=stopMap(currentTrip),pm=placeMap(currentTrip),a=pm.get(sm.get(seg.fromStopId)?.placeId),b=pm.get(sm.get(seg.toStopId)?.placeId);if(!a||!b)return;
    let lng=(a.coordinates.lng+b.coordinates.lng)/2;let lat=(a.coordinates.lat+b.coordinates.lat)/2;
    const spread=Math.max(Math.abs(Number(a.coordinates.lat)-Number(b.coordinates.lat)),Math.abs(Number(a.coordinates.lng)-Number(b.coordinates.lng))*Math.max(.35,Math.cos(lat*Math.PI/180)));
    let altitude=spread<1?.09:spread<2.5?.13:spread<5?.18:spread<10?.25:.34;
    if(innerWidth<=820)altitude+=.055;
    window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView({lat,lng,altitude},regionalSettings().reducedMotion?0:650);
  }

  function renderTripOverview(){
    setRegionalDetailMode('overview');
    const title=$('#detailTitle');if(title)title.textContent=local(currentTrip.title);
    const eye=$('#detailEyebrow');if(eye)eye.textContent=t('overview');
    const tabs=$('#detailTabs');if(tabs)tabs.style.display='none';
    const content=$('#detailContent');if(!content)return;
    content.scrollTop=0;
    const sourced=currentTrip.segments.filter(s=>(s.verification?.sourceIds||[]).length).length,verified=currentTrip.segments.filter(s=>s.verification?.status==='verified').length;
    const entry=currentTrip.entryGuidance,entrySource=entry?sourceMap().get(entry.officialResolverSourceId):null;
    const profile=loadProfile();
    const extension=Extensions.composeTripOverview({trip:currentTrip,profile,t,esc,local});
    content.innerHTML=`<div class="overview-number platform-duration-number">${currentTrip.planning?.days||'—'}<small>${esc(t('days'))}</small></div><p class="detail-copy">${esc(local(currentTrip.summary))}</p><div class="data-grid"><div class="data-card"><span>${esc(t('stops'))}</span><b>${currentTrip.stops.length}</b></div>${extension.cards}<div class="data-card"><span>${esc(t('routeEvidence'))}</span><b>${sourced}/${currentTrip.segments.length}</b></div><div class="data-card"><span>${esc(t('verified'))}</span><b>${verified}/${currentTrip.segments.length}</b></div><div class="data-card"><span>${esc(t('currency'))}</span><b>${esc(currentTrip.planning?.currency||'—')}</b></div></div>${extension.notices}${entry?`<div class="platform-entry"><b>${esc(t('entryGuidance'))}</b><p>${esc(local(entry.message))}</p>${entrySource?`<a href="${esc(entrySource.url)}" target="_blank" rel="noopener noreferrer">${esc(t('officialCheck'))} →</a>`:''}</div>`:''}<button class="platform-context-inline" id="regionalTravellerBtn" type="button">${esc(t('traveller'))} →</button>`;
    $('#regionalTravellerBtn')?.addEventListener('click',openTraveller);
  }

  function renderStopDetail(stop,p){
    setRegionalDetailMode('stop');
    const title=$('#detailTitle');if(title)title.textContent=local(p.name);
    const eye=$('#detailEyebrow');if(eye)eye.textContent=`${t('stop').toUpperCase()} ${stop.sequence} · ${facetLabel(p.type)}`;
    const content=$('#detailContent');if(!content)return;
    content.scrollTop=0;
    const extension=Extensions.composeStopDetail({trip:currentTrip,stop,place:p,profile:loadProfile(),t,esc,local});
    const notices=extension.notices||`<p class="detail-copy">${esc(t('editorial'))}</p>`;
    content.innerHTML=`<div class="overview-number">${stop.sequence}<small> / ${currentTrip.stops.length}</small></div><div class="data-grid"><div class="data-card"><span>${esc(t('day'))}</span><b>${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''}</b></div>${extension.cards}<div class="data-card"><span>${esc(t('type'))}</span><b>${esc(facetLabel(p.type))}</b></div><div class="data-card"><span>${esc(t('country'))}</span><b>${esc(countryDisplay(p.countryCode))}</b></div></div>${notices}${extension.sourceIds.length?`<div class="platform-evidence"><div class="ops-mini-title">${esc(t('sources'))}</div>${sourceLinks(extension.sourceIds)}</div>`:''}`;
  }

  function renderSegmentDetail(s){
    setRegionalDetailMode('segment');
    const sm=stopMap(currentTrip),pm=placeMap(currentTrip),a=pm.get(sm.get(s.fromStopId)?.placeId),b=pm.get(sm.get(s.toStopId)?.placeId);
    const title=$('#detailTitle');if(title)title.textContent=`${local(a?.name)} → ${local(b?.name)}`;
    const eye=$('#detailEyebrow');if(eye)eye.textContent=`${t('segment').toUpperCase()} ${s.sequence} / ${currentTrip.segments.length}`;
    const content=$('#detailContent');if(!content)return;
    content.scrollTop=0;
    const stages=(s.transport?.stages||[]).map((stage,i)=>`<article class="platform-stage"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(stage.operator||String(stage.mode||'').replaceAll('-',' '))}</b><small>${esc(stage.from||'')} → ${esc(stage.to||'')}</small><em>${esc(durationLabel(stage))} · ${esc(costLabel(stage))}</em></div></article>`).join('');
    const baseRefs=[...(s.verification?.sourceIds||[]),...(s.transport?.stages||[]).flatMap(x=>x.sourceIds||[])];
    const extension=Extensions.composeSegmentDetail({trip:currentTrip,segment:s,profile:loadProfile(),t,esc,local});
    const refs=[...new Set([...baseRefs,...extension.sourceIds])];
    content.innerHTML=`<div class="data-grid"><div class="data-card"><span>${esc(t('transport'))}</span><b>${esc(facetLabel(String(s.transport?.mode||'—')))}</b></div><div class="data-card"><span>${esc(t('verification'))}</span><b class="${s.verification?.status==='verified'?'evidence-ok':(s.verification?.status==='illustrative'?'evidence-info':'evidence-watch')}">${esc(verificationLabel(s))}</b></div><div class="data-card"><span>${esc(t('duration'))}</span><b>${esc(durationLabel(s.planning))}</b></div><div class="data-card"><span>${esc(t('cost'))}</span><b>${esc(costLabel(s.planning))}</b></div></div>${extension.panels}${stages?`<div class="platform-stages">${stages}</div>`:''}${s.verification?.notes?`<div class="op-callout">${esc(editorialNote(s.verification.notes))}</div>`:''}${refs.length?`<div class="platform-evidence"><div class="ops-mini-title">${esc(t('sources'))}</div>${sourceLinks(refs)}</div>`:''}`;
  }

  async function activateRegionalTrip(meta){
    currentTripMeta=meta;
    selectedSegmentIndex=0;
    currentTrip=await fetch(meta.dataset,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip dataset '+r.status);return r.json()});
    await waitForCore();
    applyTripShell();
    renderRegionalGlobe();
    setTimeout(renderRegionalGlobe,500);
    if(Model.hasCapability(currentTripMeta,'terrain')&&new URLSearchParams(location.search).get('view')==='terrain')setTimeout(()=>setRegionalTerrain(true),650);
  }

  async function init(){
    try{
      catalog=await fetch(CATALOG_URL,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip catalog '+r.status);return r.json()});
      const p=new URLSearchParams(location.search),wanted=p.get('trip')||catalog.defaultTripId;
      currentTripMeta=catalog.trips.find(x=>x.id===wanted||x.slug===wanted)||catalog.trips.find(x=>x.id===catalog.defaultTripId);
      const profile=loadProfile();
      const explicitLang=new URLSearchParams(location.search).get('lang');
      if(!SUPPORTED_LOCALES.includes(String(explicitLang||'').toLowerCase())&&profile.language&&SUPPORTED_LOCALES.includes(profile.language))locale=profile.language;
      ensureGlobalUi();
      if(currentTripMeta.renderer!=='legacy-world') await activateRegionalTrip(currentTripMeta);
      else { await waitForCore(); activateLegacyLocalization(); }
    }catch(e){console.warn('ONE WORLD ROUTE platform layer unavailable',e)}
  }

  window.ONE_WORLD_PLATFORM={openRoutes:openRouteLibrary,openTraveller,getProfile:loadProfile,getTrip:()=>currentTripMeta,buildTripUrl,setTerrain:setRegionalTerrain,startStory:startRegionalStory,stopStory:stopRegionalStory,focusRoute:()=>{if(document.body.classList.contains('terrain-view'))focusRegionalTerrainRoute();else window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView(routeCamera(),regionalSettings().reducedMotion?0:650)}};
  document.addEventListener('keydown',e=>{
    if(!document.body.classList.contains('platform-regional-trip')||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(e.key==='Escape'&&regionalStory.active){e.preventDefault();stopRegionalStory()}
    else if(e.key==='ArrowLeft'&&regionalStory.active){e.preventDefault();storyStep(-1)}
    else if(e.key==='ArrowRight'&&regionalStory.active){e.preventDefault();storyStep(1)}
  });
  window.addEventListener('DOMContentLoaded',init);
})();
