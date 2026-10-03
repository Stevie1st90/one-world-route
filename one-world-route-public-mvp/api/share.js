const route=require('../data/public-route.json');
const geo=require('../data/country-centroids.json');
const platform=require('../data/platform/trips.json');
const collections=require('../data/platform/collections.json');
const tripIndex=require('../data/platform/trip-index.json');
const Discovery=require('../platform/discovery.js');
const {messages}=require('../platform/i18n.js');
const mediaManifest=require('../data/platform/media-delivery.json');
const mediaById=new Map((mediaManifest.journeys||[]).map(j=>[j.id,j]));
const indexById=new Map(tripIndex.trips.map(t=>[t.id,t]));
const facetLabel=(value,lang)=>messages[lang]?.['facet_'+String(value).replaceAll('-','_')]||humanize(value);
const coverFor=trip=>{const m=mediaById.get(trip.id);return m?.journeyCover||m?.autoRouteVisual;};
const coverMarkup=(trip,lang,hero=false)=>{const cover=coverFor(trip);const asset=cover?.asset;if(!asset||!/^\.\/assets\/[a-z0-9_./-]+$/i.test(asset)||asset.split('/').includes('..'))return '';return '<img class="'+(hero?'journey-cover':'collection-cover')+'" src="/'+esc(asset.slice(2))+'"'+(cover.srcset?' srcset="'+esc(cover.srcset.replaceAll('./assets/','/assets/'))+'" sizes="'+(hero?'(max-width:1040px) 96vw, 1040px':'(max-width:720px) 96vw, 510px')+'"':'')+' alt="'+esc(localized(cover.alt,lang)||localized(trip.title,lang))+'" loading="'+(hero?'eager':'lazy')+'" width="1600" height="900">';};
const readiness=require('../data/flagship-readiness.json');

const ERROR_TEXT={"en": {"title": "Journey not found", "lead": "This page is unavailable. Discover other journeys.", "back": "Discover journeys"}, "de": {"title": "Reise nicht gefunden", "lead": "Diese Seite ist nicht verfügbar. Entdecke andere Reisen.", "back": "Reisen entdecken"}, "it": {"title": "Viaggio non trovato", "lead": "Questa pagina non è disponibile. Scopri altri viaggi.", "back": "Scopri viaggi"}, "es": {"title": "Viaje no encontrado", "lead": "Esta página no está disponible. Descubre otros viajes.", "back": "Descubre viajes"}, "fr": {"title": "Voyage introuvable", "lead": "Cette page est indisponible. Découvrez d’autres voyages.", "back": "Découvrir les voyages"}, "pt": {"title": "Viagem não encontrada", "lead": "Esta página está indisponível. Explore outras viagens.", "back": "Descobrir viagens"}};
const SUPPORTED_LANGS=Array.isArray(platform.supportedLocales)&&platform.supportedLocales.length?platform.supportedLocales:['en'];
const display=new Intl.DisplayNames(['en'],{type:'region'});
const byName=new Map(geo.map(c=>[c.name,c]));
const en=n=>{const c=byName.get(n);try{return c?.cca2?display.of(c.cca2):n}catch{return n}};
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const localized=(v,lang='en')=>typeof v==='string'?v:(v?.[lang]||v?.en||Object.values(v||{})[0]||'');
const safeLang=v=>SUPPORTED_LANGS.includes(String(v||'').toLowerCase())?String(v).toLowerCase():'en';
const humanize=value=>String(value||'').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
const tripTarget=(trip,lang)=>{
  const p=new URLSearchParams();
  p.set('trip',trip.id);
  p.set('lang',lang);
  return '/?'+p.toString();
};
const alternateLinks=(origin,trip)=>[
  ...SUPPORTED_LANGS.map(lang=>'<link rel="alternate" hreflang="'+lang+'" href="'+esc(origin+'/'+lang+'/trip/'+trip.slug)+'">'),
  '<link rel="alternate" hreflang="x-default" href="'+esc(origin+'/trip/'+trip.slug)+'">'
].join('');
const collectionTarget=(collection,lang)=>{
  const p=new URLSearchParams();
  p.set('collection',collection.id);
  p.set('lang',lang);
  return '/?'+p.toString();
};
const collectionAlternateLinks=(origin,collection)=>[
  ...SUPPORTED_LANGS.map(lang=>'<link rel="alternate" hreflang="'+lang+'" href="'+esc(origin+'/'+lang+'/journeys/'+collection.id)+'">'),
  '<link rel="alternate" hreflang="x-default" href="'+esc(origin+'/journeys/'+collection.id)+'">'
].join('');
const collectionMatches=Discovery.collectionMatches;

