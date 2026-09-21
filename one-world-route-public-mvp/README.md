# ONE WORLD ROUTE — Public Explorer

A production-oriented interactive explorer for one continuous journey through all 195 sovereign states.

## Implemented
- 195 countries / 194 executable route legs / 12 chapters
- Interactive 3D Globe.gl route explorer
- Cinematic Story Mode
- Spherical MapLibre 3D terrain with DEM relief
- Terrain chapter camera focus
- Curated corridor waypoints with geodesic fallback
- Explore + Operations modes
- Route, status, visa, health, cost, risk, progress and critical-path views
- Search and shareable URL state
- Journey statistics
- Plan vs Actual live-progress model
- Journal/media model
- Public changelog
- SEO country and route share URLs
- Installable PWA shell
- Desktop/mobile Playwright regression suite
- Public-data sanitizing and validation pipeline
- Two-bundle production runtime

## Release
```bash
node scripts/release-build.mjs
```

## QA
```bash
cd qa
npm install
BASE_URL=https://one-world-route.vercel.app npm run test:e2e
```

## Map infrastructure
MapLibre GL JS is open source. The current terrain basemap uses OpenStreetMap raster tiles and Mapterhorn DEM elevation. Before sustained high-volume traffic, move tiles to a production provider or self-hosted PMTiles/CDN.

## Data maintenance
```bash
node scripts/audit-freshness.mjs
node scripts/diff-public-route.mjs previous-public-route.json data/public-route.json route-diff.json
```
Freshness is evaluated against the real current date at runtime. The diff tool identifies operational changes before they are summarized in the public changelog.

## Route continuity
The 194 official legs remain international country-to-country legs. Missing domestic movement between the arrival point of one leg and departure point of the next is rendered as a visual transfer connector and does not increase the official leg count.

```bash
node scripts/audit-route-continuity.mjs
```


## Multi-trip platform foundation

ONE WORLD ROUTE is no longer architected as a single hard-coded world itinerary. The original world journey remains the flagship route and keeps its existing **195-country scope / 194 international macro-leg invariant**. A generic platform layer now supports additional routes without changing that macro model.

Current platform features:
- trip catalog with clean `/trip/:slug` share URLs
- generic **place → visit/stop → segment** data model
- regional routes with repeat visits to the same place
- transport taxonomy for road, rail, ferry, cruise, flight and multimodal travel
- browser-local Traveller Context for passport country, residence, language, currency, origin, party and reduced-mobility context
- six initial UI languages: English, German, Italian, Spanish, French and Portuguese
- Italy Grand Tour as the first regional editorial template
- platform validation in the release pipeline

Traveller Context is planning context, not an identity profile. The public app never asks for passport numbers, booking references, payment data or exact home addresses. Entry, visa and safety claims must remain source-backed and traveller-specific rather than assuming a German traveller.

### Italy sourced beta

The Italy Grand Tour is now the first route using the evidence layer end to end. All 10 route segments carry source references. Four segments have operator-published timing/fare data that can be represented as verified planning evidence; the remaining connections are explicitly marked `current-check-required` where timetable, interchange or seasonal assumptions are still unresolved.

The UI shows:
- individual transport stages for multimodal legs
- published minimum fares separately from incomplete total-trip pricing
- verification state and last-checked date
- links to operator/government evidence
- traveller-specific entry guidance that directs users to Italy's official visa resolver instead of assuming a German passport/residence

A sourced route is not a booking engine. Exact departures, inventory and fares remain date-dependent and must be checked before purchase.

