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