const TAXONOMY_REGIONS=new Set(platform.trips.flatMap(t=>(t.discovery?.regions||[]).filter(r=>r!=='global')));
const TAXONOMY_FACETS=new Set(['kind','region','duration','theme','mode']);
const taxonomyMatches=(trip,facet,value)=>{
  if(!trip)return false;
  if(facet==='kind')return trip.kind===value;
  if(facet==='region')return TAXONOMY_REGIONS.has(value)&&(trip.discovery?.regions||[]).includes(value);
  if(facet==='duration')return trip.discovery?.durationBand===value;
  if(facet==='theme')return (trip.discovery?.themes||[]).includes(value);
  if(facet==='mode')return (trip.discovery?.modes||[]).includes(value);
  return false;
};
const taxonomyTrips=(facet,value)=>platform.trips.filter(trip=>taxonomyMatches(trip,facet,value));
const taxonomyExists=(facet,value)=>TAXONOMY_FACETS.has(facet)&&taxonomyTrips(facet,value).length>=2;
const TAXONOMY_LABELS={
  en:{kind:'{value} journeys',region:'Journeys in {value}',duration:'Journeys for {value} days',values:{'road-trip':'Road trip',rail:'Rail',cruise:'Cruise',camper:'Camper','island-hopping':'Island hopping','round-trip':'Round trip',multimodal:'Multimodal',europe:'Europe',asia:'Asia',africa:'Africa','north-america':'North America','south-america':'South America',oceania:'Oceania','central-america':'Central America','7-14':'7–14','15-30':'15–30','90-plus':'90+'}},
  de:{kind:'{value}-Reisen',region:'Reisen in {value}',duration:'Reisen für {value} Tage',values:{'road-trip':'Roadtrip',rail:'Bahn',cruise:'Kreuzfahrt',camper:'Camper','island-hopping':'Inselhopping','round-trip':'Rundreise',multimodal:'Multimodal',europe:'Europa',asia:'Asien',africa:'Afrika','north-america':'Nordamerika','south-america':'Südamerika',oceania:'Ozeanien','central-america':'Mittelamerika','7-14':'7–14','15-30':'15–30','90-plus':'90+'}},
  it:{kind:'Viaggi {value}',region:'Viaggi in {value}',duration:'Viaggi di {value} giorni',values:{'road-trip':'on the road',rail:'in treno',cruise:'in crociera',camper:'in camper','island-hopping':'tra isole','round-trip':'ad anello',multimodal:'multimodali',europe:'Europa',asia:'Asia',africa:'Africa','north-america':'Nord America','south-america':'Sud America',oceania:'Oceania','central-america':'America Centrale','7-14':'7–14','15-30':'15–30','90-plus':'90+'}},
  es:{kind:'Viajes {value}',region:'Viajes por {value}',duration:'Viajes de {value} días',values:{'road-trip':'por carretera',rail:'en tren',cruise:'en crucero',camper:'en camper','island-hopping':'entre islas','round-trip':'circulares',multimodal:'multimodales',europe:'Europa',asia:'Asia',africa:'África','north-america':'Norteamérica','south-america':'Sudamérica',oceania:'Oceanía','central-america':'Centroamérica','7-14':'7–14','15-30':'15–30','90-plus':'90+'}},
  fr:{kind:'Voyages {value}',region:'Voyages en {value}',duration:'Voyages de {value} jours',values:{'road-trip':'en road trip',rail:'en train',cruise:'en croisière',camper:'en van','island-hopping':'d’île en île','round-trip':'en boucle',multimodal:'multimodaux',europe:'Europe',asia:'Asie',africa:'Afrique','north-america':'Amérique du Nord','south-america':'Amérique du Sud',oceania:'Océanie','central-america':'Amérique centrale','7-14':'7–14','15-30':'15–30','90-plus':'90+'}},
  pt:{kind:'Viagens {value}',region:'Viagens na {value}',duration:'Viagens de {value} dias',values:{'road-trip':'de carro',rail:'de trem',cruise:'de cruzeiro',camper:'de camper','island-hopping':'entre ilhas','round-trip':'em circuito',multimodal:'multimodais',europe:'Europa',asia:'Ásia',africa:'África','north-america':'América do Norte','south-america':'América do Sul',oceania:'Oceania','central-america':'América Central','7-14':'7–14','15-30':'15–30','90-plus':'90+'}}
};
const taxonomyLabel=(facet,value,lang='en')=>{
  const dict=TAXONOMY_LABELS[lang]||TAXONOMY_LABELS.en;
  const label=dict.values[value]||facetLabel(value,lang);
  return String(dict[facet]||dict.kind||'{value}').replace('{value}',label);
};
const taxonomyTarget=(facet,value,lang)=>{
  const p=new URLSearchParams();
  if(facet==='kind')p.set('kind',value);
  if(facet==='region')p.set('region',value);
  if(facet==='duration')p.set('duration',value);
  if(facet==='theme'||facet==='mode')p.set(facet,value);
  p.set('lang',lang);
  return '/?'+p.toString();
};
const taxonomyAlternateLinks=(origin,facet,value)=>[
  ...SUPPORTED_LANGS.map(lang=>'<link rel="alternate" hreflang="'+lang+'" href="'+esc(origin+'/'+lang+'/discover/'+facet+'/'+value)+'">'),
  '<link rel="alternate" hreflang="x-default" href="'+esc(origin+'/discover/'+facet+'/'+value)+'">'
].join('');

