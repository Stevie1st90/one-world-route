# ONE WORLD ROUTE — Public Explorer

A production-oriented multi-trip discovery platform for extraordinary journeys worldwide. The original 195-country route remains the flagship journey.

## Implemented
- Public multi-trip homepage with a shared world Globe and catalog-driven Journey Discovery
- Flagship journey with 195 countries / 194 executable international route legs / 12 chapters
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

## Delivery and cache policy
The installable app uses a network-first policy for navigations, JavaScript/CSS bundles and route data. Cached copies are retained only as offline fallback. The service worker is registered with `updateViaCache: 'none'`, explicitly activates waiting versions, and migrates clients away from the older cache-first releases that could pin the flagship shell at `/` after a deployment.

Vercel sends `no-store` for the root HTML and service worker, while mutable bundles/data require revalidation. Delivery rules are regression-tested in CI and verified again by the live Production Smoke workflow.

## Canonical flagship topology and operations readiness
The flagship is modeled as one canonical open path through all 195 sovereign states: 194 official international legs connect country 1 through country 195 exactly once. The official path starts in Germany and ends in Malta. The operational Malta → Germany return home is retained separately as `postTripReturn` and is explicitly excluded from the 194-leg invariant.

The invariant is enforced by `scripts/flagship-topology-model.mjs`, public-data validation and browser/production smoke tests. North Korea is therefore no longer a country-catalog-only placeholder: it is represented in the official macro path, while its operational corridor remains intentionally unresolved until source-backed review.

Operational readiness is generated into:
- `data/flagship-readiness.json` — canonical topology, continuity, movement, flight-geometry, evidence and blocker summary.
- `data/flagship-operations-queue.json` — deterministic P0/P1/P2 task queue with missing fields, evidence state, geometry state and departure-blocking status.

Verification dates are ISO `YYYY-MM-DD` values. Legacy Excel serial dates are normalized by `scripts/verification-date-model.mjs`; invalid verification-date formats fail validation instead of being counted as fresh evidence.

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

## Flagship readiness
The current operational health of the 195-country flagship is generated from the route, movement and flight-geometry datasets. The canonical machine-readable snapshot is `data/flagship-readiness.json`.

```bash
node scripts/audit-flagship-readiness.mjs
node scripts/audit-flagship-readiness.mjs --check
node scripts/audit-flagship-readiness.mjs --strict
```

The normal release build refreshes the snapshot deterministically. `--check` fails when the committed report is stale. `--strict` is reserved for departure-readiness gating; the public site may remain publishable while operational blockers are still visible.


## Multi-trip platform foundation

ONE WORLD ROUTE is no longer architected as a single hard-coded world itinerary. The original world journey remains the flagship route and keeps its existing **195-country scope / 194 international macro-leg invariant**. A generic platform layer now supports additional routes without changing that macro model.

Current platform features:
- trip catalog with clean `/trip/:slug` share URLs
- generic **place → visit/stop → segment** data model
- open trip-kind slugs rather than a closed list of product types
- namespaced trip/stop/segment extensions for specialized metadata
- capability-driven Story and Terrain features
- regional routes with repeat visits to the same place
- transport taxonomy for road, rail, ferry, cruise, flight and multimodal travel
- browser-local Traveller Context for passport country, residence, language, currency, origin, party and reduced-mobility context
- catalog-driven Route Discovery and transparent Route Fit filters, including accessibility context
- six initial UI languages: English, German, Italian, Spanish, French and Portuguese
- Italy Grand Tour as the first regional editorial template
- modular platform validation in the release pipeline
- Practical trip-planning layer for capability-enabled regional routes: collapsible day-by-day itinerary, known transport minimums, fare/evidence coverage, Route Fit and Traveller-origin context
- Browser-local trip utility layer: save a journey, filter saved journeys, export JSON/CSV/ICS and calculate a personal planning estimate from explicit user assumptions without accounts
- My Trips planning workspace with saved-route status, start date, planning season, budget state, transparent Traveller Context checks and a portable planning-backup export
- Practical planning capability across all published regional journeys; missing transport prices stay explicitly unknown rather than being inferred
- Neutral side-by-side journey comparison for up to three routes, including duration, countries, transport, seasons, Route Fit, editorial status and Traveller Context checks
- Crawlable localized trip pages with real itinerary, planning/evidence summaries and source links instead of metadata-only auto redirects

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

### Cruise model demonstrator

The Western Mediterranean Cruise Loop proves that cruise travel fits the same place → visit/stop → segment architecture without pretending that a cruise is a ferry or a border-free journey.

