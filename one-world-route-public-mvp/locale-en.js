(() => {
  'use strict';
  const names=new Map();
  const SUPPORTED=['en','de','it','es','fr','pt'];
  const locale=(()=>{
    const query=new URLSearchParams(location.search).get('lang');
    if(SUPPORTED.includes(String(query||'').toLowerCase()))return String(query).toLowerCase();
    try{
      const saved=JSON.parse(localStorage.getItem('one-world-route:traveller-context:v1')||'{}')?.language;
      if(SUPPORTED.includes(String(saved||'').toLowerCase()))return String(saved).toLowerCase();
    }catch{}
    const browser=String(navigator.language||'en').toLowerCase().split('-')[0];
    return SUPPORTED.includes(browser)?browser:'en';
  })();
  let regionNames=null;
  try{regionNames=new Intl.DisplayNames([locale],{type:'region'});}catch{}

  const MODE=new Map(Object.entries({
    'Zug':'Train','Flug':'Flight','Bus':'Bus','Fähre':'Ferry','Land':'Overland','Noch offen':'To be confirmed',
    'Auto':'Car','Zu Fuß/Shuttle':'Walk / Shuttle','Bus+Flug':'Bus + Flight',
    'Bus/4x4':'Bus / 4x4','Bus/Auto':'Bus / Car','Bus/Flug':'Bus / Flight',
    'Bus/Sammeltaxi':'Bus / Shared taxi','Bus/Shuttle':'Bus / Shuttle',
    'Bus/Zug':'Bus / Train','Flug (1 Stopp)':'Flight (1 stop)',
    'Flug (via Fidschi)':'Flight (via Fiji)','Flug – Dualstrategie':'Flight – dual strategy',
    'Flug/Bus':'Flight / Bus','Fähre/Flug':'Ferry / Flight',
    'Fähre/Hors-bord':'Ferry / Speedboat','Land+Flug':'Overland + Flight',
    'Zug+Bus':'Train + Bus','Zug/Bus':'Train / Bus'
  }));

  const EXACT=new Map(Object.entries({
    'Planbar':'Plannable','Bedingt':'Conditional','Kritisch':'Critical',
    'Plausibel':'Plausible','Verifiziert':'Verified','Offen':'Open / unresolved',
    'JETZT BUCHEN':'BOOK NOW','JETZT BUCHEN / FLEX':'BOOK NOW / FLEX',
    'NICHT LANGFRISTIG FIXIEREN':'DO NOT LOCK LONG-TERM','HOLD – operativen Korridor verifizieren':'HOLD – verify operational corridor',
    'Visumfrei':'Visa-free','Visumfrei 30 Tage':'Visa-free 30 days',
    'Visumfrei bis 31.12.2026':'Visa-free until 31 Dec 2026',
    'Visum erforderlich':'Visa required','Pflichtformular':'Mandatory form',
    'Start/Heimatland':'Start / home country',
    'Israelische Einreisekontrolle':'Israeli entry control',
    'K-ETA ab 2027 einplanen':'Plan for K-ETA from 2027',
    'KALENDERKONFLIKT':'CALENDAR CONFLICT','LOI + Visum':'LOI + visa',
    'eVisa/VOA – kritisch':'eVisa / VOA – critical','BLOCKIERT':'BLOCKED',
    'Keine Einreisegenehmigung':'No entry authorisation required',
    'Keine Vorabgenehmigung':'No prior authorisation required',
    'Kein belastbarer Visaplan':'No reliable visa plan',
    'Klassisches Visum / Konsularweg':'Standard visa / consular route',
    'Klassisches Visum organisieren':'Arrange standard visa',
    'VOA-Unterlagen':'VOA documents','VOA-Unterlagen vorbereiten':'Prepare VOA documents',
    'VOA-Voraussetzungen prüfen':'Check VOA requirements','VOA-Voraussetzungen vorbereiten':'Prepare VOA requirements',
    'VOA/eVisa vorbereiten':'Prepare VOA / eVisa','eVisa oder VOA vorbereiten':'Prepare eVisa or VOA',
    'eVisa vor Reise':'Obtain eVisa before travel','eVisa empfohlen':'eVisa recommended',
    'eVisa/VOA vorbereiten':'Prepare eVisa / VOA','eVisa/Einreisegenehmigung prüfen':'Check eVisa / entry authorisation',
    'eVisitor vor Flug':'Obtain eVisitor before flight',
    'Visa/Entry innerhalb 90 Tage':'Visa / entry action within 90 days',
    'Booking-Fenster offen – nicht dringend':'Booking window open – not urgent',
    'Spätere Visa-/Entry-Aktion beobachten':'Monitor later visa / entry action',
    'Späteres kritisches Segment beobachten':'Monitor later critical segment',
    'Operativer Einreise- und Weiterreisekorridor bleibt bis zu einer neuen, quellenbasierten Prüfung offen.':'Operational entry and onward routing remains unresolved pending a fresh source-backed review.',
    'Operativer Ausreise- und Einreisekorridor bleibt bis zu einer neuen, quellenbasierten Prüfung offen.':'Operational exit and onward entry routing remains unresolved pending a fresh source-backed review.',
    'Makroabdeckung hergestellt; operative Route und Einreise vor Abfahrt neu verifizieren.':'Macro coverage restored; reverify the operational route and entry conditions before departure.',
    'Operative Route und Grenz-/Einreisebedingungen vor Abfahrt neu verifizieren.':'Reverify the operational route and border/entry conditions before departure.',
    'Tier A/B Buchung jetzt bearbeiten':'Handle Tier A/B booking now',
    'Brisbane-Default früh/flexibel sichern; Guam nur optionale Visa-Optimierung':'Secure Brisbane default early/flexibly; Guam is only an optional visa optimisation',
    'ICVP mitführen; keine besondere Route-Pflicht identifiziert.':'Carry ICVP; no special route-specific requirement identified.',
    'ICVP EINREISEPFLICHT: Land verlangt YF-Nachweis von allen ankommenden Reisenden.':'ICVP ENTRY REQUIREMENT: the country requires yellow-fever proof from all arriving travellers.',
    'Gelbfieberimpfung je nach Reisegebiet empfohlen; ICVP auf der gesamten Route mitführen.':'Yellow-fever vaccination recommended depending on travel area; carry the ICVP throughout the journey.',
    'Einreise aus Angola: gültiges Gelbfieberzertifikat erforderlich.':'Arrival from Angola: valid yellow-fever certificate required.',
    'Einreise aus Gambia (Gelbfiebergebiet): ICVP erforderlich.':'Arrival from Gambia (yellow-fever area): ICVP required.',
    'Einreise aus Kenia: ICVP erforderlich; Ausnahme nur bei reinem Airside-Transit <12 h.':'Arrival from Kenya: ICVP required; exception only for airside transit under 12 hours.',
    'Einreise aus Sudan: Gelbfiebernachweis erforderlich; ohne Nachweis kann Quarantäne drohen.':'Arrival from Sudan: yellow-fever proof required; quarantine may apply without proof.',
    'Einreise aus Südsudan: gültiges Gelbfieberzertifikat erforderlich.':'Arrival from South Sudan: valid yellow-fever certificate required.',
    'Einreise aus Äquatorialguinea: ICVP erforderlich.':'Arrival from Equatorial Guinea: ICVP required.',
    '2027-Regel kurz vorher bestätigen':'Reconfirm the 2027 rule shortly before travel',
    'Aktuelles Ghana-Verfahren prüfen':'Check the current Ghana procedure',
    'Bhutan-Genehmigung organisieren':'Arrange Bhutan authorisation',
    'Canada eTA vor Flug':'Obtain Canada eTA before flight',
    'China-Visum einplanen / Policy neu prüfen':'Plan China visa / recheck policy',
    'Einreisegenehmigung unmittelbar bestätigen':'Confirm entry authorisation immediately before travel',
    'Einreisegenehmigung/VOA prüfen':'Check entry authorisation / VOA',
    'K-ETA-Status 2027 prüfen':'Check 2027 K-ETA status',
    'Kein separates Touristenvisum; Bewegungsregeln prüfen':'No separate tourist visa; check movement rules',
    'Kuba-eVisa vor Reise':'Obtain Cuba eVisa before travel',
    'MDAC vor Einreise':'Complete MDAC before entry',
    'NZeTA vor Flug':'Obtain NZeTA before flight',
    'Nauru-Visum/Entry Permit frühzeitig klären':'Resolve Nauru visa / entry permit early',
    'Online-Einreisegebühr/Registrierung prüfen':'Check online entry fee / registration',
    'Online-Genehmigung vor Reise':'Obtain online authorisation before travel',
    'Pre-enrolment vor Reise':'Complete pre-enrolment before travel',
    'Regel + Landgrenzen kurz vor Einreise prüfen':'Recheck rule and land borders shortly before entry',
    'Russland-eVisa zeitnah beantragen':'Apply for Russia eVisa in good time',
    'Saudi-eVisa empfohlen':'Saudi eVisa recommended',
    'Seychellen-Registrierung':'Seychelles registration',
    'Touragentur + LOI organisieren':'Arrange tour agency + LOI',
    'UK ETA vor Reise':'Obtain UK ETA before travel',
    'Visum 4–8 Wochen vor Einreise':'Obtain visa 4–8 weeks before entry',
    'Visum vor Einreise':'Obtain visa before entry',
    'DEFAULT/Plan B operational: PNI→MAJ→TRW→INU→BNE, danach Qantas BNE→ROR. OPTION A: PNI→GUM→ROR nur mit regulärem US-Visum nach Kuba. V18 Phase 1 17.09.2026: Brisbane route removes the US visa as a single point of failure.':'DEFAULT / Plan B operational: PNI→MAJ→TRW→INU→BNE, then Qantas BNE→ROR. OPTION A: PNI→GUM→ROR only with a regular US visa after Cuba. V18 Phase 1 17.09.2026: Brisbane route removes the US visa as a single point of failure.',
    'Sükhbaatar/Naushki Landgrenze':'Sükhbaatar / Naushki land border',
    'Bischkek→Duschanbe Flug, falls veröffentlicht':'Bishkek → Dushanbe flight, if published',
    'anderer Istanbuler Flughafen → EBL':'other Istanbul airport → EBL',
    'Melloula/Babbouch Landgrenze':'Melloula / Babbouch land border',
    'Flug via Lomé, anschließend Cotonou':'Flight via Lomé, then Cotonou',
    'Cotonou→Lomé Flug/Regionalhub':'Cotonou → Lomé flight / regional hub',
    'ACC→ABJ nonstop, sofern am Datum verfügbar':'ACC → ABJ nonstop, if available on the planned date',
    'ROB→FNA nonstop':'ROB → FNA nonstop',
    'Kambia/Pamelap Landroute':'Kambia / Pamelap overland route',
    'Gabu/Buruntuma Landroute':'Gabu / Buruntuma overland route',
    'zusätzliche Nacht in Jeddah bis nächster ASM-Flug':'additional night in Jeddah until the next ASM flight',
    'Einreisepunkt prüfen: VOA/eVisa gilt nicht automatisch an jedem Land-/Seegrenzpunkt.':'Check entry point: VOA / eVisa is not automatically valid at every land or sea border.',
    'HARTER TERMINKONFLIKT: geplante Einreise 2027 liegt nach Ende der aktuell veröffentlichten Visumfreiheit (31.12.2026).':'HARD DATE CONFLICT: planned 2027 entry is after the end of the currently published visa-free period (31 Dec 2026).',
    'Kein Kalenderdatum; 195/195 bleibt blockiert.':'No calendar date; 195/195 remains blocked.',
    'Geplante Einreise 2027 liegt nach Ende der derzeit veröffentlichten K-ETA-Befreiung (31.12.2026).':'Planned 2027 entry is after the end of the currently published K-ETA exemption (31 Dec 2026).',
    'LOI über registrierte Touragentur ist Kernabhängigkeit; ohne LOI kein belastbarer Eintritt.':'LOI via a registered tour agency is a core dependency; entry is not reliable without the LOI.',
    'Visum 90 Tage ab Ausstellung gültig; daher ein Antrag vor Reisebeginn im Okt. 2026 wäre für die späte 2027-Einreise unbrauchbar.':'Visa valid for 90 days from issue; an application before departure in Oct 2026 would therefore be unusable for the late-2027 entry.'
  }));

  function registerCountries(list=[]){
    for(const c of list){
      if(!c?.name)continue;
      let en='';
      const code=String(c.cca2||'').toUpperCase();
      if(regionNames&&/^[A-Z]{2}$/.test(code)){
        try{en=regionNames.of(code)||'';}catch{}
      }
      if(en)names.set(c.name,en);
    }
  }

  function country(raw,cca2=''){
    if(!raw)return '';
    if(cca2&&regionNames){
      try{const en=regionNames.of(String(cca2).toUpperCase());if(en)return en;}catch{}
    }
    return names.get(raw)||raw;
  }

  const MODE_WORDS={
    it:[['Train','Treno'],['Flight','Volo'],['Ferry','Traghetto'],['Overland','Via terra'],['Car','Auto'],['Walk','A piedi'],['Shared taxi','Taxi condiviso'],['Shuttle','Navetta'],['stop','scalo'],['dual strategy','strategia doppia'],['via Fiji','via Figi']],
    es:[['Train','Tren'],['Flight','Vuelo'],['Ferry','Ferry'],['Overland','Por tierra'],['Car','Coche'],['Walk','A pie'],['Shared taxi','Taxi compartido'],['Shuttle','Lanzadera'],['stop','escala'],['dual strategy','estrategia dual'],['via Fiji','vía Fiyi']],
    fr:[['Train','Train'],['Flight','Vol'],['Ferry','Ferry'],['Overland','Par voie terrestre'],['Car','Voiture'],['Walk','À pied'],['Shared taxi','Taxi collectif'],['Shuttle','Navette'],['stop','escale'],['dual strategy','double stratégie'],['via Fiji','via Fidji']],
    pt:[['Train','Trem'],['Flight','Voo'],['Ferry','Balsa'],['Overland','Por terra'],['Car','Carro'],['Walk','A pé'],['Shared taxi','Táxi compartilhado'],['Shuttle','Transfer'],['stop','escala'],['dual strategy','estratégia dupla'],['via Fiji','via Fiji']]
  };
  function mode(v){
    const raw=String(v||'');
    if(locale==='de')return raw;
    let out=MODE.get(raw)||raw;
    if(locale==='en')return out;
    for(const [a,b] of MODE_WORDS[locale]||[])out=out.replaceAll(a,b);
    return out;
  }

  function text(v){
    if(v===null||v===undefined)return v;
    let s=String(v);
    if(locale==='de')return s;
    if(EXACT.has(s))return EXACT.get(s);
    s=s
      .replace(/^WARTEN bis /,'WAIT until ')
      .replace(/^HOLD bis /,'HOLD until ')
      .replace(/Luxemburg-Stadt/g,'Luxembourg City')
      .replace(/Bischkek/g,'Bishkek')
      .replace(/Duschanbe/g,'Dushanbe')
      .replace(/Fidschi/g,'Fiji')
      .replace(/Landgrenze/g,'land border');
    return s;
  }

  function value(v){
    if(v===null||v===undefined)return v;
    const s=String(v);
    if(locale==='de')return MODE.has(s)?mode(s):s;
    return EXACT.get(s)||mode(s)||text(s);
  }

  window.ONE_WORLD_EN={locale,registerCountries,country,mode,text,value};
})();