const PAGE_TEXT={
  en:{open:'Open interactive route',overview:'Overview',itinerary:'Itinerary',planning:'Practical planning',evidence:'Evidence',sources:'Sources',days:'days',nights:'nights',stops:'stops',legs:'legs',countries:'countries',modes:'Transport',pace:'Pace',seasons:'Seasons',knownTransport:'Known published transport minimum',latestCheck:'Latest evidence check',sourced:'sourced segments',verified:'verified segments',unknown:'Not yet published',readiness:'Journey planning snapshot',readinessLead:'The public route model is valid, but operational departure work is still in progress.',dataAsOf:'Data as of',workQueue:'Current operational work queue',interactiveLead:'Open the interactive globe for route detail, Story Mode, Terrain and Traveller Context.',journeys:'journeys'},
  de:{open:'Interaktive Route öffnen',overview:'Überblick',itinerary:'Reiseplan',planning:'Praktische Planung',evidence:'Quellenlage',sources:'Quellen',days:'Tage',nights:'Nächte',stops:'Stopps',legs:'Etappen',countries:'Länder',modes:'Verkehrsmittel',pace:'Reisetempo',seasons:'Reisezeiten',knownTransport:'Bekanntes veröffentlichtes Verkehrsminimum',latestCheck:'Letzte Quellenprüfung',sourced:'Segmente mit Quellen',verified:'verifizierte Segmente',unknown:'Noch nicht veröffentlicht',readiness:'Planungsszenario dieser Reise',readinessLead:'Das öffentliche Routenmodell ist gültig, die operative Abfahrtsvorbereitung ist aber noch nicht abgeschlossen.',dataAsOf:'Datenstand',workQueue:'Aktuelle operative Arbeitsliste',interactiveLead:'Im interaktiven Globus gibt es Routendetails, Story Mode, Terrain und Reisekontext.',journeys:'Reisen'},
  it:{open:'Apri itinerario interattivo',overview:'Panoramica',itinerary:'Itinerario',planning:'Pianificazione pratica',evidence:'Fonti',sources:'Fonti',days:'giorni',nights:'notti',stops:'tappe',legs:'tratte',countries:'paesi',modes:'Trasporti',pace:'Ritmo',seasons:'Stagioni',knownTransport:'Minimo trasporti pubblicato noto',latestCheck:'Ultima verifica fonti',sourced:'tratte con fonti',verified:'tratte verificate',unknown:'Non ancora pubblicato',readiness:'Scenario di questo viaggio',readinessLead:'Il modello pubblico dell’itinerario è valido, ma la preparazione operativa alla partenza è ancora in corso.',dataAsOf:'Dati al',workQueue:'Lavori operativi attuali',interactiveLead:'Apri il globo interattivo per dettagli, Story Mode, terreno e profilo viaggiatore.',journeys:'viaggi'},
  es:{open:'Abrir ruta interactiva',overview:'Resumen',itinerary:'Itinerario',planning:'Planificación práctica',evidence:'Fuentes',sources:'Fuentes',days:'días',nights:'noches',stops:'paradas',legs:'tramos',countries:'países',modes:'Transportes',pace:'Ritmo',seasons:'Temporadas',knownTransport:'Mínimo de transporte publicado conocido',latestCheck:'Última revisión de fuentes',sourced:'tramos con fuentes',verified:'tramos verificados',unknown:'Aún no publicado',readiness:'Escenario de este viaje',readinessLead:'El modelo público de la ruta es válido, pero la preparación operativa para la salida sigue en curso.',dataAsOf:'Datos a',workQueue:'Trabajo operativo actual',interactiveLead:'Abre el globo interactivo para detalles, Story Mode, terreno y contexto del viajero.',journeys:'viajes'},
  fr:{open:'Ouvrir l’itinéraire interactif',overview:'Aperçu',itinerary:'Itinéraire',planning:'Planification pratique',evidence:'Sources',sources:'Sources',days:'jours',nights:'nuits',stops:'étapes',legs:'segments',countries:'pays',modes:'Transports',pace:'Rythme',seasons:'Saisons',knownTransport:'Minimum de transport publié connu',latestCheck:'Dernière vérification des sources',sourced:'segments sourcés',verified:'segments vérifiés',unknown:'Pas encore publié',readiness:'Scénario de ce voyage',readinessLead:'Le modèle public de l’itinéraire est valide, mais la préparation opérationnelle au départ est encore en cours.',dataAsOf:'Données au',workQueue:'Travail opérationnel actuel',interactiveLead:'Ouvrez le globe interactif pour les détails, Story Mode, le relief et le contexte voyageur.',journeys:'voyages'},
  pt:{open:'Abrir rota interativa',overview:'Visão geral',itinerary:'Itinerário',planning:'Planejamento prático',evidence:'Fontes',sources:'Fontes',days:'dias',nights:'noites',stops:'paradas',legs:'trechos',countries:'países',modes:'Transportes',pace:'Ritmo',seasons:'Estações',knownTransport:'Mínimo de transporte publicado conhecido',latestCheck:'Última verificação das fontes',sourced:'segmentos com fontes',verified:'segmentos verificados',unknown:'Ainda não publicado',readiness:'Cenário desta viagem',readinessLead:'O modelo público da rota é válido, mas a preparação operacional para a partida ainda está em andamento.',dataAsOf:'Dados em',workQueue:'Trabalho operacional atual',interactiveLead:'Abra o globo interativo para detalhes, Story Mode, terreno e contexto do viajante.',journeys:'viagens'}
};

