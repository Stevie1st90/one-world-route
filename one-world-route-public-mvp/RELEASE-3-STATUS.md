# Release 3 — Historischer Zwischenstand

Diese Datei ist **kein kanonischer aktueller Status mehr**. Die darin früher manuell gepflegten Zahlen wurden durch einen reproduzierbaren Flagship-Readiness-Audit ersetzt.

## Aktuelle Quelle

Der aktuelle maschinenlesbare Stand liegt in:

`data/flagship-readiness.json`

Er wird aus folgenden öffentlichen Quelldaten berechnet:

- `data/public-route.json`
- `data/operational-movements.json`
- `data/route-waypoints.json`
- `data/flight-geometries.json`

Neu erzeugen:

```bash
node scripts/audit-flagship-readiness.mjs
```

Prüfen, ob der committed Report noch exakt zu den Quelldaten passt:

```bash
node scripts/audit-flagship-readiness.mjs --check
```

Striktes Departure-Gate:

```bash
node scripts/audit-flagship-readiness.mjs --strict
```

Der normale Release-Build aktualisiert den Report deterministisch.

## Unveränderte Grundregel

Die Flagship-Reise behält **195 souveräne Staaten / 194 internationale Legs**. Domestic Movements sind eine separate operative Ebene und erhöhen die offizielle Leg-Zahl nicht.

## Einordnung

Die öffentliche Website kann technisch veröffentlichbar sein, obwohl die Reise operativ noch nicht abfahrtsbereit ist. Der Audit trennt deshalb strukturelle Modellgültigkeit von `departureReady`.

Historische Aussagen aus dem Stand vom 21.09.2026 sollen nicht mehr manuell fortgeschrieben werden. Maßgeblich sind die aktuell aus den Daten berechneten Werte im Readiness-Report.


## Kanonische Topologie

Die 195/194-Regel ist jetzt zusätzlich strukturell definiert: Die offizielle Route ist ein offener Pfad durch alle 195 souveränen Staaten genau einmal. Sie beginnt in Deutschland und endet in Malta. Die Heimreise Malta → Deutschland bleibt als eigener `postTripReturn` erhalten und zählt nicht als zusätzliches internationales Leg.

Damit ist die frühere Inkonsistenz beseitigt, bei der Deutschland sowohl Start- als auch Endknoten der 194 offiziellen Legs war und dadurch Nordkorea nur im Länderkatalog, nicht aber in der Leg-Kette vorkam.

Die operative Ausführbarkeit einzelner Legs ist davon getrennt und bleibt über `data/flagship-readiness.json` sowie `data/flagship-operations-queue.json` nachweisbar offen, bis die jeweiligen Quellen, Endpunkte und Entscheidungen geprüft sind.
