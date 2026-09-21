# Release 3 — Zwischenstand 21. September 2026

Release 3 ist **nicht freigegeben**. Ausschließlich Stevie1st90/one-world-route, main, Vercel one-world-route.

## Umgesetzte Grundlage

- 194 internationale Legs und 195 Einträge im Länderumfang bleiben unverändert. Domestic Movements sind eine separate operative Ebene mit eigenen IDs, Eltern-Legs, Plan/Ist-Feldern und Quellenstatus.
- 93 Transferkandidaten sind inventarisiert und ausdrücklich als prüfbedürftig gekennzeichnet. Unbekannte Zeiten, Kosten und Verkehrsmittel bleiben unbekannt. Lyon–Nizza enthält eine erste belegte Planungsgrundlage; keine Buchungszusage.
- Operations zeigt angrenzende Movements; Story fügt einen Transfer-Schritt ein, ohne Länderzähler oder Macro-Leg-Auswahl zu erhöhen. Terrain nutzt die separate Geometrie, soweit vorhanden.
- 81 von 110 Flug-Legs besitzen eindeutige Flughafen-Geometrien aus OurAirports. Transitpunkte wie APW–NAN–FUN sind enthalten. 29 Flug-Legs benötigen weitere Klärung. Flughafenkoordinaten belegen keine Flugverfügbarkeit.
- Kontinuitätsprüfung unterscheidet geometrische Kontinuität, Transferbedarf und unbekannte Endpunkte. Der strenge Release-Gate bleibt rot.
- MapLibre-Zoomausdrücke und die Globe.gl-API für Länderumrisse wurden korrigiert. Terrain-Initialisierung wird gegen parallele Aufrufe geschützt.
- Service-Worker-Cache auf 20260921a erhöht, damit die korrigierten Bundles vorherige Cache-Inhalte ablösen.

## Verifikation

- 21.09.: 9 gezielte Node-Tests bestanden, einschließlich offizieller MapLibre-Style-Validierung, Macro-Invarianten, Transit-Flughäfen und Story-Transfer-Verhalten.
- 21.09.: Release-Build und git diff --check erfolgreich; 390 SEO-URLs erzeugt.
- Früherer echter Chromium-/Playwright-Gesamtlauf: 30 bestanden, 13 fehlgeschlagen, 2 übersprungen bei 1440/1920/360/390/430 Pixeln. Dieser Lauf erfolgte während der Korrekturen und ist kein erfolgreicher Nachweis des Endstands.
- Drei gezielte Desktop-Browsertests für Operations, Flughafen-Geometrien und Story-Transfer/Exit waren erfolgreich. Screenshot der Desktop-Operations-Karte geprüft.
- Neuester Wiederholungsversuch am 21.09. scheitert vor Seitenaufruf: Chromium beendet sich mit SIGSEGV, auch bei --version. Keine neue Terrain- oder Mobile-Abnahme. Die optionale Zertifikatsausnahme im Test-Runner gilt ausschließlich bei OWR_QA_PROXY_TLS=1 für die Proxy-Testumgebung.
- PWA-Dateien wurden auf Erreichbarkeit geprüft; vollständige Service-Worker-Installation und Cache-Migration im echten Browser stehen aus.
- Begrenzter Credential-Musterscan über 113 Git-Commits: keine Treffer. Keine vollständige Privacy-Freigabe von Freitext oder History.

## Offene Release-Blocker

1. 93 Movements fachlich prüfen: reale Stationen/Flughäfen, Verkehrsmittel, belastbare Dauer und Kosten, Datum, Buchungsbedarf und Quellen ergänzen. 48 Verbindungen haben noch unaufgelöste Endpunktgeometrie. Keine automatisch erzeugte Gerade gilt als verifizierter Reiseweg.
2. Macro-Widerspruch: 195 Länder im Umfang, aber nur 194 unterschiedliche Länder in den Leg-Endpunkten. Nordkorea fehlt dort; die Route beginnt und endet in Deutschland. Keine stillschweigende Änderung der 194 Legs und keine Umdeutung eines internationalen Grenzübertritts als Domestic Movement.
3. Verbleibende Flug-Corridors und Flughafen-/Bahnhofwechsel auflösen, anschließend strengen Kontinuitätsaudit bestehen.
4. Terrain für alle angeforderten Regionen visuell prüfen; Desktop/Mobile, Pan/Zoom, Kapitel, All route, Focus Route und aktive Route vollständig nachtesten. Story, Details, Navigation zurück/vorwärts und URL-Neuladen erneut prüfen.
5. Vollständige Privacy-Prüfung, mobile Performance-Abnahme und geschützter Pflegeworkflow stehen aus.

## Veröffentlichte Etappen

- 0372ffc6e7e82ed6dba43d7a009a405270094254 — Operational Transfer Foundation und Flughafen-Geometrien; Vercel SUCCESS geprüft.
- 36c266006837265daf9c728941278b107ac498a0 — MapLibre- und Globe-API-Korrekturen; Vercel SUCCESS geprüft.

Die Basisplanung von ca. 379 Tagen und EUR 90,6k wurde durch unbestätigte Transferannahmen nicht automatisch geändert.