const money=(value,currency,lang)=>{
  if(!Number.isFinite(Number(value)))return null;
  try{return new Intl.NumberFormat(lang,{style:'currency',currency:currency||'EUR',maximumFractionDigits:2}).format(Number(value))}
  catch{return String(value)+' '+String(currency||'EUR')}
};
const tripJsonLd=(trip,index,lang,url)=>{
  const data={
    '@context':'https://schema.org',
    '@type':'TouristTrip',
    name:localized(trip.title,lang),
    description:localized(index?.summary||trip.subtitle,lang),
    url,
    touristType:trip.kind==='cruise'?'Cruise tourism':trip.kind==='world'?'Long-term world travel':trip.kind==='round-trip'?'Round trip':trip.kind==='road-trip'?'Road trip':'Travel itinerary'
  };
  if(index?.itinerary?.length){
    data.itinerary={
      '@type':'ItemList',
      itemListElement:index.itinerary.map((stop,position)=>({
        '@type':'ListItem',
        position:position+1,
        item:{'@type':'Place',name:localized(stop.name,lang)}
      }))
    };
  }
  return JSON.stringify(data).replace(/</g,'\\u003c');
};
const metric=(value,label)=>'<article><b>'+esc(value??'—')+'</b><span>'+esc(label)+'</span></article>';

const collectionJsonLd=(collection,trips,lang,url)=>JSON.stringify({
  '@context':'https://schema.org',
  '@type':'ItemList',
  name:localized(collection.title,lang),
  description:localized(collection.description,lang),
  url,
  itemListElement:trips.map((trip,position)=>({
    '@type':'ListItem',
    position:position+1,
    url:'https://one-world-route.vercel.app/'+lang+'/trip/'+trip.slug,
    name:localized(trip.title,lang)
  }))
}).replace(/</g,'\\u003c');

function richTaxonomyBody({facet,value,trips,lang,target}){
  const tx=PAGE_TEXT[lang]||PAGE_TEXT.en;
  const heading=taxonomyLabel(facet,value,lang);
  const cards=trips.map(trip=>{
    const metrics=[
      trip.metrics?.days?trip.metrics.days+' '+tx.days:null,
      trip.metrics?.countries?trip.metrics.countries+' '+tx.countries:null,
      (trip.discovery?.modes||[]).slice(0,2).map(v=>facetLabel(v,lang)).join(' · ')
    ].filter(Boolean).join(' · ');
    return '<article class="collection-card">'+coverMarkup(trip,lang)+'<div><span>'+esc(facetLabel(trip.kind,lang))+'</span><h2>'+esc(localized(trip.title,lang))+'</h2><p>'+esc(localized(trip.subtitle,lang))+'</p><small>'+esc(metrics)+'</small></div><a href="/'+esc(lang)+'/trip/'+esc(trip.slug)+'">'+esc(tx.open)+' →</a></article>';
  }).join('');
  return '<main class="trip-page collection-page"><header><a class="brand" href="/">ONE WORLD ROUTE</a><div class="eyebrow">'+esc(tx.overview)+'</div><h1>'+esc(heading)+'</h1><p class="lead">'+esc(String(trips.length))+' '+esc(tx.journeys)+' · '+esc(tx.interactiveLead)+'</p><div class="cta"><a href="'+esc(target)+'">'+esc(tx.open)+' →</a></div></header><section><div class="collection-list">'+cards+'</div></section><footer><a href="'+esc(target)+'">'+esc(tx.open)+' →</a><span>ONE WORLD ROUTE</span></footer></main>';
}

