(() => {
  'use strict';

  const CATALOG_URL = './data/platform/trips.json';
  const PROFILE_KEY = 'one-world-route:traveller-context:v1';
  const SUPPORTED_LOCALES = ['en','de','it','es','fr','pt'];
  const PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const Model=PLATFORM_MODULES.model;
  const Traveller=PLATFORM_MODULES.traveller;
  const Discovery=PLATFORM_MODULES.discovery;
  const Extensions=PLATFORM_MODULES.extensions;
  if(!Model||!Traveller||!Discovery||!Extensions)throw new Error('ONE WORLD ROUTE platform modules unavailable');
  const I18N = {
    en:{routes:'Routes',traveller:'Traveller',flagship:'Flagship',template:'Template',open:'Open route',days:'days',stops:'stops',segments:'segments',global:'Global perspective',contextTitle:'Traveller context',contextLead:'Used to adapt entry rules, language, currency and departure assumptions. Stored only on this device.',passports:'Passport country',secondPassport:'Second passport (optional)',residence:'Residence',language:'Language',currency:'Currency',origin:'Starting city / airport',adults:'Adults',children:'Children',mobility:'Reduced mobility',save:'Save context',clear:'Clear',notSet:'Not set',currentCheck:'Current check required',routeLibrary:'Explore routes',routeLibraryLead:'One platform for world journeys, round trips, road trips, rail, cruises and more.',editorial:'Editorial template — verify transport, prices and entry requirements for your dates.',overview:'Route overview',day:'Day',nights:'nights',transport:'Transport',verification:'Verification',backWorld:'World route',private:'Private on this device. Passport numbers, booking references and payment details are never requested.',sourcedBeta:'Sourced beta',sources:'Sources',lastChecked:'Last checked',publishedFrom:'from',verified:'Verified',routeEvidence:'Route evidence',entryGuidance:'Entry guidance',officialCheck:'Official check',connectionRequired:'connection required',minimumTravel:'minimum travel',cruiseTemplate:'Cruise template',onboardNights:'onboard nights',seaDays:'sea days',portCall:'Port call',embarkation:'Embarkation',disembarkation:'Disembarkation',border:'Border context',schengenExit:'Schengen exit',schengenEntry:'Schengen re-entry',sailingNeeded:'Select a real sailing for ship, operator, times, berth and price.',illustrative:'Illustrative',searchRoutes:'Search routes',filterType:'Travel type',filterRegion:'Region',filterDuration:'Duration',all:'All',noRoutes:'No routes match these filters.',vehicleSection:'Vehicle context (optional)',vehicleType:'Vehicle',registrationCountry:'Registration country',fuelType:'Fuel / powertrain',euroClass:'Euro emissions class',rentalCrossBorder:'Rental approved for cross-border travel',privateCar:'Private car',rentalCar:'Rental car',camper:'Camper',motorcycle:'Motorcycle',otherVehicle:'Other',petrol:'Petrol',diesel:'Diesel',hybrid:'Hybrid',pluginHybrid:'Plug-in hybrid',electric:'Electric',hydrogen:'Hydrogen',unknown:'Unknown',roadRules:'Road context',crossBorder:'Cross-border',urbanAccess:'Urban access checks',vehicleNeeded:'Vehicle context required for toll, LEZ and access checks.',facet_world:'World',facet_round_trip:'Round trip',facet_road_trip:'Road trip',facet_cruise:'Cruise',facet_global:'Global',facet_europe:'Europe',facet_southern_europe:'Southern Europe',facet_italy:'Italy',facet_mediterranean:'Mediterranean',facet_north_africa:'North Africa',filterMode:'Transport',filterTheme:'Theme',results:'routes found',resetFilters:'Reset',details:'Details',start:'Start',finish:'Finish',previous:'Previous',next:'Next',type:'Type',country:'Country',duration:'Duration',cost:'Cost',segment:'Segment',stop:'Stop',currency:'Currency',facet_rail:'Rail',facet_bus:'Bus',facet_car:'Car',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Road',facet_coach:'Coach',facet_ground_transfer:'Ground transfer',story:'Story',storyPlay:'Play story',storyExit:'Exit story',storyComplete:'Route complete',chapter:'Chapter',settings:'Settings',methodology:'Methodology',share:'Share',autoRotate:'Auto rotate',highDetail:'High detail globe',terrain:'Real 3D globe terrain',showPoints:'Stop points',routeGlow:'Route glow',arcThickness:'Route thickness',reducedMotion:'Reduced motion',terrainLoading:'Loading 3D terrain…',terrainHint:'Drag to rotate · scroll to zoom · real elevation appears as you move closer',routeMethodTitle:'Route methodology',routeMethodText:'This curated route uses publication-safe trip data and source-backed evidence where available. Volatile schedules, prices and traveller-specific rules remain explicitly unresolved until dates and context are known.',evidenceCoverage:'Evidence coverage',editorialStatus:'Editorial status',storyRoute:'Route story',routeFit:'Route Fit',showFit:'More fit filters',hideFit:'Hide fit filters',fitPace:'Pace',fitSeason:'Season',fitParty:'Travelling as',fitStart:'Route starts in',facet_relaxed:'Relaxed',facet_balanced:'Balanced',facet_active:'Active',facet_spring:'Spring',facet_summer:'Summer',facet_autumn:'Autumn',facet_winter:'Winter',facet_multi_season:'Multi-season',facet_solo:'Solo',facet_couples:'Couple',facet_friends:'Friends',facet_families:'Family',resultOne:'route found',countryUnit:'country',countriesUnit:'countries',facet_city:'City',facet_cruise_port:'Cruise port',facet_port:'Port',facet_rail_station:'Rail station',facet_airport:'Airport',facet_island:'Island',facet_park:'Park',status_planned:'Planned',status_sourced_beta:'Sourced beta',status_illustrative_template:'Illustrative template',status_draft:'Draft'},
    de:{routes:'Routen',traveller:'Reisekontext',flagship:'Flagship',template:'Vorlage',open:'Route öffnen',days:'Tage',stops:'Stopps',segments:'Segmente',global:'Globale Perspektive',contextTitle:'Reisekontext',contextLead:'Passt Einreisehinweise, Sprache, Währung und Startannahmen an. Wird nur auf diesem Gerät gespeichert.',passports:'Passland',secondPassport:'Zweiter Pass (optional)',residence:'Wohnsitz',language:'Sprache',currency:'Währung',origin:'Startstadt / Flughafen',adults:'Erwachsene',children:'Kinder',mobility:'Eingeschränkte Mobilität',save:'Kontext speichern',clear:'Zurücksetzen',notSet:'Nicht gesetzt',currentCheck:'Aktuelle Prüfung erforderlich',routeLibrary:'Routen entdecken',routeLibraryLead:'Eine Plattform für Weltreisen, Rundreisen, Roadtrips, Bahnreisen, Kreuzfahrten und mehr.',editorial:'Redaktionelle Vorlage — Verkehr, Preise und Einreisebedingungen für die eigenen Daten prüfen.',overview:'Routenübersicht',day:'Tag',nights:'Nächte',transport:'Verkehr',verification:'Prüfstatus',backWorld:'Weltreise',private:'Privat auf diesem Gerät. Passnummern, Buchungsreferenzen und Zahlungsdaten werden niemals abgefragt.',sourcedBeta:'Quellen-Beta',sources:'Quellen',lastChecked:'Zuletzt geprüft',publishedFrom:'ab',verified:'Verifiziert',routeEvidence:'Routenbelege',entryGuidance:'Einreisehinweise',officialCheck:'Offiziell prüfen',connectionRequired:'Umstieg einplanen',minimumTravel:'Mindestfahrzeit',cruiseTemplate:'Kreuzfahrt-Vorlage',onboardNights:'Nächte an Bord',seaDays:'Seetage',portCall:'Hafenstopp',embarkation:'Einschiffung',disembarkation:'Ausschiffung',border:'Grenzkontext',schengenExit:'Schengen-Ausreise',schengenEntry:'Schengen-Wiedereinreise',sailingNeeded:'Für Schiff, Reederei, Zeiten, Liegeplatz und Preis muss eine konkrete Abfahrt gewählt werden.',illustrative:'Illustrativ',searchRoutes:'Routen suchen',filterType:'Reiseart',filterRegion:'Region',filterDuration:'Dauer',all:'Alle',noRoutes:'Keine Route passt zu diesen Filtern.',vehicleSection:'Fahrzeugkontext (optional)',vehicleType:'Fahrzeug',registrationCountry:'Zulassungsland',fuelType:'Kraftstoff / Antrieb',euroClass:'Euro-Abgasnorm',rentalCrossBorder:'Mietwagen für Grenzübertritte freigegeben',privateCar:'Privatwagen',rentalCar:'Mietwagen',camper:'Camper',motorcycle:'Motorrad',otherVehicle:'Anderes',petrol:'Benzin',diesel:'Diesel',hybrid:'Hybrid',pluginHybrid:'Plug-in-Hybrid',electric:'Elektro',hydrogen:'Wasserstoff',unknown:'Unbekannt',roadRules:'Straßenkontext',crossBorder:'Grenzübertritt',urbanAccess:'Stadtzufahrt prüfen',vehicleNeeded:'Für Maut-, Umweltzonen- und Zufahrtsprüfungen wird ein Fahrzeugkontext benötigt.',facet_world:'Weltreise',facet_round_trip:'Rundreise',facet_road_trip:'Roadtrip',facet_cruise:'Kreuzfahrt',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Südeuropa',facet_italy:'Italien',facet_mediterranean:'Mittelmeer',facet_north_africa:'Nordafrika',filterMode:'Verkehrsmittel',filterTheme:'Reisethema',results:'Routen gefunden',resetFilters:'Filter zurücksetzen',details:'Details',start:'Start',finish:'Ziel',previous:'Zurück',next:'Weiter',type:'Typ',country:'Land',duration:'Dauer',cost:'Kosten',segment:'Segment',stop:'Stopp',currency:'Währung',facet_rail:'Bahn',facet_bus:'Bus',facet_car:'Auto',facet_ferry:'Fähre',facet_multimodal:'Multimodal',facet_road:'Straße',facet_coach:'Fernbus',facet_ground_transfer:'Bodentransfer',story:'Story',storyPlay:'Story starten',storyExit:'Story beenden',storyComplete:'Route abgeschlossen',chapter:'Kapitel',settings:'Einstellungen',methodology:'Methodik',share:'Teilen',autoRotate:'Automatisch drehen',highDetail:'Hochauflösender Globus',terrain:'Echtes 3D-Globus-Terrain',showPoints:'Stopppunkte',routeGlow:'Routenleuchten',arcThickness:'Linienstärke',reducedMotion:'Reduzierte Bewegung',terrainLoading:'3D-Terrain wird geladen…',terrainHint:'Ziehen zum Drehen · scrollen zum Zoomen · echtes Relief erscheint beim Annähern',routeMethodTitle:'Routenmethodik',routeMethodText:'Diese kuratierte Route verwendet veröffentlichungssichere Reisedaten und, wo verfügbar, quellenbasierte Belege. Veränderliche Fahrpläne, Preise und reisendenspezifische Regeln bleiben ausdrücklich offen, bis Datum und Kontext feststehen.',evidenceCoverage:'Quellenabdeckung',editorialStatus:'Redaktioneller Status',storyRoute:'Routen-Story',routeFit:'Route Fit',showFit:'Weitere passende Filter',hideFit:'Passende Filter ausblenden',fitPace:'Reisetempo',fitSeason:'Reisezeit',fitParty:'Reisekonstellation',fitStart:'Routenstart',facet_relaxed:'Entspannt',facet_balanced:'Ausgewogen',facet_active:'Aktiv',facet_spring:'Frühling',facet_summer:'Sommer',facet_autumn:'Herbst',facet_winter:'Winter',facet_multi_season:'Mehrere Jahreszeiten',facet_solo:'Allein',facet_couples:'Paar',facet_friends:'Freunde',facet_families:'Familie',resultOne:'Route gefunden',countryUnit:'Land',countriesUnit:'Länder',facet_city:'Stadt',facet_cruise_port:'Kreuzfahrthafen',facet_port:'Hafen',facet_rail_station:'Bahnhof',facet_airport:'Flughafen',facet_island:'Insel',facet_park:'Park',status_planned:'Geplant',status_sourced_beta:'Quellen-Beta',status_illustrative_template:'Illustrative Vorlage',status_draft:'Entwurf'},
    it:{routes:'Itinerari',traveller:'Viaggiatore',flagship:'Flagship',template:'Modello',open:'Apri itinerario',days:'giorni',stops:'tappe',segments:'tratte',global:'Prospettiva globale',contextTitle:'Profilo viaggiatore',contextLead:'Adatta requisiti d’ingresso, lingua, valuta e partenza. Salvato solo su questo dispositivo.',passports:'Paese del passaporto',secondPassport:'Secondo passaporto (opzionale)',residence:'Residenza',language:'Lingua',currency:'Valuta',origin:'Città / aeroporto di partenza',adults:'Adulti',children:'Bambini',mobility:'Mobilità ridotta',save:'Salva',clear:'Cancella',notSet:'Non impostato',currentCheck:'Verifica attuale richiesta',routeLibrary:'Esplora itinerari',routeLibraryLead:'Una piattaforma per giri del mondo, road trip, treni, crociere e altro.',editorial:'Modello editoriale — verifica trasporti, prezzi e requisiti per le tue date.',overview:'Panoramica',day:'Giorno',nights:'notti',transport:'Trasporto',verification:'Verifica',backWorld:'Giro del mondo',private:'Privato su questo dispositivo. Non chiediamo numeri di passaporto, prenotazioni o dati di pagamento.',sourcedBeta:'Beta con fonti',sources:'Fonti',lastChecked:'Ultima verifica',publishedFrom:'da',verified:'Verificato',routeEvidence:'Fonti del percorso',entryGuidance:'Ingresso',officialCheck:'Verifica ufficiale',connectionRequired:'coincidenza necessaria',minimumTravel:'tempo minimo',cruiseTemplate:'Modello crociera',onboardNights:'notti a bordo',seaDays:'giorni in mare',portCall:'Scalo',embarkation:'Imbarco',disembarkation:'Sbarco',border:'Contesto di frontiera',schengenExit:'Uscita Schengen',schengenEntry:'Rientro Schengen',sailingNeeded:'Seleziona una partenza reale per nave, operatore, orari, ormeggio e prezzo.',illustrative:'Illustrativo',searchRoutes:'Cerca itinerari',filterType:'Tipo di viaggio',filterRegion:'Regione',filterDuration:'Durata',all:'Tutti',noRoutes:'Nessun itinerario corrisponde ai filtri.',vehicleSection:'Profilo veicolo (opzionale)',vehicleType:'Veicolo',registrationCountry:'Paese di immatricolazione',fuelType:'Carburante / propulsione',euroClass:'Classe Euro',rentalCrossBorder:'Noleggio autorizzato oltre confine',privateCar:'Auto privata',rentalCar:'Auto a noleggio',camper:'Camper',motorcycle:'Moto',otherVehicle:'Altro',petrol:'Benzina',diesel:'Diesel',hybrid:'Ibrido',pluginHybrid:'Ibrido plug-in',electric:'Elettrico',hydrogen:'Idrogeno',unknown:'Sconosciuto',roadRules:'Contesto stradale',crossBorder:'Transfrontaliero',urbanAccess:'Verifica accesso urbano',vehicleNeeded:'Il profilo veicolo è necessario per pedaggi, ZFE e accessi.',facet_world:'Giro del mondo',facet_round_trip:'Tour',facet_road_trip:'Road trip',facet_cruise:'Crociera',facet_global:'Globale',facet_europe:'Europa',facet_southern_europe:'Europa meridionale',facet_italy:'Italia',facet_mediterranean:'Mediterraneo',facet_north_africa:'Nord Africa',filterMode:'Trasporto',filterTheme:'Tema',results:'itinerari trovati',resetFilters:'Reimposta',details:'Dettagli',start:'Partenza',finish:'Arrivo',previous:'Indietro',next:'Avanti',type:'Tipo',country:'Paese',duration:'Durata',cost:'Costo',segment:'Tratta',stop:'Tappa',currency:'Valuta',facet_rail:'Treno',facet_bus:'Bus',facet_car:'Auto',facet_ferry:'Traghetto',facet_multimodal:'Multimodale',facet_road:'Strada',facet_coach:'Pullman',facet_ground_transfer:'Trasferimento terrestre',story:'Storia',storyPlay:'Avvia storia',storyExit:'Esci dalla storia',storyComplete:'Itinerario completato',chapter:'Capitolo',settings:'Impostazioni',methodology:'Metodologia',share:'Condividi',autoRotate:'Rotazione automatica',highDetail:'Globo ad alta definizione',terrain:'Terreno 3D reale',showPoints:'Punti delle tappe',routeGlow:'Bagliore itinerario',arcThickness:'Spessore linea',reducedMotion:'Movimento ridotto',terrainLoading:'Caricamento terreno 3D…',terrainHint:'Trascina per ruotare · scorri per zoomare · il rilievo reale appare avvicinandoti',routeMethodTitle:'Metodologia itinerario',routeMethodText:'Questo itinerario curato usa dati pubblicabili e fonti verificabili quando disponibili. Orari, prezzi e regole personali variabili restano aperti finché non sono noti date e contesto.',evidenceCoverage:'Copertura fonti',editorialStatus:'Stato editoriale',storyRoute:'Storia itinerario',routeFit:'Route Fit',showFit:'Altri filtri di compatibilità',hideFit:'Nascondi filtri',fitPace:'Ritmo',fitSeason:'Stagione',fitParty:'Compagnia',fitStart:'Partenza itinerario',facet_relaxed:'Rilassato',facet_balanced:'Equilibrato',facet_active:'Attivo',facet_spring:'Primavera',facet_summer:'Estate',facet_autumn:'Autunno',facet_winter:'Inverno',facet_multi_season:'Più stagioni',facet_solo:'Solo',facet_couples:'Coppia',facet_friends:'Amici',facet_families:'Famiglia',resultOne:'itinerario trovato',countryUnit:'paese',countriesUnit:'paesi',facet_city:'Città',facet_cruise_port:'Porto crocieristico',facet_port:'Porto',facet_rail_station:'Stazione ferroviaria',facet_airport:'Aeroporto',facet_island:'Isola',facet_park:'Parco',status_planned:'Pianificato',status_sourced_beta:'Beta con fonti',status_illustrative_template:'Modello illustrativo',status_draft:'Bozza'},
    es:{routes:'Rutas',traveller:'Viajero',flagship:'Flagship',template:'Plantilla',open:'Abrir ruta',days:'días',stops:'paradas',segments:'tramos',global:'Perspectiva global',contextTitle:'Contexto del viajero',contextLead:'Adapta requisitos de entrada, idioma, moneda y origen. Solo se guarda en este dispositivo.',passports:'País del pasaporte',secondPassport:'Segundo pasaporte (opcional)',residence:'Residencia',language:'Idioma',currency:'Moneda',origin:'Ciudad / aeropuerto de salida',adults:'Adultos',children:'Niños',mobility:'Movilidad reducida',save:'Guardar',clear:'Borrar',notSet:'Sin definir',currentCheck:'Revisión actual necesaria',routeLibrary:'Explorar rutas',routeLibraryLead:'Una plataforma para vueltas al mundo, road trips, trenes, cruceros y más.',editorial:'Plantilla editorial — verifica transporte, precios y requisitos para tus fechas.',overview:'Resumen de ruta',day:'Día',nights:'noches',transport:'Transporte',verification:'Verificación',backWorld:'Ruta mundial',private:'Privado en este dispositivo. Nunca pedimos números de pasaporte, reservas ni pagos.',sourcedBeta:'Beta con fuentes',sources:'Fuentes',lastChecked:'Última revisión',publishedFrom:'desde',verified:'Verificado',routeEvidence:'Fuentes de ruta',entryGuidance:'Entrada',officialCheck:'Comprobación oficial',connectionRequired:'conexión necesaria',minimumTravel:'tiempo mínimo',cruiseTemplate:'Plantilla de crucero',onboardNights:'noches a bordo',seaDays:'días de navegación',portCall:'Escala',embarkation:'Embarque',disembarkation:'Desembarque',border:'Contexto fronterizo',schengenExit:'Salida de Schengen',schengenEntry:'Reentrada a Schengen',sailingNeeded:'Selecciona una salida real para barco, operador, horarios, atraque y precio.',illustrative:'Ilustrativo',searchRoutes:'Buscar rutas',filterType:'Tipo de viaje',filterRegion:'Región',filterDuration:'Duración',all:'Todas',noRoutes:'Ninguna ruta coincide con los filtros.',vehicleSection:'Contexto del vehículo (opcional)',vehicleType:'Vehículo',registrationCountry:'País de matriculación',fuelType:'Combustible / propulsión',euroClass:'Clase Euro',rentalCrossBorder:'Alquiler autorizado para cruzar fronteras',privateCar:'Coche privado',rentalCar:'Coche de alquiler',camper:'Camper',motorcycle:'Moto',otherVehicle:'Otro',petrol:'Gasolina',diesel:'Diésel',hybrid:'Híbrido',pluginHybrid:'Híbrido enchufable',electric:'Eléctrico',hydrogen:'Hidrógeno',unknown:'Desconocido',roadRules:'Contexto vial',crossBorder:'Transfronterizo',urbanAccess:'Comprobar acceso urbano',vehicleNeeded:'Se requiere contexto del vehículo para peajes, ZBE y accesos.',facet_world:'Vuelta al mundo',facet_round_trip:'Ruta circular',facet_road_trip:'Road trip',facet_cruise:'Crucero',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Sur de Europa',facet_italy:'Italia',facet_mediterranean:'Mediterráneo',facet_north_africa:'Norte de África',filterMode:'Transporte',filterTheme:'Tema',results:'rutas encontradas',resetFilters:'Restablecer',details:'Detalles',start:'Inicio',finish:'Final',previous:'Anterior',next:'Siguiente',type:'Tipo',country:'País',duration:'Duración',cost:'Coste',segment:'Tramo',stop:'Parada',currency:'Moneda',facet_rail:'Tren',facet_bus:'Bus',facet_car:'Coche',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Carretera',facet_coach:'Autocar',facet_ground_transfer:'Traslado terrestre',story:'Historia',storyPlay:'Reproducir historia',storyExit:'Salir de la historia',storyComplete:'Ruta completada',chapter:'Capítulo',settings:'Ajustes',methodology:'Metodología',share:'Compartir',autoRotate:'Rotación automática',highDetail:'Globo de alta definición',terrain:'Terreno 3D real',showPoints:'Puntos de parada',routeGlow:'Brillo de ruta',arcThickness:'Grosor de ruta',reducedMotion:'Movimiento reducido',terrainLoading:'Cargando terreno 3D…',terrainHint:'Arrastra para girar · desplázate para acercar · el relieve real aparece al aproximarte',routeMethodTitle:'Metodología de ruta',routeMethodText:'Esta ruta curada usa datos publicables y evidencia con fuentes cuando está disponible. Horarios, precios y reglas personales variables permanecen abiertos hasta conocer fechas y contexto.',evidenceCoverage:'Cobertura de fuentes',editorialStatus:'Estado editorial',storyRoute:'Historia de la ruta',routeFit:'Route Fit',showFit:'Más filtros de ajuste',hideFit:'Ocultar filtros',fitPace:'Ritmo',fitSeason:'Temporada',fitParty:'Compañía',fitStart:'Inicio de ruta',facet_relaxed:'Relajado',facet_balanced:'Equilibrado',facet_active:'Activo',facet_spring:'Primavera',facet_summer:'Verano',facet_autumn:'Otoño',facet_winter:'Invierno',facet_multi_season:'Varias estaciones',facet_solo:'Solo',facet_couples:'Pareja',facet_friends:'Amigos',facet_families:'Familia',resultOne:'ruta encontrada',countryUnit:'país',countriesUnit:'países',facet_city:'Ciudad',facet_cruise_port:'Puerto de cruceros',facet_port:'Puerto',facet_rail_station:'Estación de tren',facet_airport:'Aeropuerto',facet_island:'Isla',facet_park:'Parque',status_planned:'Planificado',status_sourced_beta:'Beta con fuentes',status_illustrative_template:'Plantilla ilustrativa',status_draft:'Borrador'},
    fr:{routes:'Itinéraires',traveller:'Voyageur',flagship:'Flagship',template:'Modèle',open:'Ouvrir',days:'jours',stops:'étapes',segments:'segments',global:'Perspective globale',contextTitle:'Contexte voyageur',contextLead:'Adapte formalités, langue, devise et départ. Stocké uniquement sur cet appareil.',passports:'Pays du passeport',secondPassport:'Deuxième passeport (facultatif)',residence:'Résidence',language:'Langue',currency:'Devise',origin:'Ville / aéroport de départ',adults:'Adultes',children:'Enfants',mobility:'Mobilité réduite',save:'Enregistrer',clear:'Effacer',notSet:'Non défini',currentCheck:'Vérification actuelle requise',routeLibrary:'Explorer les itinéraires',routeLibraryLead:'Une plateforme pour tours du monde, road trips, train, croisières et plus.',editorial:'Modèle éditorial — vérifiez transports, prix et formalités pour vos dates.',overview:'Aperçu',day:'Jour',nights:'nuits',transport:'Transport',verification:'Vérification',backWorld:'Tour du monde',private:'Privé sur cet appareil. Aucun numéro de passeport, référence de réservation ou paiement n’est demandé.',sourcedBeta:'Bêta sourcée',sources:'Sources',lastChecked:'Dernière vérification',publishedFrom:'à partir de',verified:'Vérifié',routeEvidence:'Sources de l’itinéraire',entryGuidance:'Entrée',officialCheck:'Vérification officielle',connectionRequired:'correspondance nécessaire',minimumTravel:'temps minimum',cruiseTemplate:'Modèle croisière',onboardNights:'nuits à bord',seaDays:'jours en mer',portCall:'Escale',embarkation:'Embarquement',disembarkation:'Débarquement',border:'Contexte frontalier',schengenExit:'Sortie Schengen',schengenEntry:'Rentrée Schengen',sailingNeeded:'Sélectionnez un départ réel pour le navire, l’opérateur, les horaires, le quai et le prix.',illustrative:'Illustratif',searchRoutes:'Rechercher des itinéraires',filterType:'Type de voyage',filterRegion:'Région',filterDuration:'Durée',all:'Tous',noRoutes:'Aucun itinéraire ne correspond aux filtres.',vehicleSection:'Contexte véhicule (facultatif)',vehicleType:'Véhicule',registrationCountry:'Pays d’immatriculation',fuelType:'Carburant / motorisation',euroClass:'Classe Euro',rentalCrossBorder:'Location autorisée à franchir les frontières',privateCar:'Voiture privée',rentalCar:'Voiture de location',camper:'Camping-car',motorcycle:'Moto',otherVehicle:'Autre',petrol:'Essence',diesel:'Diesel',hybrid:'Hybride',pluginHybrid:'Hybride rechargeable',electric:'Électrique',hydrogen:'Hydrogène',unknown:'Inconnu',roadRules:'Contexte routier',crossBorder:'Transfrontalier',urbanAccess:'Vérifier l’accès urbain',vehicleNeeded:'Le contexte véhicule est requis pour péages, ZFE et accès.',facet_world:'Tour du monde',facet_round_trip:'Circuit',facet_road_trip:'Road trip',facet_cruise:'Croisière',facet_global:'Mondial',facet_europe:'Europe',facet_southern_europe:'Europe du Sud',facet_italy:'Italie',facet_mediterranean:'Méditerranée',facet_north_africa:'Afrique du Nord',filterMode:'Transport',filterTheme:'Thème',results:'itinéraires trouvés',resetFilters:'Réinitialiser',details:'Détails',start:'Départ',finish:'Arrivée',previous:'Précédent',next:'Suivant',type:'Type',country:'Pays',duration:'Durée',cost:'Coût',segment:'Segment',stop:'Étape',currency:'Devise',facet_rail:'Train',facet_bus:'Bus',facet_car:'Voiture',facet_ferry:'Ferry',facet_multimodal:'Multimodal',facet_road:'Route',facet_coach:'Autocar',facet_ground_transfer:'Transfert terrestre',story:'Récit',storyPlay:'Lire le récit',storyExit:'Quitter le récit',storyComplete:'Itinéraire terminé',chapter:'Chapitre',settings:'Réglages',methodology:'Méthodologie',share:'Partager',autoRotate:'Rotation automatique',highDetail:'Globe haute définition',terrain:'Relief 3D réel',showPoints:'Points d’étape',routeGlow:'Lueur de route',arcThickness:'Épaisseur de route',reducedMotion:'Mouvement réduit',terrainLoading:'Chargement du relief 3D…',terrainHint:'Faites glisser pour tourner · faites défiler pour zoomer · le relief réel apparaît en vous rapprochant',routeMethodTitle:'Méthodologie de l’itinéraire',routeMethodText:'Cet itinéraire éditorialisé utilise des données publiables et des preuves sourcées lorsque disponibles. Horaires, prix et règles personnelles variables restent ouverts jusqu’à connaître les dates et le contexte.',evidenceCoverage:'Couverture des sources',editorialStatus:'Statut éditorial',storyRoute:'Récit de l’itinéraire',routeFit:'Route Fit',showFit:'Plus de filtres adaptés',hideFit:'Masquer les filtres',fitPace:'Rythme',fitSeason:'Saison',fitParty:'Avec qui',fitStart:'Départ de l’itinéraire',facet_relaxed:'Détendu',facet_balanced:'Équilibré',facet_active:'Actif',facet_spring:'Printemps',facet_summer:'Été',facet_autumn:'Automne',facet_winter:'Hiver',facet_multi_season:'Plusieurs saisons',facet_solo:'Solo',facet_couples:'Couple',facet_friends:'Amis',facet_families:'Famille',resultOne:'itinéraire trouvé',countryUnit:'pays',countriesUnit:'pays',facet_city:'Ville',facet_cruise_port:'Port de croisière',facet_port:'Port',facet_rail_station:'Gare',facet_airport:'Aéroport',facet_island:'Île',facet_park:'Parc',status_planned:'Planifié',status_sourced_beta:'Bêta sourcée',status_illustrative_template:'Modèle illustratif',status_draft:'Brouillon'},
    pt:{routes:'Rotas',traveller:'Viajante',flagship:'Flagship',template:'Modelo',open:'Abrir rota',days:'dias',stops:'paradas',segments:'trechos',global:'Perspectiva global',contextTitle:'Contexto do viajante',contextLead:'Adapta entrada, idioma, moeda e origem. Guardado apenas neste dispositivo.',passports:'País do passaporte',secondPassport:'Segundo passaporte (opcional)',residence:'Residência',language:'Idioma',currency:'Moeda',origin:'Cidade / aeroporto de partida',adults:'Adultos',children:'Crianças',mobility:'Mobilidade reduzida',save:'Salvar',clear:'Limpar',notSet:'Não definido',currentCheck:'Verificação atual necessária',routeLibrary:'Explorar rotas',routeLibraryLead:'Uma plataforma para voltas ao mundo, road trips, trem, cruzeiros e mais.',editorial:'Modelo editorial — verifique transporte, preços e entrada para suas datas.',overview:'Visão geral',day:'Dia',nights:'noites',transport:'Transporte',verification:'Verificação',backWorld:'Rota mundial',private:'Privado neste dispositivo. Nunca pedimos número de passaporte, referência de reserva ou pagamento.',sourcedBeta:'Beta com fontes',sources:'Fontes',lastChecked:'Última verificação',publishedFrom:'a partir de',verified:'Verificado',routeEvidence:'Fontes da rota',entryGuidance:'Entrada',officialCheck:'Verificação oficial',connectionRequired:'conexão necessária',minimumTravel:'tempo mínimo',cruiseTemplate:'Modelo de cruzeiro',onboardNights:'noites a bordo',seaDays:'dias no mar',portCall:'Escala',embarkation:'Embarque',disembarkation:'Desembarque',border:'Contexto de fronteira',schengenExit:'Saída de Schengen',schengenEntry:'Reentrada em Schengen',sailingNeeded:'Selecione uma partida real para navio, operadora, horários, cais e preço.',illustrative:'Ilustrativo',searchRoutes:'Pesquisar rotas',filterType:'Tipo de viagem',filterRegion:'Região',filterDuration:'Duração',all:'Todas',noRoutes:'Nenhuma rota corresponde aos filtros.',vehicleSection:'Contexto do veículo (opcional)',vehicleType:'Veículo',registrationCountry:'País de matrícula',fuelType:'Combustível / motorização',euroClass:'Classe Euro',rentalCrossBorder:'Aluguel autorizado para cruzar fronteiras',privateCar:'Carro particular',rentalCar:'Carro alugado',camper:'Motorhome',motorcycle:'Moto',otherVehicle:'Outro',petrol:'Gasolina',diesel:'Diesel',hybrid:'Híbrido',pluginHybrid:'Híbrido plug-in',electric:'Elétrico',hydrogen:'Hidrogênio',unknown:'Desconhecido',roadRules:'Contexto rodoviário',crossBorder:'Transfronteiriço',urbanAccess:'Verificar acesso urbano',vehicleNeeded:'O contexto do veículo é necessário para portagens, ZBE e acessos.',facet_world:'Volta ao mundo',facet_round_trip:'Roteiro circular',facet_road_trip:'Road trip',facet_cruise:'Cruzeiro',facet_global:'Global',facet_europe:'Europa',facet_southern_europe:'Sul da Europa',facet_italy:'Itália',facet_mediterranean:'Mediterrâneo',facet_north_africa:'Norte da África',filterMode:'Transporte',filterTheme:'Tema',results:'rotas encontradas',resetFilters:'Redefinir',details:'Detalhes',start:'Início',finish:'Fim',previous:'Anterior',next:'Seguinte',type:'Tipo',country:'País',duration:'Duração',cost:'Custo',segment:'Trecho',stop:'Parada',currency:'Moeda',facet_rail:'Trem',facet_bus:'Ônibus',facet_car:'Carro',facet_ferry:'Balsa',facet_multimodal:'Multimodal',facet_road:'Estrada',facet_coach:'Ônibus rodoviário',facet_ground_transfer:'Transfer terrestre',story:'História',storyPlay:'Reproduzir história',storyExit:'Sair da história',storyComplete:'Rota concluída',chapter:'Capítulo',settings:'Definições',methodology:'Metodologia',share:'Partilhar',autoRotate:'Rotação automática',highDetail:'Globo de alta definição',terrain:'Terreno 3D real',showPoints:'Pontos de paragem',routeGlow:'Brilho da rota',arcThickness:'Espessura da rota',reducedMotion:'Movimento reduzido',terrainLoading:'A carregar terreno 3D…',terrainHint:'Arraste para rodar · desloque para ampliar · o relevo real aparece ao aproximar',routeMethodTitle:'Metodologia da rota',routeMethodText:'Esta rota curada usa dados publicáveis e evidência com fontes quando disponível. Horários, preços e regras pessoais variáveis permanecem em aberto até serem conhecidas as datas e o contexto.',evidenceCoverage:'Cobertura de fontes',editorialStatus:'Estado editorial',storyRoute:'História da rota',routeFit:'Route Fit',showFit:'Mais filtros de adequação',hideFit:'Ocultar filtros',fitPace:'Ritmo',fitSeason:'Estação',fitParty:'Com quem viaja',fitStart:'Início da rota',facet_relaxed:'Relaxado',facet_balanced:'Equilibrado',facet_active:'Ativo',facet_spring:'Primavera',facet_summer:'Verão',facet_autumn:'Outono',facet_winter:'Inverno',facet_multi_season:'Várias estações',facet_solo:'Solo',facet_couples:'Casal',facet_friends:'Amigos',facet_families:'Família',resultOne:'rota encontrada',countryUnit:'país',countriesUnit:'países',facet_city:'Cidade',facet_cruise_port:'Porto de cruzeiros',facet_port:'Porto',facet_rail_station:'Estação ferroviária',facet_airport:'Aeroporto',facet_island:'Ilha',facet_park:'Parque',status_planned:'Planeado',status_sourced_beta:'Beta com fontes',status_illustrative_template:'Modelo ilustrativo',status_draft:'Rascunho'}
  };


  const LEGACY_WORLD_TEXT = {
    de:{
      '195 countries · one continuous journey':'195 Länder · eine zusammenhängende Reise',
      'PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'ÖFFENTLICHER PLAN · STAND 17. SEP. 2026',
      'Every country.':'Jedes Land.','One route.':'Eine Route.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Ein transparentes Projekt, das alle 195 souveränen Staaten zu einer zusammenhängenden Reise verbindet – mit offen dargestellten Verkehrsetappen, Visa, Kosten und Einschränkungen.',
      'Explore':'Erkunden','Operations':'Operationen','Country, segment, route…':'Land, Segment, Route…',
      'Layer':'Ebene','Reset':'Zurücksetzen','Route':'Route','Status':'Status','Visa':'Visum','Health':'Gesundheit','Cost':'Kosten','Risk':'Risiko','Progress':'Fortschritt','Critical':'Kritisch',
      'Filters':'Filter','Transport':'Verkehrsmittel','All modes':'Alle Verkehrsmittel','Booking tier':'Buchungsstufe','All tiers':'Alle Stufen','Feasibility':'Machbarkeit','All':'Alle','Alert':'Warnstufe','All alerts':'Alle Warnstufen',
      'Journey intelligence':'Reiseanalyse','Install':'Installieren','Stats':'Statistik','Live':'Live','Journal':'Reisetagebuch','Changes':'Änderungen',
      'Overview':'Übersicht','Details':'Details','Ops':'Betrieb','Sources':'Quellen','Speed':'Tempo','START':'START','FINISH':'ZIEL',
      'Globe settings':'Globus-Einstellungen','Auto rotate':'Automatisch drehen','High detail globe':'Hochauflösender Globus','Real 3D globe terrain':'Echtes 3D-Terrain','Country points':'Länderpunkte','Route glow':'Routenleuchten','Arc thickness':'Linienstärke','Reduced motion':'Reduzierte Bewegung','Share view':'Ansicht teilen','Methodology':'Methodik',
      'METHODOLOGY':'METHODIK','A public travel-operations experiment.':'Ein öffentliches Reiseplanungs-Experiment.',
      'This explorer is generated from a private operational master workbook. Only publication-safe fields are exported. Booking references, payment data, passport details, insurance identifiers, private document links and personal contacts never enter the public dataset.':'Dieser Explorer wird aus einer privaten operativen Masterplanung erzeugt. Veröffentlicht werden nur unkritische Felder. Buchungsreferenzen, Zahlungsdaten, Passdaten, Versicherungskennungen, private Dokumentlinks und persönliche Kontakte gelangen niemals in den öffentlichen Datensatz.',
      'Sovereign states in scope':'Souveräne Staaten im Umfang','International legs':'Internationale Legs','Planned days':'Geplante Tage','Base planning envelope':'Basis-Planungsrahmen',
      'What “verified” means':'Was „verifiziert“ bedeutet','Segments may cite airlines, immigration authorities or government sources. A published transport corridor is not a safety recommendation. Volatile borders and high-risk states are intentionally surfaced as uncertainty rather than hidden.':'Segmente können Airlines, Einwanderungsbehörden oder Regierungsquellen zitieren. Eine veröffentlichte Verkehrsverbindung ist keine Sicherheitsempfehlung. Volatile Grenzen und Hochrisikostaaten werden bewusst als Unsicherheit sichtbar gemacht und nicht verborgen.',
      'North Korea':'Nordkorea','DPRK remains outside the executable 194-country calendar until legal tourism for the relevant passport is operationally available. It is never counted as completed without legal physical entry.':'Nordkorea bleibt außerhalb des ausführbaren 194-Länder-Kalenders, bis legaler Tourismus für den jeweiligen Pass tatsächlich möglich ist. Ohne legale physische Einreise wird es niemals als abgeschlossen gezählt.',
      'Search a country, segment, visa, transport…':'Land, Segment, Visum oder Verkehrsmittel suchen…','Search results':'Suchergebnisse','Jump to route':'Zur Route springen',
      'Play the journey':'Reise abspielen','Follow all 194 route legs':'Allen 194 Etappen folgen','Exit story':'Story beenden','Current chapter':'Aktuelles Kapitel','Journey position':'Reiseposition','Route context':'Routenkontext',
      'Country':'Land','Readiness':'Bereitschaft','Planned entry':'Geplante Einreise','Arrival':'Ankunft','Next':'Weiter','Departure':'Abfahrt','Phase':'Phase','Plan budget':'Planbudget','Why this route?':'Warum diese Route?',
      'visible legs':'sichtbare Legs','transport model':'Verkehrsmodell','critical':'kritisch','countries':'Länder','planned days':'geplante Tage','intl. legs':'internationale Legs','base model':'Basismodell',
      'Route legs':'Routen-Legs','Planned duration':'Geplante Dauer','Route distance':'Routendistanz','Transport model':'Verkehrsmodell','Chapters':'Kapitel','Transport mix':'Verkehrsmix','sovereign states':'souveräne Staaten','executable segments':'ausführbare Segmente','continuous route':'zusammenhängende Route','No actual journey events yet.':'Noch keine tatsächlichen Reiseereignisse.'
    },
    it:{
      '195 countries · one continuous journey':'195 paesi · un unico viaggio continuo','PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'PIANO PUBBLICO · AGGIORNATO 17 SET 2026','Every country.':'Ogni paese.','One route.':'Un solo itinerario.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Un progetto trasparente per collegare tutti i 195 stati sovrani in un unico viaggio continuo, con trasporti, visti, costi e vincoli mostrati apertamente.',
      'Explore':'Esplora','Operations':'Operazioni','Country, segment, route…':'Paese, segmento, itinerario…','Layer':'Livello','Reset':'Reimposta','Route':'Itinerario','Status':'Stato','Visa':'Visto','Health':'Salute','Cost':'Costo','Risk':'Rischio','Progress':'Progresso','Critical':'Critico',
      'Filters':'Filtri','Transport':'Trasporto','All modes':'Tutti i mezzi','Booking tier':'Livello prenotazione','All tiers':'Tutti i livelli','Feasibility':'Fattibilità','All':'Tutti','Alert':'Avviso','All alerts':'Tutti gli avvisi',
      'Journey intelligence':'Analisi del viaggio','Install':'Installa','Stats':'Statistiche','Live':'Live','Journal':'Diario','Changes':'Modifiche','Overview':'Panoramica','Details':'Dettagli','Ops':'Operazioni','Sources':'Fonti','Speed':'Velocità','START':'PARTENZA','FINISH':'ARRIVO',
      'Globe settings':'Impostazioni globo','Auto rotate':'Rotazione automatica','High detail globe':'Globo ad alta definizione','Real 3D globe terrain':'Terreno 3D reale','Country points':'Punti dei paesi','Route glow':'Bagliore itinerario','Arc thickness':'Spessore linee','Reduced motion':'Movimento ridotto','Share view':'Condividi vista','Methodology':'Metodologia',
      'METHODOLOGY':'METODOLOGIA','A public travel-operations experiment.':'Un esperimento pubblico di pianificazione dei viaggi.','Sovereign states in scope':'Stati sovrani inclusi','International legs':'Tratte internazionali','Planned days':'Giorni pianificati','Base planning envelope':'Budget base di pianificazione',
      'What “verified” means':'Cosa significa “verificato”','North Korea':'Corea del Nord','Search a country, segment, visa, transport…':'Cerca paese, segmento, visto o trasporto…','Search results':'Risultati','Jump to route':'Vai all’itinerario',
      'Play the journey':'Riproduci il viaggio','Follow all 194 route legs':'Segui tutte le 194 tratte','Exit story':'Esci dalla storia','Current chapter':'Capitolo attuale','Journey position':'Posizione nel viaggio','Route context':'Contesto itinerario','Country':'Paese','Readiness':'Prontezza','Planned entry':'Ingresso previsto','Arrival':'Arrivo','Next':'Successivo','Departure':'Partenza','Phase':'Fase','Plan budget':'Budget previsto','Why this route?':'Perché questo itinerario?','visible legs':'tratte visibili','transport model':'modello trasporti','critical':'critico','countries':'paesi','planned days':'giorni previsti','intl. legs':'tratte internazionali','base model':'modello base'
    },
    es:{
      '195 countries · one continuous journey':'195 países · un viaje continuo','PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'PLAN PÚBLICO · ACTUALIZADO 17 SEP 2026','Every country.':'Cada país.','One route.':'Una ruta.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Un proyecto transparente para conectar los 195 estados soberanos en un único viaje continuo, mostrando transportes, visados, costes y restricciones.',
      'Explore':'Explorar','Operations':'Operaciones','Country, segment, route…':'País, segmento, ruta…','Layer':'Capa','Reset':'Restablecer','Route':'Ruta','Status':'Estado','Visa':'Visado','Health':'Salud','Cost':'Coste','Risk':'Riesgo','Progress':'Progreso','Critical':'Crítico',
      'Filters':'Filtros','Transport':'Transporte','All modes':'Todos los medios','Booking tier':'Nivel de reserva','All tiers':'Todos los niveles','Feasibility':'Viabilidad','All':'Todos','Alert':'Alerta','All alerts':'Todas las alertas','Journey intelligence':'Análisis del viaje','Install':'Instalar','Stats':'Estadísticas','Live':'En vivo','Journal':'Diario','Changes':'Cambios',
      'Overview':'Resumen','Details':'Detalles','Ops':'Operaciones','Sources':'Fuentes','Speed':'Velocidad','START':'INICIO','FINISH':'FINAL','Globe settings':'Ajustes del globo','Auto rotate':'Rotación automática','High detail globe':'Globo de alta definición','Real 3D globe terrain':'Terreno 3D real','Country points':'Puntos de países','Route glow':'Brillo de ruta','Arc thickness':'Grosor de líneas','Reduced motion':'Movimiento reducido','Share view':'Compartir vista','Methodology':'Metodología',
      'METHODOLOGY':'METODOLOGÍA','A public travel-operations experiment.':'Un experimento público de planificación de viajes.','Sovereign states in scope':'Estados soberanos incluidos','International legs':'Tramos internacionales','Planned days':'Días previstos','Base planning envelope':'Marco presupuestario base','What “verified” means':'Qué significa “verificado”','North Korea':'Corea del Norte',
      'Search a country, segment, visa, transport…':'Buscar país, segmento, visado o transporte…','Search results':'Resultados','Jump to route':'Ir a la ruta','Play the journey':'Reproducir el viaje','Follow all 194 route legs':'Seguir los 194 tramos','Exit story':'Salir de la historia','Current chapter':'Capítulo actual','Journey position':'Posición del viaje','Route context':'Contexto de ruta','Country':'País','Readiness':'Preparación','Planned entry':'Entrada prevista','Arrival':'Llegada','Next':'Siguiente','Departure':'Salida','Phase':'Fase','Plan budget':'Presupuesto previsto','Why this route?':'¿Por qué esta ruta?','visible legs':'tramos visibles','transport model':'modelo de transporte','critical':'crítico','countries':'países','planned days':'días previstos','intl. legs':'tramos internacionales','base model':'modelo base'
    },
    fr:{
      '195 countries · one continuous journey':'195 pays · un voyage continu','PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'PLAN PUBLIC · MISE À JOUR 17 SEPT. 2026','Every country.':'Chaque pays.','One route.':'Un seul itinéraire.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Un projet transparent pour relier les 195 États souverains en un seul voyage continu, avec transports, visas, coûts et contraintes affichés ouvertement.',
      'Explore':'Explorer','Operations':'Opérations','Country, segment, route…':'Pays, segment, itinéraire…','Layer':'Couche','Reset':'Réinitialiser','Route':'Itinéraire','Status':'Statut','Visa':'Visa','Health':'Santé','Cost':'Coût','Risk':'Risque','Progress':'Progression','Critical':'Critique',
      'Filters':'Filtres','Transport':'Transport','All modes':'Tous les modes','Booking tier':'Niveau de réservation','All tiers':'Tous les niveaux','Feasibility':'Faisabilité','All':'Tous','Alert':'Alerte','All alerts':'Toutes les alertes','Journey intelligence':'Analyse du voyage','Install':'Installer','Stats':'Statistiques','Live':'En direct','Journal':'Journal','Changes':'Modifications',
      'Overview':'Aperçu','Details':'Détails','Ops':'Opérations','Sources':'Sources','Speed':'Vitesse','START':'DÉPART','FINISH':'ARRIVÉE','Globe settings':'Réglages du globe','Auto rotate':'Rotation automatique','High detail globe':'Globe haute définition','Real 3D globe terrain':'Relief 3D réel','Country points':'Points pays','Route glow':'Lueur de route','Arc thickness':'Épaisseur des lignes','Reduced motion':'Mouvement réduit','Share view':'Partager la vue','Methodology':'Méthodologie',
      'METHODOLOGY':'MÉTHODOLOGIE','A public travel-operations experiment.':'Une expérimentation publique de planification de voyage.','Sovereign states in scope':'États souverains couverts','International legs':'Étapes internationales','Planned days':'Jours planifiés','Base planning envelope':'Budget de planification de base','What “verified” means':'Ce que signifie « vérifié »','North Korea':'Corée du Nord',
      'Search a country, segment, visa, transport…':'Rechercher pays, segment, visa ou transport…','Search results':'Résultats','Jump to route':'Aller à l’itinéraire','Play the journey':'Lire le voyage','Follow all 194 route legs':'Suivre les 194 étapes','Exit story':'Quitter le récit','Current chapter':'Chapitre actuel','Journey position':'Position du voyage','Route context':'Contexte de route','Country':'Pays','Readiness':'Préparation','Planned entry':'Entrée prévue','Arrival':'Arrivée','Next':'Suivant','Departure':'Départ','Phase':'Phase','Plan budget':'Budget prévu','Why this route?':'Pourquoi cet itinéraire ?','visible legs':'étapes visibles','transport model':'modèle de transport','critical':'critique','countries':'pays','planned days':'jours planifiés','intl. legs':'étapes internationales','base model':'modèle de base'
    },
    pt:{
      '195 countries · one continuous journey':'195 países · uma viagem contínua','PUBLIC PLAN · SNAPSHOT 17 SEP 2026':'PLANO PÚBLICO · ATUALIZADO 17 SET 2026','Every country.':'Cada país.','One route.':'Uma rota.',
      'A transparent experiment to connect all 195 sovereign states in one continuous journey — with every transport leg, visa, cost and constraint mapped openly.':'Um projeto transparente para ligar os 195 estados soberanos numa única viagem contínua, mostrando transportes, vistos, custos e restrições.',
      'Explore':'Explorar','Operations':'Operações','Country, segment, route…':'País, segmento, rota…','Layer':'Camada','Reset':'Redefinir','Route':'Rota','Status':'Estado','Visa':'Visto','Health':'Saúde','Cost':'Custo','Risk':'Risco','Progress':'Progresso','Critical':'Crítico',
      'Filters':'Filtros','Transport':'Transporte','All modes':'Todos os meios','Booking tier':'Nível de reserva','All tiers':'Todos os níveis','Feasibility':'Viabilidade','All':'Todos','Alert':'Alerta','All alerts':'Todos os alertas','Journey intelligence':'Análise da viagem','Install':'Instalar','Stats':'Estatísticas','Live':'Ao vivo','Journal':'Diário','Changes':'Alterações',
      'Overview':'Visão geral','Details':'Detalhes','Ops':'Operações','Sources':'Fontes','Speed':'Velocidade','START':'INÍCIO','FINISH':'FIM','Globe settings':'Definições do globo','Auto rotate':'Rotação automática','High detail globe':'Globo de alta definição','Real 3D globe terrain':'Terreno 3D real','Country points':'Pontos dos países','Route glow':'Brilho da rota','Arc thickness':'Espessura das linhas','Reduced motion':'Movimento reduzido','Share view':'Partilhar vista','Methodology':'Metodologia',
      'METHODOLOGY':'METODOLOGIA','A public travel-operations experiment.':'Uma experiência pública de planeamento de viagem.','Sovereign states in scope':'Estados soberanos abrangidos','International legs':'Trechos internacionais','Planned days':'Dias planeados','Base planning envelope':'Orçamento base de planeamento','What “verified” means':'O que significa “verificado”','North Korea':'Coreia do Norte',
      'Search a country, segment, visa, transport…':'Pesquisar país, segmento, visto ou transporte…','Search results':'Resultados','Jump to route':'Ir para a rota','Play the journey':'Reproduzir a viagem','Follow all 194 route legs':'Seguir os 194 trechos','Exit story':'Sair da história','Current chapter':'Capítulo atual','Journey position':'Posição na viagem','Route context':'Contexto da rota','Country':'País','Readiness':'Preparação','Planned entry':'Entrada planeada','Arrival':'Chegada','Next':'Seguinte','Departure':'Partida','Phase':'Fase','Plan budget':'Orçamento previsto','Why this route?':'Porquê esta rota?','visible legs':'trechos visíveis','transport model':'modelo de transporte','critical':'crítico','countries':'países','planned days':'dias planeados','intl. legs':'trechos internacionais','base model':'modelo base'
    }
  };

  const LEGACY_PHASES={
    de:{'Europe I':'Europa I','North & Central America':'Nord- & Mittelamerika','Caribbean':'Karibik','South America':'Südamerika','South Pacific':'Südpazifik','Southeast Asia & Indian Ocean':'Südostasien & Indischer Ozean','East & Central Asia':'Ost- & Zentralasien','Levant & North Africa':'Levante & Nordafrika','West & Central Africa':'West- & Zentralafrika','Southern & East Africa':'Süd- & Ostafrika','Gulf & Levant':'Golf & Levante','Europe II · Finish':'Europa II · Ziel'},
    it:{'Europe I':'Europa I','North & Central America':'Nord e Centro America','Caribbean':'Caraibi','South America':'Sud America','South Pacific':'Pacifico meridionale','Southeast Asia & Indian Ocean':'Sud-est asiatico e Oceano Indiano','East & Central Asia':'Asia orientale e centrale','Levant & North Africa':'Levante e Nord Africa','West & Central Africa':'Africa occidentale e centrale','Southern & East Africa':'Africa meridionale e orientale','Gulf & Levant':'Golfo e Levante','Europe II · Finish':'Europa II · Arrivo'},
    es:{'Europe I':'Europa I','North & Central America':'Norte y Centroamérica','Caribbean':'Caribe','South America':'Sudamérica','South Pacific':'Pacífico Sur','Southeast Asia & Indian Ocean':'Sudeste Asiático y Océano Índico','East & Central Asia':'Asia Oriental y Central','Levant & North Africa':'Levante y Norte de África','West & Central Africa':'África Occidental y Central','Southern & East Africa':'África Meridional y Oriental','Gulf & Levant':'Golfo y Levante','Europe II · Finish':'Europa II · Final'},
    fr:{'Europe I':'Europe I','North & Central America':'Amérique du Nord et centrale','Caribbean':'Caraïbes','South America':'Amérique du Sud','South Pacific':'Pacifique Sud','Southeast Asia & Indian Ocean':'Asie du Sud-Est et océan Indien','East & Central Asia':'Asie de l’Est et centrale','Levant & North Africa':'Levant et Afrique du Nord','West & Central Africa':'Afrique de l’Ouest et centrale','Southern & East Africa':'Afrique australe et orientale','Gulf & Levant':'Golfe et Levant','Europe II · Finish':'Europe II · Arrivée'},
    pt:{'Europe I':'Europa I','North & Central America':'América do Norte e Central','Caribbean':'Caraíbas','South America':'América do Sul','South Pacific':'Pacífico Sul','Southeast Asia & Indian Ocean':'Sudeste Asiático e Oceano Índico','East & Central Asia':'Ásia Oriental e Central','Levant & North Africa':'Levante e Norte de África','West & Central Africa':'África Ocidental e Central','Southern & East Africa':'África Austral e Oriental','Gulf & Levant':'Golfo e Levante','Europe II · Finish':'Europa II · Fim'}
  };

  const LEGACY_EXTRA={
    de:{
      'Europe':'Europa','Western Europe':'Westeuropa','Eastern Europe':'Osteuropa','Northern Europe':'Nordeuropa','Southern Europe':'Südeuropa','Asia':'Asien','Africa':'Afrika','Americas':'Amerika','Oceania':'Ozeanien',
      'Ready':'Bereit','READY':'BEREIT','Blocked':'Blockiert','BLOCKED':'BLOCKIERT','Pending':'Ausstehend','Conditional':'Bedingt','Critical':'Kritisch','Verified':'Verifiziert','Not verified':'Nicht verifiziert','Not recorded':'Nicht erfasst','Not started':'Nicht gestartet',
      'Action':'Aktion','From':'Von','Duration':'Dauer','Distance unknown':'Distanz unbekannt','Mode to confirm':'Verkehrsmittel prüfen','Plan depart':'Plan-Abfahrt','Plan arrive':'Plan-Ankunft','Planned':'Geplant','Planned start':'Geplanter Start','Actual status':'Ist-Status','Actual spend':'Tatsächliche Ausgaben','Last update':'Letzte Aktualisierung',
      'Clear / approved':'Frei / genehmigt','Conditional feasibility':'Bedingte Machbarkeit','Critical feasibility':'Kritische Machbarkeit','Plannable / verified':'Planbar / verifiziert','Countries in legs':'Länder in Legs','Countries without coordinates':'Länder ohne Koordinaten','Cumulative transport budget':'Kumuliertes Verkehrsbudget','Other hidden':'Weitere ausgeblendet',
      'Next segment':'Nächstes Segment','Play / pause journey':'Reise starten / pausieren','Play journey from here':'Reise ab hier starten','Play or pause journey':'Reise starten oder pausieren','Close':'Schließen','Copy the URL from your browser':'URL aus dem Browser kopieren',
      'Loading 3D globe terrain…':'3D-Globus-Terrain wird geladen…','Loading globe, map and elevation data…':'Globus, Karte und Höhendaten werden geladen…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Ziehen zum Drehen · scrollen zum Zoomen · Relief erscheint beim Annähern',
      '3D globe terrain mode unavailable':'3D-Globus-Terrain nicht verfügbar','3D globe terrain could not be initialized. Standard globe restored.':'3D-Terrain konnte nicht initialisiert werden. Standardglobus wiederhergestellt.','3D globe terrain could not be loaded. Standard globe restored.':'3D-Terrain konnte nicht geladen werden. Standardglobus wiederhergestellt.',
      'The journey begins across Europe.':'Die Reise beginnt durch Europa.','Across the Atlantic into North America.':'Über den Atlantik nach Nordamerika.','Island connections and short regional hops.':'Inselverbindungen und kurze regionale Etappen.','A continuous line through South America.':'Eine zusammenhängende Route durch Südamerika.','The route opens into the Pacific.':'Die Route öffnet sich in den Pazifik.','Dense regional links and island crossings.':'Dichte Regionalverbindungen und Inselquerungen.','Long-distance transitions across Asia.':'Langstreckenübergänge durch Asien.','A compact but operationally complex chapter.':'Ein kompaktes, operativ anspruchsvolles Kapitel.','Overland and air corridors across West Africa.':'Land- und Flugkorridore durch Westafrika.','The route turns south, then back north-east.':'Die Route führt nach Süden und anschließend wieder nach Nordosten.','The final Middle East sequence.':'Die letzte Nahost-Sequenz.','The closing run back to Germany.':'Die abschließende Etappe zurück nach Deutschland.','The planned continuous route returns to Germany.':'Die geplante zusammenhängende Route kehrt nach Deutschland zurück.',
      'Route legs':'Routen-Legs',
      'Planned duration':'Geplante Dauer',
      'Route distance':'Routendistanz',
      'Transport model':'Verkehrsmodell',
      'Chapters':'Kapitel',
      'Transport mix':'Verkehrsmix',
      'sovereign states':'souveräne Staaten',
      'executable segments':'ausführbare Segmente',
      'continuous route':'zusammenhängende Route',
      'corridor / geodesic estimate':'Korridor-/Geodäsie-Schätzung',
      'public segment budget':'öffentliches Segmentbudget',
      'No actual journey events yet.':'Noch keine tatsächlichen Reiseereignisse.',
      'Journal ready for departure':'Reisetagebuch bereit für den Start',
      'Photos and short field notes can be attached to countries, route legs and travel days without turning the site into a generic blog.':'Fotos und kurze Notizen können Ländern, Routen-Legs und Reisetagen zugeordnet werden, ohne die Seite in einen allgemeinen Blog zu verwandeln.',
      'Media schema is active; there are no public travel entries before departure.':'Das Medienschema ist aktiv; vor dem Start gibt es keine öffentlichen Reiseeinträge.',
      'Actual journey data is being compared with the public plan.':'Tatsächliche Reisedaten werden mit dem öffentlichen Plan verglichen.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'Die öffentliche Live-Ebene ist bereit. Tatsächliche Check-ins erscheinen hier nach Reisebeginn.',
      'Starts in':'Start in',
      'Ready to depart':'Bereit zur Abreise',
      'JOURNEY COMPLETE':'REISE ABGESCHLOSSEN',
    },
    it:{
      'Europe':'Europa','Western Europe':'Europa occidentale','Eastern Europe':'Europa orientale','Northern Europe':'Europa settentrionale','Southern Europe':'Europa meridionale','Asia':'Asia','Africa':'Africa','Americas':'Americhe','Oceania':'Oceania',
      'Ready':'Pronto','READY':'PRONTO','Blocked':'Bloccato','BLOCKED':'BLOCCATO','Pending':'In sospeso','Conditional':'Condizionato','Critical':'Critico','Verified':'Verificato','Not verified':'Non verificato','Not recorded':'Non registrato','Not started':'Non iniziato',
      'Action':'Azione','From':'Da','Duration':'Durata','Distance unknown':'Distanza sconosciuta','Mode to confirm':'Mezzo da confermare','Plan depart':'Partenza prevista','Plan arrive':'Arrivo previsto','Planned':'Pianificato','Planned start':'Partenza prevista','Actual status':'Stato reale','Actual spend':'Spesa reale','Last update':'Ultimo aggiornamento',
      'Next segment':'Tratta successiva','Play / pause journey':'Avvia / pausa viaggio','Play journey from here':'Avvia il viaggio da qui','Close':'Chiudi','Copy the URL from your browser':'Copia l’URL dal browser',
      'Loading 3D globe terrain…':'Caricamento terreno 3D…','Loading globe, map and elevation data…':'Caricamento globo, mappa e dati altimetrici…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Trascina per ruotare · scorri per zoomare · il rilievo appare avvicinandoti',
      'Route legs':'Tratte',
      'Planned duration':'Durata prevista',
      'Route distance':'Distanza itinerario',
      'Transport model':'Modello trasporti',
      'Chapters':'Capitoli',
      'Transport mix':'Mix trasporti',
      'sovereign states':'stati sovrani',
      'executable segments':'segmenti eseguibili',
      'continuous route':'itinerario continuo',
      'corridor / geodesic estimate':'stima corridoio / geodetica',
      'public segment budget':'budget pubblico dei segmenti',
      'No actual journey events yet.':'Nessun evento reale del viaggio.',
      'Journal ready for departure':'Diario pronto per la partenza',
      'Actual journey data is being compared with the public plan.':'I dati reali del viaggio vengono confrontati con il piano pubblico.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'Il livello live pubblico è pronto. I check-in reali appariranno quando inizierà il viaggio.',
      'Starts in':'Inizia tra',
      'Ready to depart':'Pronto alla partenza',
      'JOURNEY COMPLETE':'VIAGGIO COMPLETATO',
      'The journey begins across Europe.':'Il viaggio inizia attraverso l’Europa.',
      'Across the Atlantic into North America.':'Attraverso l’Atlantico verso il Nord America.',
      'Island connections and short regional hops.':'Collegamenti tra isole e brevi tratte regionali.',
      'A continuous line through South America.':'Un itinerario continuo attraverso il Sud America.',
      'The route opens into the Pacific.':'L’itinerario si apre sul Pacifico.',
      'Dense regional links and island crossings.':'Fitti collegamenti regionali e traversate tra isole.',
      'Long-distance transitions across Asia.':'Lunghe transizioni attraverso l’Asia.',
      'A compact but operationally complex chapter.':'Un capitolo compatto ma operativamente complesso.',
      'Overland and air corridors across West Africa.':'Corridoi terrestri e aerei attraverso l’Africa occidentale.',
      'The route turns south, then back north-east.':'L’itinerario scende a sud e poi torna verso nord-est.',
      'The final Middle East sequence.':'La sequenza finale in Medio Oriente.',
      'The closing run back to Germany.':'La tratta conclusiva verso la Germania.',
      'The planned continuous route returns to Germany.':'L’itinerario continuo pianificato ritorna in Germania.',
    },
    es:{
      'Europe':'Europa','Western Europe':'Europa occidental','Eastern Europe':'Europa oriental','Northern Europe':'Europa septentrional','Southern Europe':'Europa meridional','Asia':'Asia','Africa':'África','Americas':'América','Oceania':'Oceanía',
      'Ready':'Listo','READY':'LISTO','Blocked':'Bloqueado','BLOCKED':'BLOQUEADO','Pending':'Pendiente','Conditional':'Condicional','Critical':'Crítico','Verified':'Verificado','Not verified':'No verificado','Not recorded':'No registrado','Not started':'No iniciado',
      'Action':'Acción','From':'Desde','Duration':'Duración','Distance unknown':'Distancia desconocida','Mode to confirm':'Transporte por confirmar','Plan depart':'Salida prevista','Plan arrive':'Llegada prevista','Planned':'Planificado','Planned start':'Inicio previsto','Actual status':'Estado real','Actual spend':'Gasto real','Last update':'Última actualización',
      'Next segment':'Siguiente tramo','Play / pause journey':'Reproducir / pausar viaje','Play journey from here':'Reproducir desde aquí','Close':'Cerrar','Copy the URL from your browser':'Copia la URL del navegador',
      'Loading 3D globe terrain…':'Cargando terreno 3D…','Loading globe, map and elevation data…':'Cargando globo, mapa y elevación…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Arrastra para girar · desplázate para acercar · el relieve aparece al aproximarte',
      'Route legs':'Tramos de ruta',
      'Planned duration':'Duración prevista',
      'Route distance':'Distancia de ruta',
      'Transport model':'Modelo de transporte',
      'Chapters':'Capítulos',
      'Transport mix':'Combinación de transportes',
      'sovereign states':'estados soberanos',
      'executable segments':'segmentos ejecutables',
      'continuous route':'ruta continua',
      'corridor / geodesic estimate':'estimación de corredor / geodésica',
      'public segment budget':'presupuesto público de segmentos',
      'No actual journey events yet.':'Aún no hay eventos reales del viaje.',
      'Journal ready for departure':'Diario listo para la salida',
      'Actual journey data is being compared with the public plan.':'Los datos reales del viaje se comparan con el plan público.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'La capa pública en vivo está lista. Los check-ins reales aparecerán cuando empiece el viaje.',
      'Starts in':'Empieza en',
      'Ready to depart':'Listo para salir',
      'JOURNEY COMPLETE':'VIAJE COMPLETADO',
      'The journey begins across Europe.':'El viaje comienza por Europa.',
      'Across the Atlantic into North America.':'Cruzando el Atlántico hacia Norteamérica.',
      'Island connections and short regional hops.':'Conexiones entre islas y trayectos regionales cortos.',
      'A continuous line through South America.':'Una ruta continua por Sudamérica.',
      'The route opens into the Pacific.':'La ruta se abre hacia el Pacífico.',
      'Dense regional links and island crossings.':'Conexiones regionales densas y cruces entre islas.',
      'Long-distance transitions across Asia.':'Transiciones de larga distancia por Asia.',
      'A compact but operationally complex chapter.':'Un capítulo compacto pero operativamente complejo.',
      'Overland and air corridors across West Africa.':'Corredores terrestres y aéreos por África Occidental.',
      'The route turns south, then back north-east.':'La ruta gira al sur y después vuelve al noreste.',
      'The final Middle East sequence.':'La secuencia final por Oriente Medio.',
      'The closing run back to Germany.':'El tramo final de regreso a Alemania.',
      'The planned continuous route returns to Germany.':'La ruta continua planificada regresa a Alemania.',
    },
    fr:{
      'Europe':'Europe','Western Europe':'Europe occidentale','Eastern Europe':'Europe orientale','Northern Europe':'Europe du Nord','Southern Europe':'Europe du Sud','Asia':'Asie','Africa':'Afrique','Americas':'Amériques','Oceania':'Océanie',
      'Ready':'Prêt','READY':'PRÊT','Blocked':'Bloqué','BLOCKED':'BLOQUÉ','Pending':'En attente','Conditional':'Conditionnel','Critical':'Critique','Verified':'Vérifié','Not verified':'Non vérifié','Not recorded':'Non enregistré','Not started':'Non commencé',
      'Action':'Action','From':'Depuis','Duration':'Durée','Distance unknown':'Distance inconnue','Mode to confirm':'Transport à confirmer','Plan depart':'Départ prévu','Plan arrive':'Arrivée prévue','Planned':'Planifié','Planned start':'Départ prévu','Actual status':'État réel','Actual spend':'Dépenses réelles','Last update':'Dernière mise à jour',
      'Next segment':'Segment suivant','Play / pause journey':'Lire / mettre en pause','Play journey from here':'Lire le voyage depuis ici','Close':'Fermer','Copy the URL from your browser':'Copiez l’URL du navigateur',
      'Loading 3D globe terrain…':'Chargement du relief 3D…','Loading globe, map and elevation data…':'Chargement du globe, de la carte et du relief…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Faites glisser pour tourner · faites défiler pour zoomer · le relief apparaît en vous rapprochant',
      'Route legs':'Étapes de route',
      'Planned duration':'Durée prévue',
      'Route distance':'Distance de l’itinéraire',
      'Transport model':'Modèle de transport',
      'Chapters':'Chapitres',
      'Transport mix':'Répartition des transports',
      'sovereign states':'États souverains',
      'executable segments':'segments exécutables',
      'continuous route':'itinéraire continu',
      'corridor / geodesic estimate':'estimation corridor / géodésique',
      'public segment budget':'budget public des segments',
      'No actual journey events yet.':'Aucun événement réel du voyage pour le moment.',
      'Journal ready for departure':'Journal prêt pour le départ',
      'Actual journey data is being compared with the public plan.':'Les données réelles du voyage sont comparées au plan public.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'La couche publique en direct est prête. Les check-ins réels apparaîtront au début du voyage.',
      'Starts in':'Départ dans',
      'Ready to depart':'Prêt au départ',
      'JOURNEY COMPLETE':'VOYAGE TERMINÉ',
      'The journey begins across Europe.':'Le voyage commence à travers l’Europe.',
      'Across the Atlantic into North America.':'Traversée de l’Atlantique vers l’Amérique du Nord.',
      'Island connections and short regional hops.':'Liaisons insulaires et courtes étapes régionales.',
      'A continuous line through South America.':'Un itinéraire continu à travers l’Amérique du Sud.',
      'The route opens into the Pacific.':'L’itinéraire s’ouvre sur le Pacifique.',
      'Dense regional links and island crossings.':'Liaisons régionales denses et traversées insulaires.',
      'Long-distance transitions across Asia.':'Longues transitions à travers l’Asie.',
      'A compact but operationally complex chapter.':'Un chapitre compact mais complexe sur le plan opérationnel.',
      'Overland and air corridors across West Africa.':'Corridors terrestres et aériens à travers l’Afrique de l’Ouest.',
      'The route turns south, then back north-east.':'L’itinéraire descend vers le sud puis remonte au nord-est.',
      'The final Middle East sequence.':'La séquence finale au Moyen-Orient.',
      'The closing run back to Germany.':'La dernière étape vers l’Allemagne.',
      'The planned continuous route returns to Germany.':'L’itinéraire continu prévu revient en Allemagne.',
    },
    pt:{
      'Europe':'Europa','Western Europe':'Europa Ocidental','Eastern Europe':'Europa Oriental','Northern Europe':'Europa do Norte','Southern Europe':'Europa do Sul','Asia':'Ásia','Africa':'África','Americas':'Américas','Oceania':'Oceania',
      'Ready':'Pronto','READY':'PRONTO','Blocked':'Bloqueado','BLOCKED':'BLOQUEADO','Pending':'Pendente','Conditional':'Condicional','Critical':'Crítico','Verified':'Verificado','Not verified':'Não verificado','Not recorded':'Não registado','Not started':'Não iniciado',
      'Action':'Ação','From':'De','Duration':'Duração','Distance unknown':'Distância desconhecida','Mode to confirm':'Transporte a confirmar','Plan depart':'Partida prevista','Plan arrive':'Chegada prevista','Planned':'Planeado','Planned start':'Início previsto','Actual status':'Estado real','Actual spend':'Despesa real','Last update':'Última atualização',
      'Next segment':'Próximo trecho','Play / pause journey':'Reproduzir / pausar viagem','Play journey from here':'Reproduzir a partir daqui','Close':'Fechar','Copy the URL from your browser':'Copie o URL do navegador',
      'Loading 3D globe terrain…':'A carregar terreno 3D…','Loading globe, map and elevation data…':'A carregar globo, mapa e elevação…','Drag to rotate · scroll to zoom · relief appears as you move closer':'Arraste para rodar · desloque para ampliar · o relevo aparece ao aproximar',
      'Route legs':'Trechos da rota',
      'Planned duration':'Duração planeada',
      'Route distance':'Distância da rota',
      'Transport model':'Modelo de transporte',
      'Chapters':'Capítulos',
      'Transport mix':'Mix de transportes',
      'sovereign states':'estados soberanos',
      'executable segments':'segmentos executáveis',
      'continuous route':'rota contínua',
      'corridor / geodesic estimate':'estimativa de corredor / geodésica',
      'public segment budget':'orçamento público dos segmentos',
      'No actual journey events yet.':'Ainda não existem eventos reais da viagem.',
      'Journal ready for departure':'Diário pronto para a partida',
      'Actual journey data is being compared with the public plan.':'Os dados reais da viagem estão a ser comparados com o plano público.',
      'The public live layer is ready. Actual check-ins will appear here once the journey begins.':'A camada pública ao vivo está pronta. Os check-ins reais aparecerão quando a viagem começar.',
      'Starts in':'Começa em',
      'Ready to depart':'Pronto para partir',
      'JOURNEY COMPLETE':'VIAGEM CONCLUÍDA',
      'The journey begins across Europe.':'A viagem começa pela Europa.',
      'Across the Atlantic into North America.':'Atravessando o Atlântico rumo à América do Norte.',
      'Island connections and short regional hops.':'Ligações entre ilhas e pequenos trechos regionais.',
      'A continuous line through South America.':'Uma rota contínua pela América do Sul.',
      'The route opens into the Pacific.':'A rota abre-se para o Pacífico.',
      'Dense regional links and island crossings.':'Ligações regionais densas e travessias entre ilhas.',
      'Long-distance transitions across Asia.':'Transições de longa distância pela Ásia.',
      'A compact but operationally complex chapter.':'Um capítulo compacto, mas operacionalmente complexo.',
      'Overland and air corridors across West Africa.':'Corredores terrestres e aéreos pela África Ocidental.',
      'The route turns south, then back north-east.':'A rota segue para sul e depois volta para nordeste.',
      'The final Middle East sequence.':'A sequência final no Médio Oriente.',
      'The closing run back to Germany.':'O trecho final de regresso à Alemanha.',
      'The planned continuous route returns to Germany.':'A rota contínua planeada regressa à Alemanha.',
    }
  };

  const LEGACY_SHORT={
    de:{'All route':'Gesamtroute','N. America':'N. Amerika','S. America':'S. Amerika','Pacific':'Pazifik','SE Asia':'SO-Asien','C. Asia':'Zentralasien','Levant':'Levante','W. Africa':'W. Afrika','E. Africa':'O. Afrika','Gulf':'Golf','Finish':'Ziel','This is the current operational corridor in the public master plan.':'Dies ist der aktuelle operative Korridor im öffentlichen Masterplan.'},
    it:{'All route':'Itinerario completo','N. America':'N. America','S. America':'S. America','Pacific':'Pacifico','SE Asia':'SE Asia','C. Asia':'Asia centrale','Levant':'Levante','W. Africa':'Africa occ.','E. Africa':'Africa or.','Gulf':'Golfo','Finish':'Arrivo','This is the current operational corridor in the public master plan.':'Questo è il corridoio operativo attuale nel piano pubblico principale.'},
    es:{'All route':'Ruta completa','N. America':'N. América','S. America':'S. América','Pacific':'Pacífico','SE Asia':'SE Asia','C. Asia':'Asia central','Levant':'Levante','W. Africa':'África occ.','E. Africa':'África or.','Gulf':'Golfo','Finish':'Final','This is the current operational corridor in the public master plan.':'Este es el corredor operativo actual del plan maestro público.'},
    fr:{'All route':'Itinéraire complet','N. America':'Amér. N.','S. America':'Amér. S.','Pacific':'Pacifique','SE Asia':'Asie SE','C. Asia':'Asie centrale','Levant':'Levant','W. Africa':'Afrique O.','E. Africa':'Afrique E.','Gulf':'Golfe','Finish':'Arrivée','This is the current operational corridor in the public master plan.':'Il s’agit du corridor opérationnel actuel dans le plan directeur public.'},
    pt:{'All route':'Rota completa','N. America':'Amér. N.','S. America':'Amér. S.','Pacific':'Pacífico','SE Asia':'SE Ásia','C. Asia':'Ásia central','Levant':'Levante','W. Africa':'África O.','E. Africa':'África E.','Gulf':'Golfo','Finish':'Fim','This is the current operational corridor in the public master plan.':'Este é o corredor operacional atual no plano mestre público.'}
  };

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
    if(!currentTrip||regionalStory.active)return;
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
    if(!currentTrip||currentTripMeta?.renderer==='legacy-world')return;
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
    for(const [id,key] of labels){const span=$('#'+id)?.closest('label')?.querySelector('span');if(span)span.textContent=t(key)}
    const title=$('#settingsPopover .settings-head h3');if(title)title.textContent=t('settings');
    const share=$('#mobileShareBtn');if(share)share.textContent=t('share');
    const info=$('#mobileInfoBtn');if(info)info.textContent=t('methodology');
    let storyBtn=$('#regionalStorySettingsBtn');
    if(!storyBtn){storyBtn=document.createElement('button');storyBtn.id='regionalStorySettingsBtn';storyBtn.type='button';storyBtn.addEventListener('click',()=>{$('#settingsPopover')?.classList.add('hidden');startRegionalStory()});$('#settingsPopover .mobile-settings-actions')?.appendChild(storyBtn)}
    if(storyBtn)storyBtn.textContent=t('storyPlay');
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
    if(new URLSearchParams(location.search).get('view')==='terrain')setTimeout(()=>setRegionalTerrain(true),650);
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
