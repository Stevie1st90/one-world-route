(() => {
  'use strict';

  const CATALOG_URL = './data/platform/trips.json';
  const PROFILE_KEY = 'one-world-route:traveller-context:v1';
  const SUPPORTED_LOCALES = ['en','de','it','es','fr','pt'];
  const I18N = {
    en:{routes:'Routes',traveller:'Traveller',flagship:'Flagship',template:'Template',open:'Open route',days:'days',stops:'stops',segments:'segments',global:'Global perspective',contextTitle:'Traveller context',contextLead:'Used to adapt entry rules, language, currency and departure assumptions. Stored only on this device.',passports:'Passport country',secondPassport:'Second passport (optional)',residence:'Residence',language:'Language',currency:'Currency',origin:'Starting city / airport',adults:'Adults',children:'Children',mobility:'Reduced mobility',save:'Save context',clear:'Clear',notSet:'Not set',currentCheck:'Current check required',routeLibrary:'Explore routes',routeLibraryLead:'One platform for world journeys, round trips, road trips, rail, cruises and more.',editorial:'Editorial template — verify transport, prices and entry requirements for your dates.',overview:'Route overview',day:'Day',nights:'nights',transport:'Transport',verification:'Verification',backWorld:'World route',private:'Private on this device. Passport numbers, booking references and payment details are never requested.',sourcedBeta:'Sourced beta',sources:'Sources',lastChecked:'Last checked',publishedFrom:'from',verified:'Verified',routeEvidence:'Route evidence',entryGuidance:'Entry guidance',officialCheck:'Official check',connectionRequired:'connection required',minimumTravel:'minimum travel',cruiseTemplate:'Cruise template',onboardNights:'onboard nights',seaDays:'sea days',portCall:'Port call',embarkation:'Embarkation',disembarkation:'Disembarkation',border:'Border context',schengenExit:'Schengen exit',schengenEntry:'Schengen re-entry',sailingNeeded:'Select a real sailing for ship, operator, times, berth and price.',illustrative:'Illustrative',searchRoutes:'Search routes',filterType:'Travel type',filterRegion:'Region',filterDuration:'Duration',all:'All',noRoutes:'No routes match these filters.',vehicleSection:'Vehicle context (optional)',vehicleType:'Vehicle',registrationCountry:'Registration country',fuelType:'Fuel / powertrain',euroClass:'Euro emissions class',rentalCrossBorder:'Rental approved for cross-border travel',privateCar:'Private car',rentalCar:'Rental car',camper:'Camper',motorcycle:'Motorcycle',otherVehicle:'Other',petrol:'Petrol',diesel:'Diesel',hybrid:'Hybrid',pluginHybrid:'Plug-in hybrid',electric:'Electric',hydrogen:'Hydrogen',unknown:'Unknown',roadRules:'Road context',crossBorder:'Cross-border',urbanAccess:'Urban access checks',vehicleNeeded:'Vehicle context required for toll, LEZ and access checks.',facet_world:'World',facet_round_trip:'Round trip',facet_road_trip:'Road trip',facet_cruise:'Cruise',facet_global:'Global',facet_europe:'Europe',facet_southern_europe:'Southern Europe',facet_italy:'Italy',facet_mediterranean:'Mediterranean',facet_north_africa:'North Africa'},
    de:{routes:'Routen',traveller:'Traveller',flagship:'Flagship',template:'Vorlage',open:'Route öffnen',days:'Tage',stops:'Stopps',segments:'Segmente',global:'Globale Perspektive',contextTitle:'Traveller Context',contextLead:'Passt Einreisehinweise, Sprache, Währung und Startannahmen an. Wird nur auf diesem Gerät gespeichert.',passports:'Passland',secondPassport:'Zweiter Pass (optional)',residence:'Wohnsitz',language:'Sprache',currency:'Währung',origin:'Startstadt / Flughafen',adults:'Erwachsene',children:'Kinder',mobility:'Eingeschränkte Mobilität',save:'Kontext speichern',clear:'Zurücksetzen',notSet:'Nicht gesetzt',currentCheck:'Aktuelle Prüfung erforderlich',routeLibrary:'Routen entdecken',routeLibraryLead:'Eine Plattform für Weltreisen, Rundreisen, Roadtrips, Bahnreisen, Kreuzfahrten und mehr.',editorial:'Redaktionelle Vorlage — Verkehr, Preise und Einreisebedingungen für die eigenen Daten prüfen.',overview:'Routenübersicht',day:'Tag',nights:'Nächte',transport:'Verkehr',verification:'Prüfstatus',backWorld:'Weltreise',private:'Privat auf diesem Gerät. Passnummern, Buchungsreferenzen und Zahlungsdaten werden niemals abgefragt.',sourcedBeta:'Quellen-Beta',sources:'Quellen',lastChecked:'Zuletzt geprüft',publishedFrom:'ab',verified:'Verifiziert',routeEvidence:'Routenbelege',entryGuidance:'Einreisehinweise',officialCheck:'Offiziell prüfen',connectionRequired:'Umstieg einplanen',minimumTravel:'Mindestfahrzeit',cruiseTemplate:'Kreuzfahrt-Vorlage',onboardNights:'Nächte an Bord',seaDays:'Seetage',portCall:'Hafenstopp',embarkation:'Einschiffung',disembarkation:'Ausschiffung',border:'Grenzkontext',schengenExit:'Schengen-Ausreise',schengenEntry:'Schengen-Wiedereinreise',sailingNeeded:'Für Schiff, Reederei, Zeiten, Liegeplatz und Preis muss eine konkrete Abfahrt gewählt werden.',illustrative:'Illustrativ',searchRoutes:'Routen suchen',filterType:'Reiseart',filterRegion:'Region',filterDuration:'Dauer',all:'Alle',noRoutes:'Keine Route passt zu diesen Filtern.',vehicleSection:'Vehicle Context (optional)',vehicleType:'Fahrzeug',registrationCountry:'Zulassungsland',fuelType:'Kraftstoff / Antrieb',euroClass:'Euro-Abgasnorm',rentalCrossBorder:'Mietwagen für Grenzübertritte freigegeben',privateCar:'Privatwagen',rentalCar:'Mietwagen',camper:'Camper',motorcycle:'Motorrad',otherVehicle:'Anderes',petrol:'Benzin',diesel:'Diesel',hybrid:'Hybrid',pluginHybrid:'Plug-in-Hybrid',electric:'Elektro',hydrogen:'Wasserstoff',unknown:'Unbekannt',roadRules:'Straßenkontext',crossBorder:'Grenzübertritt',urbanAccess:'Stadtzufahrt prüfen',vehicleNeeded:'Für Maut-, Umweltzonen- und Zufahrtsprüfungen wird Vehicle Context benötigt.',facet_world:'Weltreise',facet_round_trip:'Rundreise',facet_road_trip:'Roadtrip',facet_cruise:'Kreuzfahrt',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Südeuropa',facet_italy:'Italien',facet_mediterranean:'Mittelmeer',facet_north_africa:'Nordafrika'},
    it:{routes:'Itinerari',traveller:'Viaggiatore',flagship:'Flagship',template:'Modello',open:'Apri itinerario',days:'giorni',stops:'tappe',segments:'tratte',global:'Prospettiva globale',contextTitle:'Profilo viaggiatore',contextLead:'Adatta requisiti d’ingresso, lingua, valuta e partenza. Salvato solo su questo dispositivo.',passports:'Paese del passaporto',secondPassport:'Secondo passaporto (opzionale)',residence:'Residenza',language:'Lingua',currency:'Valuta',origin:'Città / aeroporto di partenza',adults:'Adulti',children:'Bambini',mobility:'Mobilità ridotta',save:'Salva',clear:'Cancella',notSet:'Non impostato',currentCheck:'Verifica attuale richiesta',routeLibrary:'Esplora itinerari',routeLibraryLead:'Una piattaforma per giri del mondo, road trip, treni, crociere e altro.',editorial:'Modello editoriale — verifica trasporti, prezzi e requisiti per le tue date.',overview:'Panoramica',day:'Giorno',nights:'notti',transport:'Trasporto',verification:'Verifica',backWorld:'Giro del mondo',private:'Privato su questo dispositivo. Non chiediamo numeri di passaporto, prenotazioni o dati di pagamento.',sourcedBeta:'Beta con fonti',sources:'Fonti',lastChecked:'Ultima verifica',publishedFrom:'da',verified:'Verificato',routeEvidence:'Fonti del percorso',entryGuidance:'Ingresso',officialCheck:'Verifica ufficiale',connectionRequired:'coincidenza necessaria',minimumTravel:'tempo minimo',cruiseTemplate:'Modello crociera',onboardNights:'notti a bordo',seaDays:'giorni in mare',portCall:'Scalo',embarkation:'Imbarco',disembarkation:'Sbarco',border:'Contesto di frontiera',schengenExit:'Uscita Schengen',schengenEntry:'Rientro Schengen',sailingNeeded:'Seleziona una partenza reale per nave, operatore, orari, ormeggio e prezzo.',illustrative:'Illustrativo',searchRoutes:'Cerca itinerari',filterType:'Tipo di viaggio',filterRegion:'Regione',filterDuration:'Durata',all:'Tutti',noRoutes:'Nessun itinerario corrisponde ai filtri.',vehicleSection:'Profilo veicolo (opzionale)',vehicleType:'Veicolo',registrationCountry:'Paese di immatricolazione',fuelType:'Carburante / propulsione',euroClass:'Classe Euro',rentalCrossBorder:'Noleggio autorizzato oltre confine',privateCar:'Auto privata',rentalCar:'Auto a noleggio',camper:'Camper',motorcycle:'Moto',otherVehicle:'Altro',petrol:'Benzina',diesel:'Diesel',hybrid:'Ibrido',pluginHybrid:'Ibrido plug-in',electric:'Elettrico',hydrogen:'Idrogeno',unknown:'Sconosciuto',roadRules:'Contesto stradale',crossBorder:'Transfrontaliero',urbanAccess:'Verifica accesso urbano',vehicleNeeded:'Il profilo veicolo è necessario per pedaggi, ZFE e accessi.',facet_world:'Giro del mondo',facet_round_trip:'Tour',facet_road_trip:'Road trip',facet_cruise:'Crociera',facet_global:'Globale',facet_europe:'Europa',facet_southern_europe:'Europa meridionale',facet_italy:'Italia',facet_mediterranean:'Mediterraneo',facet_north_africa:'Nord Africa'},
    es:{routes:'Rutas',traveller:'Viajero',flagship:'Flagship',template:'Plantilla',open:'Abrir ruta',days:'días',stops:'paradas',segments:'tramos',global:'Perspectiva global',contextTitle:'Contexto del viajero',contextLead:'Adapta requisitos de entrada, idioma, moneda y origen. Solo se guarda en este dispositivo.',passports:'País del pasaporte',secondPassport:'Segundo pasaporte (opcional)',residence:'Residencia',language:'Idioma',currency:'Moneda',origin:'Ciudad / aeropuerto de salida',adults:'Adultos',children:'Niños',mobility:'Movilidad reducida',save:'Guardar',clear:'Borrar',notSet:'Sin definir',currentCheck:'Revisión actual necesaria',routeLibrary:'Explorar rutas',routeLibraryLead:'Una plataforma para vueltas al mundo, road trips, trenes, cruceros y más.',editorial:'Plantilla editorial — verifica transporte, precios y requisitos para tus fechas.',overview:'Resumen de ruta',day:'Día',nights:'noches',transport:'Transporte',verification:'Verificación',backWorld:'Ruta mundial',private:'Privado en este dispositivo. Nunca pedimos números de pasaporte, reservas ni pagos.',sourcedBeta:'Beta con fuentes',sources:'Fuentes',lastChecked:'Última revisión',publishedFrom:'desde',verified:'Verificado',routeEvidence:'Fuentes de ruta',entryGuidance:'Entrada',officialCheck:'Comprobación oficial',connectionRequired:'conexión necesaria',minimumTravel:'tiempo mínimo',cruiseTemplate:'Plantilla de crucero',onboardNights:'noches a bordo',seaDays:'días de navegación',portCall:'Escala',embarkation:'Embarque',disembarkation:'Desembarque',border:'Contexto fronterizo',schengenExit:'Salida de Schengen',schengenEntry:'Reentrada a Schengen',sailingNeeded:'Selecciona una salida real para barco, operador, horarios, atraque y precio.',illustrative:'Ilustrativo',searchRoutes:'Buscar rutas',filterType:'Tipo de viaje',filterRegion:'Región',filterDuration:'Duración',all:'Todas',noRoutes:'Ninguna ruta coincide con los filtros.',vehicleSection:'Contexto del vehículo (opcional)',vehicleType:'Vehículo',registrationCountry:'País de matriculación',fuelType:'Combustible / propulsión',euroClass:'Clase Euro',rentalCrossBorder:'Alquiler autorizado para cruzar fronteras',privateCar:'Coche privado',rentalCar:'Coche de alquiler',camper:'Camper',motorcycle:'Moto',otherVehicle:'Otro',petrol:'Gasolina',diesel:'Diésel',hybrid:'Híbrido',pluginHybrid:'Híbrido enchufable',electric:'Eléctrico',hydrogen:'Hidrógeno',unknown:'Desconocido',roadRules:'Contexto vial',crossBorder:'Transfronterizo',urbanAccess:'Comprobar acceso urbano',vehicleNeeded:'Se requiere contexto del vehículo para peajes, ZBE y accesos.',facet_world:'Vuelta al mundo',facet_round_trip:'Ruta circular',facet_road_trip:'Road trip',facet_cruise:'Crucero',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Sur de Europa',facet_italy:'Italia',facet_mediterranean:'Mediterráneo',facet_north_africa:'Norte de África'},
    fr:{routes:'Itinéraires',traveller:'Voyageur',flagship:'Flagship',template:'Modèle',open:'Ouvrir',days:'jours',stops:'étapes',segments:'segments',global:'Perspective globale',contextTitle:'Contexte voyageur',contextLead:'Adapte formalités, langue, devise et départ. Stocké uniquement sur cet appareil.',passports:'Pays du passeport',secondPassport:'Deuxième passeport (facultatif)',residence:'Résidence',language:'Langue',currency:'Devise',origin:'Ville / aéroport de départ',adults:'Adultes',children:'Enfants',mobility:'Mobilité réduite',save:'Enregistrer',clear:'Effacer',notSet:'Non défini',currentCheck:'Vérification actuelle requise',routeLibrary:'Explorer les itinéraires',routeLibraryLead:'Une plateforme pour tours du monde, road trips, train, croisières et plus.',editorial:'Modèle éditorial — vérifiez transports, prix et formalités pour vos dates.',overview:'Aperçu',day:'Jour',nights:'nuits',transport:'Transport',verification:'Vérification',backWorld:'Tour du monde',private:'Privé sur cet appareil. Aucun numéro de passeport, référence de réservation ou paiement n’est demandé.',sourcedBeta:'Bêta sourcée',sources:'Sources',lastChecked:'Dernière vérification',publishedFrom:'à partir de',verified:'Vérifié',routeEvidence:'Sources de l’itinéraire',entryGuidance:'Entrée',officialCheck:'Vérification officielle',connectionRequired:'correspondance nécessaire',minimumTravel:'temps minimum',cruiseTemplate:'Modèle croisière',onboardNights:'nuits à bord',seaDays:'jours en mer',portCall:'Escale',embarkation:'Embarquement',disembarkation:'Débarquement',border:'Contexte frontalier',schengenExit:'Sortie Schengen',schengenEntry:'Rentrée Schengen',sailingNeeded:'Sélectionnez un départ réel pour le navire, l’opérateur, les horaires, le quai et le prix.',illustrative:'Illustratif',searchRoutes:'Rechercher des itinéraires',filterType:'Type de voyage',filterRegion:'Région',filterDuration:'Durée',all:'Tous',noRoutes:'Aucun itinéraire ne correspond aux filtres.',vehicleSection:'Contexte véhicule (facultatif)',vehicleType:'Véhicule',registrationCountry:'Pays d’immatriculation',fuelType:'Carburant / motorisation',euroClass:'Classe Euro',rentalCrossBorder:'Location autorisée à franchir les frontières',privateCar:'Voiture privée',rentalCar:'Voiture de location',camper:'Camping-car',motorcycle:'Moto',otherVehicle:'Autre',petrol:'Essence',diesel:'Diesel',hybrid:'Hybride',pluginHybrid:'Hybride rechargeable',electric:'Électrique',hydrogen:'Hydrogène',unknown:'Inconnu',roadRules:'Contexte routier',crossBorder:'Transfrontalier',urbanAccess:'Vérifier l’accès urbain',vehicleNeeded:'Le contexte véhicule est requis pour péages, ZFE et accès.',facet_world:'Tour du monde',facet_round_trip:'Circuit',facet_road_trip:'Road trip',facet_cruise:'Croisière',facet_global:'Mondial',facet_europe:'Europe',facet_southern_europe:'Europe du Sud',facet_italy:'Italie',facet_mediterranean:'Méditerranée',facet_north_africa:'Afrique du Nord'},
    pt:{routes:'Rotas',traveller:'Viajante',flagship:'Flagship',template:'Modelo',open:'Abrir rota',days:'dias',stops:'paradas',segments:'trechos',global:'Perspectiva global',contextTitle:'Contexto do viajante',contextLead:'Adapta entrada, idioma, moeda e origem. Guardado apenas neste dispositivo.',passports:'País do passaporte',secondPassport:'Segundo passaporte (opcional)',residence:'Residência',language:'Idioma',currency:'Moeda',origin:'Cidade / aeroporto de partida',adults:'Adultos',children:'Crianças',mobility:'Mobilidade reduzida',save:'Salvar',clear:'Limpar',notSet:'Não definido',currentCheck:'Verificação atual necessária',routeLibrary:'Explorar rotas',routeLibraryLead:'Uma plataforma para voltas ao mundo, road trips, trem, cruzeiros e mais.',editorial:'Modelo editorial — verifique transporte, preços e entrada para suas datas.',overview:'Visão geral',day:'Dia',nights:'noites',transport:'Transporte',verification:'Verificação',backWorld:'Rota mundial',private:'Privado neste dispositivo. Nunca pedimos número de passaporte, referência de reserva ou pagamento.',sourcedBeta:'Beta com fontes',sources:'Fontes',lastChecked:'Última verificação',publishedFrom:'a partir de',verified:'Verificado',routeEvidence:'Fontes da rota',entryGuidance:'Entrada',officialCheck:'Verificação oficial',connectionRequired:'conexão necessária',minimumTravel:'tempo mínimo',cruiseTemplate:'Modelo de cruzeiro',onboardNights:'noites a bordo',seaDays:'dias no mar',portCall:'Escala',embarkation:'Embarque',disembarkation:'Desembarque',border:'Contexto de fronteira',schengenExit:'Saída de Schengen',schengenEntry:'Reentrada em Schengen',sailingNeeded:'Selecione uma partida real para navio, operadora, horários, cais e preço.',illustrative:'Ilustrativo',searchRoutes:'Pesquisar rotas',filterType:'Tipo de viagem',filterRegion:'Região',filterDuration:'Duração',all:'Todas',noRoutes:'Nenhuma rota corresponde aos filtros.',vehicleSection:'Contexto do veículo (opcional)',vehicleType:'Veículo',registrationCountry:'País de matrícula',fuelType:'Combustível / motorização',euroClass:'Classe Euro',rentalCrossBorder:'Aluguel autorizado para cruzar fronteiras',privateCar:'Carro particular',rentalCar:'Carro alugado',camper:'Motorhome',motorcycle:'Moto',otherVehicle:'Outro',petrol:'Gasolina',diesel:'Diesel',hybrid:'Híbrido',pluginHybrid:'Híbrido plug-in',electric:'Elétrico',hydrogen:'Hidrogênio',unknown:'Desconhecido',roadRules:'Contexto rodoviário',crossBorder:'Transfronteiriço',urbanAccess:'Verificar acesso urbano',vehicleNeeded:'O contexto do veículo é necessário para portagens, ZBE e acessos.',facet_world:'Volta ao mundo',facet_round_trip:'Roteiro circular',facet_road_trip:'Road trip',facet_cruise:'Cruzeiro',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Sul da Europa',facet_italy:'Itália',facet_mediterranean:'Mediterrâneo',facet_north_africa:'Norte da África'}
  };

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
  const sourceMap = () => new Map((currentTrip?.sources||[]).map(s=>[s.id,s]));
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

  function profileDefaults(){
    return {passports:[],residenceCountry:null,language:locale,currency:'EUR',origin:null,party:{adults:1,children:0},accessibility:{reducedMobility:false},vehicle:null};
  }
  function loadProfile(){
    try{return {...profileDefaults(),...JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')}}catch{return profileDefaults()}
  }
  function saveProfile(profile){localStorage.setItem(PROFILE_KEY,JSON.stringify(profile))}

  async function waitForCore(max=70){
    for(let i=0;i<max;i++){
      if(window.__ONE_WORLD_ROUTE_APP__ && window.__ONE_WORLD_ROUTE_GLOBE__) return true;
      await sleep(80);
    }
    return false;
  }

  function buildTripUrl(id){
    const p = new URLSearchParams(location.search);
    if(id === catalog.defaultTripId) p.delete('trip'); else p.set('trip',id);
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
    wrap.innerHTML=`<button id="platformRouteBtn" class="platform-pill" type="button"><span class="platform-pill-dot"></span><span>${esc(t('routes'))}</span></button><button id="platformTravellerBtn" class="platform-pill secondary" type="button">${esc(t('traveller'))}</button>`;
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
    const kinds=[...new Set(catalog.trips.map(r=>r.kind))].sort();
    const regions=[...new Set(catalog.trips.flatMap(r=>r.discovery?.regions||[]))].sort();
    modal.innerHTML=`<div class="platform-modal-card route-library-card glass"><button class="platform-x" aria-label="Close">×</button><div class="platform-eyebrow">ONE WORLD ROUTE</div><h2>${esc(t('routeLibrary'))}</h2><p class="platform-lead">${esc(t('routeLibraryLead'))}</p><div class="platform-route-filters"><label class="route-search"><span>${esc(t('searchRoutes'))}</span><input id="platformRouteSearch" type="search" autocomplete="off" placeholder="${esc(t('searchRoutes'))}"></label><label><span>${esc(t('filterType'))}</span><select id="platformRouteKind"><option value="">${esc(t('all'))}</option>${kinds.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterRegion'))}</span><select id="platformRouteRegion"><option value="">${esc(t('all'))}</option>${regions.map(v=>`<option value="${esc(v)}">${esc(facetLabel(v))}</option>`).join('')}</select></label><label><span>${esc(t('filterDuration'))}</span><select id="platformRouteDuration"><option value="">${esc(t('all'))}</option><option value="7-14">7–14 ${esc(t('days'))}</option><option value="15-30">15–30 ${esc(t('days'))}</option><option value="31-89">31–89 ${esc(t('days'))}</option><option value="90-plus">90+ ${esc(t('days'))}</option></select></label></div><div id="platformRouteResults" class="platform-route-grid"></div></div>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    const render=()=>{
      const q=String($('#platformRouteSearch',modal)?.value||'').trim().toLowerCase();
      const kind=$('#platformRouteKind',modal)?.value||'',region=$('#platformRouteRegion',modal)?.value||'',duration=$('#platformRouteDuration',modal)?.value||'';
      const filtered=catalog.trips.filter(r=>{
        const hay=[local(r.title),local(r.subtitle),r.kind,...(r.discovery?.regions||[]),...(r.discovery?.themes||[]),...(r.discovery?.modes||[])].join(' ').toLowerCase();
        return (!q||hay.includes(q))&&(!kind||r.kind===kind)&&(!region||(r.discovery?.regions||[]).includes(region))&&(!duration||r.discovery?.durationBand===duration);
      });
      const host=$('#platformRouteResults',modal);
      host.innerHTML=filtered.length?filtered.map(routeCard).join(''):`<div class="platform-no-routes">${esc(t('noRoutes'))}</div>`;
      // Route buttons are handled by event delegation below so filtering/re-rendering stays reliable.
    };
    const results=$('#platformRouteResults',modal);
    results.addEventListener('click',e=>{
      const button=e.target.closest('[data-platform-trip]');
      if(!button||!results.contains(button))return;
      e.preventDefault();
      setQueryTrip(button.dataset.platformTrip);
    });
    ['platformRouteSearch','platformRouteKind','platformRouteRegion','platformRouteDuration'].forEach(id=>$('#'+id,modal)?.addEventListener(id==='platformRouteSearch'?'input':'change',render));
    render();
  }

  function routeCard(r){
    const metrics=[];
    if(r.metrics?.days)metrics.push(`${r.metrics.days} ${t('days')}`);
    if(r.metrics?.stops)metrics.push(`${r.metrics.stops} ${t('stops')}`);
    if(r.metrics?.countries)metrics.push(`${r.metrics.countries} ${r.metrics.countries===1?'country':'countries'}`);
    if(r.metrics?.nights)metrics.push(`${r.metrics.nights} ${t('onboardNights')}`);
    if(r.metrics?.seaDays)metrics.push(`${r.metrics.seaDays} ${t('seaDays')}`);
    return `<article class="platform-route-card ${r.id===currentTripMeta?.id?'active':''}"><div class="platform-route-top"><span>${esc(facetLabel(r.kind))}</span><b>${esc(r.id===catalog.defaultTripId?t('flagship'):(r.status==='sourced-beta'?t('sourcedBeta'):(r.kind==='cruise'?t('cruiseTemplate'):t('template'))))}</b></div><h3>${esc(local(r.title))}</h3><p>${esc(local(r.subtitle))}</p><div class="platform-route-metrics">${metrics.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button type="button" data-platform-trip="${esc(r.id)}">${esc(t('open'))} →</button></article>`;
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

  function placeMap(trip){return new Map((trip.places||[]).map(p=>[p.id,p]))}
  function stopMap(trip){return new Map((trip.stops||[]).map(s=>[s.id,s]))}
  function stopPlace(trip,stop){return placeMap(trip).get(stop.placeId)}

  function applyTripShell(){
    document.body.classList.add('platform-regional-trip');
    document.documentElement.lang=locale;
    document.title=`${local(currentTrip.title)} — ONE WORLD ROUTE`;
    const meta=$('meta[name="description"]');if(meta)meta.content=local(currentTrip.summary);
    const brandSmall=$('.brand small');if(brandSmall)brandSmall.textContent=local(currentTrip.title);
    const hero=$('.hero-copy');
    if(hero){
      hero.innerHTML=`<div class="eyebrow"><span class="live-dot"></span>${esc(currentTrip.kind)} · ${currentTrip.planning?.days||''} ${esc(t('days'))}</div><h1>${esc(local(currentTrip.title))}</h1><p>${esc(local(currentTrip.summary))}</p><div class="platform-template-note">${esc(t('editorial'))}</div>`;
    }
    const kpis=$('#topKpis');
    if(kpis)kpis.innerHTML=`<div class="kpi"><b>${currentTrip.planning?.days||'—'}</b><span>${esc(t('days'))}</span></div><div class="kpi"><b>${currentTrip.stops?.length||0}</b><span>${esc(t('stops'))}</span></div><div class="kpi"><b>${currentTrip.segments?.length||0}</b><span>${esc(t('segments'))}</span></div>`;
    buildLeftNavigation();
    buildChapterRail();
    replaceTimeline();
    renderTripOverview();
  }

  function buildLeftNavigation(){
    const panel=$('#leftPanel');if(!panel)return;
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
    rail.innerHTML=(currentTrip.chapters||[]).map((c,i)=>`<button type="button" data-trip-chapter="${i}" class="${i===0?'active':''}"><span class="phase-dot"></span>${esc(local(c.title))}</button>`).join('');
    $$('[data-trip-chapter]',rail).forEach(b=>b.onclick=()=>{
      $$('[data-trip-chapter]',rail).forEach(x=>x.classList.toggle('active',x===b));
      const c=currentTrip.chapters[Number(b.dataset.tripChapter)],idx=currentTrip.stops.findIndex(s=>s.id===c.stopIds?.[0]);if(idx>=0)selectStop(idx,true);
    });
  }

  function replaceTimeline(){
    const oldPlay=$('#playBtn');if(oldPlay){const n=oldPlay.cloneNode(true);n.id='playBtn';n.textContent='▶';oldPlay.replaceWith(n);n.onclick=togglePlayback}
    const oldRange=$('#routeRange');if(oldRange){const n=oldRange.cloneNode(true);n.id='routeRange';n.min='1';n.max=String(Math.max(1,currentTrip.segments.length));n.value='1';n.style.setProperty('--range-progress','0%');oldRange.replaceWith(n);n.oninput=()=>selectSegmentIndex(Number(n.value)-1,true)}
    const speed=$('.speed-control');if(speed)speed.style.display='none';
    updateTimelineRegional();
  }

  function updateTimelineRegional(){
    const s=currentTrip.segments[selectedSegmentIndex];if(!s)return;
    const stops=stopMap(currentTrip),places=placeMap(currentTrip),a=places.get(stops.get(s.fromStopId)?.placeId),b=places.get(stops.get(s.toStopId)?.placeId);
    const title=$('#timelineTitle');if(title)title.textContent=`${local(a?.name)} → ${local(b?.name)}`;
    const meta=$('#timelineMeta');if(meta)meta.textContent=`${t('segments')} ${s.sequence} / ${currentTrip.segments.length} · ${String(s.transport?.mode||'').replaceAll('-',' ')}`;
    const range=$('#routeRange');if(range){range.value=String(selectedSegmentIndex+1);range.style.setProperty('--range-progress',`${currentTrip.segments.length<=1?100:(selectedSegmentIndex/(currentTrip.segments.length-1))*100}%`)}
    const labels=$$('.range-labels span');if(labels[0])labels[0].innerHTML=`<b>START</b> · ${esc(local(stopPlace(currentTrip,currentTrip.stops[0])?.name))}`;if(labels[1])labels[1].textContent=`${currentTrip.planning?.days||'—'} ${t('days')}`;if(labels[2])labels[2].innerHTML=`<b>FINISH</b> · ${esc(local(stopPlace(currentTrip,currentTrip.stops.at(-1))?.name))}`;
  }

  function togglePlayback(){
    const btn=$('#playBtn');if(playTimer){clearInterval(playTimer);playTimer=null;if(btn)btn.textContent='▶';return}
    if(btn)btn.textContent='Ⅱ';playTimer=setInterval(()=>{if(selectedSegmentIndex>=currentTrip.segments.length-1){clearInterval(playTimer);playTimer=null;if(btn)btn.textContent='▶';return}selectSegmentIndex(selectedSegmentIndex+1,true)},1400);
  }

  function routeGeometry(){
    const stops=stopMap(currentTrip),places=placeMap(currentTrip);
    return currentTrip.segments.map((s,i)=>{const a=places.get(stops.get(s.fromStopId)?.placeId),b=places.get(stops.get(s.toStopId)?.placeId);return {...s,_index:i,start:a?.coordinates,end:b?.coordinates,fromName:local(a?.name),toName:local(b?.name)}}).filter(x=>x.start&&x.end);
  }

  function renderRegionalGlobe(){
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;if(!globe)return;
    const arcs=routeGeometry();
    try{
      globe.arcsData(arcs).arcStartLat(d=>d.start.lat).arcStartLng(d=>d.start.lng).arcEndLat(d=>d.end.lat).arcEndLng(d=>d.end.lng).arcAltitude(0.06).arcStroke(d=>d._index===selectedSegmentIndex?0.75:0.35).arcColor(d=>d._index===selectedSegmentIndex?'#59ddff':'rgba(113,151,190,.75)').arcDashLength(1).arcDashGap(0).onArcClick(d=>selectSegmentIndex(d._index,true));
      const places=[...placeMap(currentTrip).values()];
      globe.pointsData(places).pointLat(d=>d.coordinates.lat).pointLng(d=>d.coordinates.lng).pointAltitude(0.016).pointRadius(0.13).pointColor(()=> '#dff8ff').onPointClick(p=>{const idx=currentTrip.stops.findIndex(s=>s.placeId===p.id);if(idx>=0)selectStop(idx,true)});
      if(typeof globe.labelsData==='function')globe.labelsData(places).labelLat(d=>d.coordinates.lat).labelLng(d=>d.coordinates.lng).labelText(d=>local(d.name)).labelColor(()=> 'rgba(230,247,255,.94)').labelSize(1.15).labelDotRadius(0.15).labelAltitude(0.02);
      if(globe.controls()){globe.controls().autoRotate=false;globe.controls().enableZoom=true}
      const c=currentTrip.rendering?.camera||{lat:43.5,lng:13.5,altitude:.72};globe.pointOfView(c,900);
    }catch(e){console.warn('Regional globe render failed',e)}
  }

  function selectSegmentIndex(index,focus=false){
    selectedSegmentIndex=Math.max(0,Math.min(currentTrip.segments.length-1,index));
    $$('.platform-stop').forEach(x=>x.classList.remove('active'));
    renderRegionalGlobe();updateTimelineRegional();renderSegmentDetail(currentTrip.segments[selectedSegmentIndex]);
    if(focus)focusSegment(currentTrip.segments[selectedSegmentIndex]);
  }

  function selectStop(index,focus=false){
    const stop=currentTrip.stops[index],p=stopPlace(currentTrip,stop);if(!stop||!p)return;
    $$('.platform-stop').forEach((x,i)=>x.classList.toggle('active',i===index));
    renderStopDetail(stop,p);
    if(index<currentTrip.segments.length){selectedSegmentIndex=index;updateTimelineRegional();renderRegionalGlobe()}
    if(focus)window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView({lat:p.coordinates.lat,lng:p.coordinates.lng,altitude:.48},650);
  }

  function focusSegment(seg){
    const sm=stopMap(currentTrip),pm=placeMap(currentTrip),a=pm.get(sm.get(seg.fromStopId)?.placeId),b=pm.get(sm.get(seg.toStopId)?.placeId);if(!a||!b)return;
    let lng=(a.coordinates.lng+b.coordinates.lng)/2;let lat=(a.coordinates.lat+b.coordinates.lat)/2;window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView({lat,lng,altitude:.52},650);
  }

  function renderTripOverview(){
    const title=$('#detailTitle');if(title)title.textContent=local(currentTrip.title);
    const eye=$('#detailEyebrow');if(eye)eye.textContent=t('overview');
    const tabs=$('#detailTabs');if(tabs)tabs.style.display='none';
    const content=$('#detailContent');if(!content)return;
    const sourced=currentTrip.segments.filter(s=>(s.verification?.sourceIds||[]).length).length,verified=currentTrip.segments.filter(s=>s.verification?.status==='verified').length;
    const entry=currentTrip.entryGuidance,entrySource=entry?sourceMap().get(entry.officialResolverSourceId):null;
    const cruise=currentTrip.cruise;
    const roadTrip=currentTrip.roadTrip;
    const profile=loadProfile();
    const cruiseCards=cruise?`<div class="data-card"><span>${esc(t('onboardNights'))}</span><b>${cruise.nights??'—'}</b></div><div class="data-card"><span>${esc(t('seaDays'))}</span><b>${cruise.seaDays??0}</b></div>`:'';
    const vehiclePrompt=roadTrip?.vehicleContextRequired&&!profile.vehicle?`<div class="platform-cruise-note">${esc(t('vehicleNeeded'))}</div>`:'';
    content.innerHTML=`<div class="overview-number">${currentTrip.planning?.days||'—'}<small> ${esc(t('days'))}</small></div><p class="detail-copy">${esc(local(currentTrip.summary))}</p><div class="data-grid"><div class="data-card"><span>${esc(t('stops'))}</span><b>${currentTrip.stops.length}</b></div>${cruiseCards}<div class="data-card"><span>${esc(t('routeEvidence'))}</span><b>${sourced}/${currentTrip.segments.length}</b></div><div class="data-card"><span>${esc(t('verified'))}</span><b>${verified}/${currentTrip.segments.length}</b></div><div class="data-card"><span>Currency</span><b>${esc(currentTrip.planning?.currency||'—')}</b></div></div>${vehiclePrompt}${cruise?.requiresSailingSelection?`<div class="platform-cruise-note">${esc(t('sailingNeeded'))}</div>`:''}${entry?`<div class="platform-entry"><b>${esc(t('entryGuidance'))}</b><p>${esc(local(entry.message))}</p>${entrySource?`<a href="${esc(entrySource.url)}" target="_blank" rel="noopener noreferrer">${esc(t('officialCheck'))} →</a>`:''}</div>`:''}<button class="platform-context-inline" id="regionalTravellerBtn" type="button">${esc(t('traveller'))} →</button>`;
    $('#regionalTravellerBtn')?.addEventListener('click',openTraveller);
  }

  function renderStopDetail(stop,p){
    const title=$('#detailTitle');if(title)title.textContent=local(p.name);
    const eye=$('#detailEyebrow');if(eye)eye.textContent=`STOP ${stop.sequence} · ${p.type}`;
    const content=$('#detailContent');if(!content)return;
    const call=stop.call;
    const callLabel=call?.kind==='embarkation'?t('embarkation'):(call?.kind==='disembarkation'?t('disembarkation'):(call?t('portCall'):null));
    const portRefs=p.port?.sourceIds||[];
    content.innerHTML=`<div class="overview-number">${stop.sequence}<small> / ${currentTrip.stops.length}</small></div><div class="data-grid"><div class="data-card"><span>${esc(t('day'))}</span><b>${stop.dayStart}${stop.dayEnd!==stop.dayStart?`–${stop.dayEnd}`:''}</b></div>${callLabel?`<div class="data-card"><span>${esc(t('portCall'))}</span><b>${esc(callLabel)}</b></div>`:''}<div class="data-card"><span>Type</span><b>${esc(p.type)}</b></div><div class="data-card"><span>Country</span><b>${esc(p.countryCode||'—')}</b></div></div>${currentTrip.kind==='cruise'?'<div class="platform-cruise-note">'+esc(t('sailingNeeded'))+'</div>':`<p class="detail-copy">${esc(t('editorial'))}</p>`}${portRefs.length?`<div class="platform-evidence"><div class="ops-mini-title">${esc(t('sources'))}</div>${sourceLinks(portRefs)}</div>`:''}`;
  }

  function renderSegmentDetail(s){
    const sm=stopMap(currentTrip),pm=placeMap(currentTrip),a=pm.get(sm.get(s.fromStopId)?.placeId),b=pm.get(sm.get(s.toStopId)?.placeId);
    const title=$('#detailTitle');if(title)title.textContent=`${local(a?.name)} → ${local(b?.name)}`;
    const eye=$('#detailEyebrow');if(eye)eye.textContent=`SEGMENT ${s.sequence} / ${currentTrip.segments.length}`;
    const content=$('#detailContent');if(!content)return;
    const stages=(s.transport?.stages||[]).map((stage,i)=>`<article class="platform-stage"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(stage.operator||String(stage.mode||'').replaceAll('-',' '))}</b><small>${esc(stage.from||'')} → ${esc(stage.to||'')}</small><em>${esc(durationLabel(stage))} · ${esc(costLabel(stage))}</em></div></article>`).join('');
    const refs=[...(s.verification?.sourceIds||[]),...(s.transport?.stages||[]).flatMap(x=>x.sourceIds||[])];
    const road=s.roadContext;
    const profile=loadProfile();
    const roadPanel=road?`<div class="platform-road-context"><div><span>${esc(t('roadRules'))}</span><b>${road.crossBorder?esc(t('crossBorder')):esc(road.fromCountry||'')}</b></div><div><span>${esc(t('urbanAccess'))}</span><b>${esc((road.urbanAccessChecks||[]).join(' · ')||'—')}</b></div>${!profile.vehicle?`<p>${esc(t('vehicleNeeded'))}</p>`:''}</div>`:'';
    const cruise=s.cruise;
    const border=s.borderContext;
    const borderLabel=border?.zoneTransition==='schengen-exit'?t('schengenExit'):(border?.zoneTransition==='schengen-entry'?t('schengenEntry'):border?.zoneTransition);
    const cruisePanel=cruise?`<div class="platform-cruise-leg"><div><span>${esc(t('onboardNights'))}</span><b>${cruise.onboardNights??0}</b></div><div><span>${esc(t('seaDays'))}</span><b>${(cruise.seaDayNumbers||[]).join(', ')||'—'}</b></div></div>`:'';
    const borderPanel=border&&border.zoneTransition!=='domestic'?`<div class="platform-border ${border.personalizationRequired?'requires-context':''}"><b>${esc(t('border'))}</b><span>${esc(borderLabel||'—')} · ${esc(border.fromCountry)} → ${esc(border.toCountry)}</span></div>`:'';
    content.innerHTML=`<div class="data-grid"><div class="data-card"><span>${esc(t('transport'))}</span><b>${esc(String(s.transport?.mode||'—').replaceAll('-',' '))}</b></div><div class="data-card"><span>${esc(t('verification'))}</span><b class="${s.verification?.status==='verified'?'evidence-ok':(s.verification?.status==='illustrative'?'evidence-info':'evidence-watch')}">${esc(verificationLabel(s))}</b></div><div class="data-card"><span>Duration</span><b>${esc(durationLabel(s.planning))}</b></div><div class="data-card"><span>Cost</span><b>${esc(costLabel(s.planning))}</b></div></div>${cruisePanel}${borderPanel}${roadPanel}${stages?`<div class="platform-stages">${stages}</div>`:''}${s.verification?.notes?`<div class="op-callout">${esc(s.verification.notes)}</div>`:''}${refs.length?`<div class="platform-evidence"><div class="ops-mini-title">${esc(t('sources'))}</div>${sourceLinks(refs)}</div>`:''}`;
  }

  async function activateRegionalTrip(meta){
    currentTripMeta=meta;
    currentTrip=await fetch(meta.dataset,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Trip dataset '+r.status);return r.json()});
    await waitForCore();
    applyTripShell();
    renderRegionalGlobe();
    setTimeout(renderRegionalGlobe,500);
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
    }catch(e){console.warn('ONE WORLD ROUTE platform layer unavailable',e)}
  }

  window.ONE_WORLD_PLATFORM={openRoutes:openRouteLibrary,openTraveller,getProfile:loadProfile,getTrip:()=>currentTripMeta,buildTripUrl};
  window.addEventListener('DOMContentLoaded',init);
})();