function richCollectionBody({collection,trips,lang,target}){
  const tx=PAGE_TEXT[lang]||PAGE_TEXT.en;
  const cards=trips.map(trip=>{
    const metrics=[
      trip.metrics?.days?trip.metrics.days+' '+tx.days:null,
      trip.metrics?.countries?trip.metrics.countries+' '+tx.countries:null,
      (trip.discovery?.modes||[]).slice(0,2).map(v=>facetLabel(v,lang)).join(' · ')
    ].filter(Boolean).join(' · ');
    return '<article class="collection-card">'+coverMarkup(trip,lang)+'<div><span>'+esc(facetLabel(trip.kind,lang))+'</span><h2>'+esc(localized(trip.title,lang))+'</h2><p>'+esc(localized(trip.subtitle,lang))+'</p><small>'+esc(metrics)+'</small></div><a href="/'+esc(lang)+'/trip/'+esc(trip.slug)+'">'+esc(tx.open)+' →</a></article>';
  }).join('');
  return '<main class="trip-page collection-page"><header><a class="brand" href="/">ONE WORLD ROUTE</a><div class="eyebrow">'+esc(tx.overview)+'</div><h1>'+esc(localized(collection.title,lang))+'</h1><p class="lead">'+esc(localized(collection.description,lang))+'</p><div class="cta"><a href="'+esc(target)+'">'+esc(tx.open)+' →</a><span>'+esc(String(trips.length))+' '+esc(tx.journeys||'journeys')+'</span></div></header><section><div class="collection-list">'+cards+'</div></section><footer><a href="'+esc(target)+'">'+esc(tx.open)+' →</a><span>ONE WORLD ROUTE</span></footer></main>';
}

function richTripBody({trip,index,lang,target}){
  const tx=PAGE_TEXT[lang]||PAGE_TEXT.en;
  const fit=trip.discovery?.fit||{};
  const modes=(trip.discovery?.modes||[]).map(v=>facetLabel(v,lang)).join(' · ')||'—';
  const seasons=(fit.seasons||[]).map(v=>facetLabel(v,lang)).join(' · ')||'—';
  const itinerary=(index?.itinerary||[]).map(stop=>{
    const day=stop.dayStart===stop.dayEnd?String(stop.dayStart):String(stop.dayStart)+'–'+String(stop.dayEnd);
    return '<li><span>'+esc(tx.days)+' '+esc(day)+'</span><div><b>'+esc(localized(stop.name,lang))+'</b><small>'+esc(stop.nights??0)+' '+esc(tx.nights)+'</small></div></li>';
  }).join('');
  const knownMinimum=money(index?.planning?.knownPublishedMinimumEur,index?.planning?.currency,lang);
  const evidence=index?.evidence||{};
  const sources=(index?.sources||[]).slice(0,12).map(source=>
    '<a href="'+esc(source.url)+'" rel="noopener noreferrer"><b>'+esc(source.issuer||source.title||source.id)+'</b><span>'+esc(source.title||'')+'</span><small>'+esc(source.checkedAt||'—')+'</small></a>'
  ).join('');
  const readinessBlock=trip.defaultPlanningScenario&&trip.id===readiness.scope?.tripId?'<details class="readiness"><summary>'+esc(tx.readiness)+'</summary><section><div class="eyebrow">'+esc(tx.readiness)+'</div><h2>'+esc(tx.readiness)+'</h2><p>'+esc(tx.readinessLead)+'</p><div class="readiness-meta"><span>'+esc(tx.dataAsOf)+': <b>'+esc(readiness.dataAsOf||'—')+'</b></span><span>195 / 194: <b>'+esc(readiness.structural?.invariantOk?'OK':'CHECK')+'</b></span></div><h3>'+esc(tx.workQueue)+'</h3><div class="queue">'+(readiness.workQueue||[]).slice(0,6).map(item=>'<span><b>'+esc(item.priority)+'</b> '+esc(item.id.replaceAll('-',' '))+' · '+esc(item.count)+'</span>').join('')+'</div></section></details>':'';
  return '<main class="trip-page">'+coverMarkup(trip,lang,true)+'<header><a class="brand" href="/">ONE WORLD ROUTE</a><div class="eyebrow">'+esc(facetLabel(trip.kind,lang))+'</div><h1>'+esc(localized(trip.title,lang))+'</h1><p class="lead">'+esc(localized(index?.summary||trip.subtitle,lang))+'</p><div class="cta"><a href="'+esc(target)+'">'+esc(tx.open)+' →</a><span>'+esc(tx.interactiveLead)+'</span></div></header>'+
    '<section><div class="eyebrow">'+esc(tx.overview)+'</div><h2>'+esc(tx.overview)+'</h2><div class="metrics">'+
      metric(trip.metrics?.days,tx.days)+metric(trip.metrics?.countries,tx.countries)+metric(trip.metrics?.stops??trip.metrics?.internationalLegs,trip.metrics?.stops?tx.stops:tx.legs)+
      metric(modes,tx.modes)+metric(facetLabel(fit.pace||index?.planning?.pace||'—',lang),tx.pace)+metric(seasons,tx.seasons)+
    '</div></section>'+
    (index?.itinerary?.length?'<section><div class="eyebrow">'+esc(tx.itinerary)+'</div><h2>'+esc(tx.itinerary)+'</h2><ol class="itinerary">'+itinerary+'</ol></section>':'')+
    '<section><div class="eyebrow">'+esc(tx.planning)+'</div><h2>'+esc(tx.planning)+'</h2><div class="planning-grid"><article><span>'+esc(tx.knownTransport)+'</span><b>'+esc(knownMinimum||tx.unknown)+'</b><small>'+esc(localized(index?.planning?.knownPublishedMinimumScope,lang)||'—')+'</small></article><article><span>'+esc(tx.latestCheck)+'</span><b>'+esc(evidence.latestEvidenceCheck||'—')+'</b><small>'+esc(evidence.sourcedSegments||0)+'/'+esc(evidence.segments||0)+' '+esc(tx.sourced)+' · '+esc(evidence.verifiedSegments||0)+' '+esc(tx.verified)+'</small></article></div></section>'+
    (sources?'<section><div class="eyebrow">'+esc(tx.sources)+'</div><h2>'+esc(tx.sources)+'</h2><div class="sources">'+sources+'</div></section>':'')+
    readinessBlock+
    '<footer><a href="'+esc(target)+'">'+esc(tx.open)+' →</a><span>ONE WORLD ROUTE</span></footer></main>';
}

