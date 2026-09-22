(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const COPY={
    en:{eyebrow:'Interactive journey platform',title:'Choose where the journey starts.',lead:'Explore the 195-country flagship and curated regional journeys on one shared globe platform.',all:'All journeys',routes:'routes available',browse:'Filter routes',open:'Open journey'},
    de:{eyebrow:'Interaktive Reiseplattform',title:'Wähle deine Reise.',lead:'Entdecke die 195-Länder-Weltreise und kuratierte Regionalreisen auf einer gemeinsamen Globus-Plattform.',all:'Alle Reisen',routes:'Reisen verfügbar',browse:'Routen filtern',open:'Reise öffnen'},
    it:{eyebrow:'Piattaforma di viaggi interattiva',title:'Scegli il tuo viaggio.',lead:'Esplora il viaggio in 195 paesi e itinerari regionali curati su un’unica piattaforma.',all:'Tutti i viaggi',routes:'itinerari disponibili',browse:'Filtra itinerari',open:'Apri viaggio'},
    es:{eyebrow:'Plataforma de viajes interactiva',title:'Elige tu viaje.',lead:'Explora el viaje por 195 países y rutas regionales seleccionadas en una sola plataforma.',all:'Todos los viajes',routes:'rutas disponibles',browse:'Filtrar rutas',open:'Abrir viaje'},
    fr:{eyebrow:'Plateforme de voyage interactive',title:'Choisissez votre voyage.',lead:'Explorez le voyage dans 195 pays et des itinéraires régionaux sélectionnés sur une plateforme commune.',all:'Tous les voyages',routes:'itinéraires disponibles',browse:'Filtrer les itinéraires',open:'Ouvrir le voyage'},
    pt:{eyebrow:'Plataforma de viagens interativa',title:'Escolha sua viagem.',lead:'Explore a viagem por 195 países e rotas regionais selecionadas numa plataforma compartilhada.',all:'Todas as viagens',routes:'rotas disponíveis',browse:'Filtrar rotas',open:'Abrir viagem'}
  };
  const $=(s,r=document)=>r.querySelector(s);

  function show({catalog,locale,local,esc,facetLabel,statusLabel,pluralLabel,t,onOpenTrip,onOpenLibrary}){
    hide();
    document.body.classList.add('platform-home-active');
    const copy=COPY[locale]||COPY.en;
    const card=trip=>{
      const metrics=[];
      if(trip.metrics?.days)metrics.push(trip.metrics.days+' '+t('days'));
      if(trip.metrics?.stops)metrics.push(trip.metrics.stops+' '+t('stops'));
      if(trip.metrics?.countries)metrics.push(trip.metrics.countries+' '+pluralLabel(trip.metrics.countries,'countryUnit','countriesUnit'));
      if(trip.metrics?.internationalLegs)metrics.push(trip.metrics.internationalLegs+' '+t('segments'));
      return `<article class="platform-home-card" data-home-trip="${esc(trip.id)}"><div class="platform-route-top"><span>${esc(facetLabel(trip.kind))}</span><b>${esc(statusLabel(trip))}</b></div><h2>${esc(local(trip.title))}</h2><p>${esc(local(trip.subtitle))}</p><div class="platform-route-metrics">${metrics.map(metric=>`<span>${esc(metric)}</span>`).join('')}</div><button type="button" data-home-open="${esc(trip.id)}">${esc(copy.open)} →</button></article>`;
    };
    const node=document.createElement('main');
    node.id='platformHome';
    node.className='platform-home';
    node.innerHTML=`<header class="platform-home-header"><div class="platform-home-brand"><span class="brand-orbit"><i></i></span><span><strong>ONE WORLD ROUTE</strong><small>${esc(copy.eyebrow)}</small></span></div><button id="platformHomeBrowse" type="button">${esc(copy.browse)}</button></header><section class="platform-home-hero"><div><span class="platform-home-kicker">${esc(copy.eyebrow)}</span><h1>${esc(copy.title)}</h1><p>${esc(copy.lead)}</p></div><div class="platform-home-stat"><strong>${catalog.trips.length}</strong><span>${esc(copy.routes)}</span></div></section><section class="platform-home-section"><div class="platform-home-section-head"><span>${esc(copy.all)}</span><b>${catalog.trips.length}</b></div><div class="platform-home-grid">${catalog.trips.map(card).join('')}</div></section><footer class="platform-home-footer">ONE WORLD ROUTE · ${esc(t('routeMethodTitle'))}</footer>`;
    document.body.appendChild(node);
    node.addEventListener('click',event=>{
      const button=event.target.closest('[data-home-open]');
      if(button)onOpenTrip(button.dataset.homeOpen);
    });
    $('#platformHomeBrowse',node)?.addEventListener('click',onOpenLibrary);
    document.title='ONE WORLD ROUTE — '+copy.title;
    return node;
  }

  function hide(){
    $('#platformHome')?.remove();
    document.body.classList.remove('platform-home-active');
  }

  root.home={show,hide};
})();