The demonstrator models:
- embarkation, port-call and disembarkation visits
- repeated Barcelona home-port visits with distinct stop IDs
- seven onboard nights across cruise segments
- a sea day attached to the sea segment rather than represented as a fictional place
- port-facility evidence independently from any ship/operator schedule
- null ship, operator, berth, call times and price until a concrete sailing is selected
- Schengen exit to Tunisia and re-entry in Spain as traveller-context-dependent border transitions

The route is deliberately `illustrative-template`: official port sources prove that the ports support cruise traffic, but do not prove that one operator sells this exact sequence on a given date.

### International trip discovery

Public trip metadata is now language-addressable rather than being only an in-app translation layer.

For every supported public locale (`en`, `de`, `it`, `es`, `fr`, `pt`), trips have clean crawlable URLs such as `/de/trip/italy-grand-tour`. These pages emit:
- localized title and description
- language-specific canonical URL
- bidirectional `hreflang` alternates plus `x-default`
- Schema.org `TouristTrip` JSON-LD
- an interactive-app target that preserves the explicit language

The trip catalog declares `defaultLocale` and `supportedLocales`. Validation fails if any public trip lacks a title or subtitle for a published locale. A deterministic `data/platform/trip-index.json` is generated from the published datasets and powers the crawlable localized trip pages without duplicating editorial facts by hand.

### Route Discovery and road-trip context

The route library now supports client-side discovery by free-text search, travel type, region and duration band. Discovery facets live in the trip catalog and are validated for every public trip.

The Southern Europe Road Trip is the first cross-border road-trip template:
- Lisbon → Seville → Granada → Valencia → Barcelona → Montpellier → Marseille → Nice → Genoa → Florence → Rome
- 20 days / 11 stops / 4 countries
- official EU context for licence, insurance and cross-border rental handling
- official national sources for Portugal tolls, Spanish urban/LEZ rules, French Crit'Air, Italian motorway tolls and Rome ZTL
- no invented drive times, toll totals or fuel costs; those remain vehicle/date dependent

Traveller Context now has an optional Vehicle Context containing vehicle type, registration country, fuel/powertrain, Euro emissions class and rental cross-border approval. It deliberately does not store licence numbers, VINs or booking data.

### Local preview without Vercel

A dependency-free local server mirrors the important clean URL behaviour:

```powershell
Set-Location ".\one-world-route-public-mvp"
node .\scripts\serve-local.mjs
```

Then open `http://127.0.0.1:4173/`.

Examples:
- `http://127.0.0.1:4173/?trip=italy-grand-tour&lang=de`
- `http://127.0.0.1:4173/?trip=southern-europe-road-trip&lang=de`
- `http://127.0.0.1:4173/?trip=western-mediterranean-cruise-loop&lang=de`
- `http://127.0.0.1:4173/de/trip/italy-grand-tour`

Set `$env:OWR_PORT` before starting if port 4173 is occupied. The GitHub validation workflow also starts this server and smoke-tests local routes, so local-preview regressions are caught without a Vercel deployment.



### Platform runtime modules

The multi-trip platform is intentionally split into small browser modules that are bundled before the platform bootstrap:

- `platform/runtime.js` — extension registry
- `platform/i18n.js` — platform and legacy-world localization data
- `platform/model.js` — reusable place/stop/segment helpers, geometry and capability checks
- `platform/traveller.js` — privacy-limited Traveller Context storage/normalization
- `platform/discovery.js` — catalog facets and Route Fit filtering
- `platform/trip-tools.js` — browser-local saved trips, start dates, seasonal planning preferences, budget assumptions, workspace backup and JSON/CSV/ICS exports
- `platform/traveller-fit.js` — transparent party/accessibility/vehicle context signals without hidden scores
- `platform/my-trips.js` — browser-local planning workspace for saved journeys
- `platform/home.js` — public catalog-driven homepage and multi-route Globe preview
- `platform/extensions.js` — registered cruise, road and border presenters
- `platform/map-style.js` — shared terrain label localization and ONE WORLD ROUTE dark map styling
- `platform.js` — UI/bootstrap orchestration only

Normal new trips use the generic regional renderer. A new trip kind must not require a new branch in `platform.js`.

See `data/platform/TRIP-AUTHORING.md` for the authoring contract.

Create a safe unpublished starter draft with:

```bash
node scripts/scaffold-trip.mjs japan-by-rail rail --days=16 --write
```

The scaffolder writes only to `data/platform/drafts/`; it never publishes or edits the public trip catalog automatically.