const style='<style>'+
  ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#05070d;color:#e8f0f7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit}.trip-page{width:min(1040px,calc(100% - 32px));margin:0 auto;padding:34px 0 60px}.trip-page header{padding:50px 0 56px;border-bottom:1px solid #172232}.brand{display:inline-block;margin-bottom:42px;color:#7fe9ff;text-decoration:none;font-size:11px;font-weight:800;letter-spacing:.16em}.eyebrow{color:#67dfff;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.trip-page h1{max-width:820px;margin:8px 0 14px;font-size:clamp(38px,7vw,74px);line-height:.96;letter-spacing:-.045em}.trip-page h2{margin:6px 0 18px;font-size:26px;letter-spacing:-.03em}.lead{max-width:720px;color:#9aabbd;font-size:17px;line-height:1.6}.cta{display:flex;align-items:center;gap:18px;margin-top:26px}.cta a,footer a{padding:12px 16px;border:1px solid #26687a;border-radius:10px;background:#0d2430;color:#dffaff;text-decoration:none;font-size:12px;font-weight:800}.cta span{max-width:470px;color:#73869a;font-size:11px;line-height:1.45}.trip-page section{padding:42px 0;border-bottom:1px solid #141f2d}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.metrics article,.planning-grid article{padding:16px;border:1px solid #172738;border-radius:14px;background:#08131e}.metrics b,.metrics span,.planning-grid span,.planning-grid b,.planning-grid small{display:block}.metrics b{font-size:17px}.metrics span,.planning-grid span{margin-top:5px;color:#75899e;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.itinerary{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:0;list-style:none}.itinerary li{display:flex;gap:14px;padding:14px;border:1px solid #172738;border-radius:12px;background:#08131e}.itinerary li>span{flex:0 0 70px;color:#6bdff8;font-size:9px;text-transform:uppercase}.itinerary b,.itinerary small{display:block}.itinerary small{margin-top:4px;color:#74879a;font-size:9px}.planning-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.planning-grid b{margin:8px 0 5px;font-size:18px}.planning-grid small{color:#74879a;line-height:1.45}.sources{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.sources a{display:grid;gap:4px;padding:13px;border:1px solid #172738;border-radius:12px;background:#08131e;text-decoration:none}.sources span,.sources small{color:#74879a;font-size:9px}.readiness p{max-width:720px;color:#92a4b7;line-height:1.55}.readiness-meta,.queue{display:flex;flex-wrap:wrap;gap:8px}.readiness-meta span,.queue span{padding:8px 10px;border-radius:9px;background:#0a1825;color:#8fa2b5;font-size:9px}.readiness h3{margin:22px 0 8px;font-size:13px}.collection-list{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.collection-card{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:18px;border:1px solid #172738;border-radius:14px;background:#08131e}.collection-card span,.collection-card small{color:#75899e;font-size:9px}.collection-card span{text-transform:uppercase;letter-spacing:.08em}.collection-card h2{margin:5px 0 7px;font-size:20px}.collection-card p{max-width:560px;margin:0 0 10px;color:#8da0b3;font-size:11px;line-height:1.5}.collection-card>a{flex:0 0 auto;padding:9px 11px;border:1px solid #26687a;border-radius:9px;background:#0d2430;color:#dffaff;text-decoration:none;font-size:10px;font-weight:800}footer{display:flex;justify-content:space-between;align-items:center;padding-top:34px;color:#63778d;font-size:9px;letter-spacing:.08em}@media(max-width:720px){.trip-page{width:min(100% - 24px,1040px)}.metrics{grid-template-columns:1fr 1fr}.itinerary,.planning-grid,.sources,.collection-list{grid-template-columns:1fr}.collection-card{align-items:flex-start;flex-direction:column}.cta{align-items:flex-start;flex-direction:column}.trip-page header{padding-top:28px}.brand{margin-bottom:30px}}'+
'</style>';

const consumerStyle='<style>.journey-cover{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:18px;margin-top:12px}.collection-card{display:block;overflow:hidden;padding:0}.collection-cover{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.collection-card>div{padding:20px}.collection-card>a{display:inline-block;margin:0 20px 20px;min-height:44px;line-height:24px}.collection-card p{font-size:14px}.collection-card small,.sources span,.sources small{font-size:12px;line-height:1.5}.sources a{overflow-wrap:anywhere}a:focus-visible,summary:focus-visible{outline:3px solid #7fe9ff;outline-offset:4px}.trip-page header{padding:28px 0 40px}.brand{margin-bottom:24px}footer{flex-wrap:wrap;gap:16px}.itinerary small{font-size:12px}.collection-card>a,.cta a{font-size:13px}.metrics span{font-size:11px}</style>';

module.exports=(req,res)=>{
  const type=String(req.query.type||''),origin='https://one-world-route.vercel.app';
  const requestedLang=String(req.query.lang||'').toLowerCase(),lang=safeLang(requestedLang);
  let htmlLang='en',title='ONE WORLD ROUTE — routes without borders',desc='Explore world journeys, round trips, road trips, rail routes, cruises and more.',target='/',canonical=origin+'/',alternates='',jsonLd='',body='',autoRedirect=true;
  if(type==='route'){
    const id=parseInt(String(req.query.id||''),10),s=route.segments.find(x=>Number(x.id)===id);
    if(s){const a=en(s.from),b=en(s.to);title=a+' → '+b+' — ONE WORLD ROUTE';desc='Route leg '+id+' of 194 · '+a+' to '+b+'. Explore the continuous 195-country journey.';target='/?trip='+encodeURIComponent(platform.defaultTripId)+'&segment='+id;canonical=origin+'/route/'+id+'-'+slug(a)+'-'+slug(b);}
  }else if(type==='country'){
    const wanted=slug(req.query.slug||'');
    const c=route.countries.find(x=>slug(en(x.name))===wanted||slug(x.name)===wanted);
    if(c){const name=en(c.name);title=name+' — ONE WORLD ROUTE';desc='Country '+c.number+' of 195 on the One World Journey. Explore arrival, onward route and public planning context.';target='/?trip='+encodeURIComponent(platform.defaultTripId)+'&country='+encodeURIComponent(c.name);canonical=origin+'/country/'+slug(name);}
  }else if(type==='destination'){
    const code=String(req.query.code||'').toUpperCase(),country=geo.find(c=>c.cca2===code);
    if(country){
      const name=new Intl.DisplayNames([lang],{type:'region'}).of(code);
      const trips=platform.trips.filter(t=>t.renderer!=='legacy-world'&&indexById.get(t.id)?.itinerary.some(stop=>stop.countryCode===code));
      htmlLang=lang;title=name+' — ONE WORLD ROUTE';desc=name+' · '+trips.length+' '+PAGE_TEXT[lang].journeys;
      target='/?destination='+code+'&lang='+lang;
      canonical=origin+(SUPPORTED_LANGS.includes(requestedLang)?'/'+lang:'')+'/destination/'+code.toLowerCase();
      alternates=SUPPORTED_LANGS.map(l=>'<link rel="alternate" hreflang="'+l+'" href="'+origin+'/'+l+'/destination/'+code.toLowerCase()+'">').join('')+'<link rel="alternate" hreflang="x-default" href="'+origin+'/destination/'+code.toLowerCase()+'">';
      body=richCollectionBody({collection:{title:{[lang]:name},description:{[lang]:desc}},trips,lang,target});
      jsonLd='<script type="application/ld+json">'+collectionJsonLd({title:{[lang]:name}},trips,lang,canonical)+'</script>';
      autoRedirect=false;
    }
  }else if(type==='trip'){
    const wanted=slug(req.query.slug||req.query.id||'');
    const trip=platform.trips.find(x=>slug(x.slug)===wanted||slug(x.id)===wanted);
    if(trip){
      const index=indexById.get(trip.id);
      htmlLang=lang;
      const name=localized(trip.title,lang),sub=localized(index?.summary||trip.subtitle,lang);
      title=name+' — ONE WORLD ROUTE';
      desc=sub||'Explore this route on ONE WORLD ROUTE.';
      target=tripTarget(trip,lang);
      canonical=requestedLang&&SUPPORTED_LANGS.includes(requestedLang)?origin+'/'+lang+'/trip/'+trip.slug:origin+'/trip/'+trip.slug;
      alternates=alternateLinks(origin,trip);
      jsonLd='<script type="application/ld+json">'+tripJsonLd(trip,index,lang,canonical)+'</script>';
      body=richTripBody({trip,index,lang,target});
      autoRedirect=false;
    }
  }else if(type==='taxonomy'){
    const facet=String(req.query.facet||'').toLowerCase(),value=slug(req.query.value||'');
    if(taxonomyExists(facet,value)){
      const trips=taxonomyTrips(facet,value);
      htmlLang=lang;
      const heading=taxonomyLabel(facet,value,lang);
      title=heading+' — ONE WORLD ROUTE';
      desc=heading+' · '+trips.length+' '+(PAGE_TEXT[lang]||PAGE_TEXT.en).journeys+'.';
      target=taxonomyTarget(facet,value,lang);
      canonical=requestedLang&&SUPPORTED_LANGS.includes(requestedLang)?origin+'/'+lang+'/discover/'+facet+'/'+value:origin+'/discover/'+facet+'/'+value;
      alternates=taxonomyAlternateLinks(origin,facet,value);
      jsonLd='<script type="application/ld+json">'+collectionJsonLd({title:{[lang]:heading,en:heading},description:{[lang]:desc,en:desc}},trips,lang,canonical)+'</script>';
      body=richTaxonomyBody({facet,value,trips,lang,target});
      autoRedirect=false;
    }
  }else if(type==='collection'){
    const wanted=slug(req.query.slug||req.query.id||'');
    const collection=(collections.collections||[]).find(item=>slug(item.id)===wanted);
    if(collection){
      const trips=platform.trips.filter(trip=>collectionMatches(trip,collection));
      htmlLang=lang;
      title=localized(collection.title,lang)+' — ONE WORLD ROUTE';
      desc=localized(collection.description,lang);
      target=collectionTarget(collection,lang);
      canonical=requestedLang&&SUPPORTED_LANGS.includes(requestedLang)?origin+'/'+lang+'/journeys/'+collection.id:origin+'/journeys/'+collection.id;
      alternates=collectionAlternateLinks(origin,collection);
      jsonLd='<script type="application/ld+json">'+collectionJsonLd(collection,trips,lang,canonical)+'</script>';
      body=richCollectionBody({collection,trips,lang,target});
      autoRedirect=false;
    }
  }
  const found=Boolean(body)||canonical!==origin+'/';
  if(!found){res.statusCode=404;autoRedirect=false;htmlLang=lang;const copy=ERROR_TEXT[lang]||ERROR_TEXT.en;title=copy.title+' — ONE WORLD ROUTE';desc=copy.lead;target='/?lang='+encodeURIComponent(lang);body='<main class="trip-page"><header><a class="brand" href="'+esc(target)+'">ONE WORLD ROUTE</a><h1>'+esc(copy.title)+'</h1><p class="lead">'+esc(copy.lead)+'</p><div class="cta"><a href="'+esc(target)+'">'+esc(copy.back)+' →</a></div></header></main>';}
  const activeTrip=type==='trip'?platform.trips.find(t=>t.slug===slug(req.query.slug||'')):null;
  const ogCover=activeTrip?coverFor(activeTrip):null;
  const ogImage=ogCover?.asset&&/^\.\/assets\/[a-z0-9_./-]+$/i.test(ogCover.asset)&&!ogCover.asset.split('/').includes('..')?origin+'/'+ogCover.asset.slice(2):null;
  if(!body)body='<main style="max-width:720px;margin:0 auto;padding:48px 24px"><p>ONE WORLD ROUTE</p><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p><p><a style="color:#8fe9ff" href="'+esc(target)+'">Open interactive route →</a></p></main>';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Content-Language',htmlLang);
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=86400');
  res.end('<!doctype html><html lang="'+esc(htmlLang)+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(desc)+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:type" content="website"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:locale" content="'+esc(htmlLang)+'"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="'+esc(canonical)+'">'+(ogImage?'<meta property="og:image" content="'+esc(ogImage)+'"><meta name="twitter:image" content="'+esc(ogImage)+'">':'')+(!found?'<meta name="robots" content="noindex">':'')+alternates+jsonLd+style+consumerStyle+'</head><body>'+body+(autoRedirect?'<script>location.replace('+JSON.stringify(target)+')</script>':'')+'<noscript><p style="max-width:720px;margin:20px auto;padding:0 24px"><a href="'+esc(target)+'">' +esc((PAGE_TEXT[htmlLang]||PAGE_TEXT.en).open)+ '</a></p></noscript></body></html>');
};
