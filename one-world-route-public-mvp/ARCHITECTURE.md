# ONE WORLD ROUTE — Production architecture

## Runtime
The browser loads two local JavaScript bundles and two local CSS bundles:
- `core.bundle.js` / `core.bundle.css`: explorer, globe, story and core mobile UI.
- `features.bundle.js` / `features.bundle.css`: operations, high-detail globe, terrain and Release 2 features.

Source modules remain separate for maintenance. Rebuild bundles with `node scripts/build-bundles.mjs`.

## Data boundary
`data/public-route.json` is the publication-safe plan. Never publish PNRs, booking/payment data, passport details, insurance identifiers, private documents, emergency contacts or liquidity/card data.

Use `node scripts/sanitize-public-route.mjs <master-export.json>` and then `node scripts/release-build.mjs`.

## Geometry
`data/route-waypoints.json` supplies curated corridor waypoints. Terrain follows these where available and uses geodesic fallback elsewhere. This avoids runtime dependence on public routing APIs.

## Live and media
`data/actual-progress.json` is independent from the plan and powers Plan vs Actual. `data/media.json` stores optional country/segment/day journal entries. `data/changelog.json` is the public route change history.

## SEO
Vercel rewrites clean `/route/:id` and `/country/:slug` URLs to `api/share.js`, which emits crawlable metadata before opening the interactive explorer. Sitemap generation is automated.

## PWA
The service worker caches the shell and stable public planning data. Live progress, media and changelog are network-fresh. Third-party OSM and Mapterhorn tiles are intentionally excluded from offline caching.

## Operational movement foundation (Release 3 work in progress)

`data/operational-movements.json` is a separate public planning ledger. It does not mutate `public-route.json`, the 194 macro legs, country numbering, or the EUR 90.6k base model. Transfers link adjacent macro legs using stable IDs. Unknown mode, duration, price, booking requirement and actuals are `null`, not zero. Duration is in minutes; costs are EUR. Date-only planning windows are inherited constraints, not booked departures. Actual timestamps should be ISO 8601 with offsets.

`data/flight-geometries.json` is regenerated from the public corridors and the checked-in subset of OurAirports coordinates. A flight route is emitted only if every arrow node has one unambiguous airport code. City codes (LON), alternative airports and unselected A/B routes remain in the review list. Coordinates establish airport location, not current service availability. Transit airports do not increment the sovereign-country counter. Terrain and Journey Statistics consume these geometries; the existing Globe.gl macro arcs are retained.

Operations shows transfers immediately before/after the selected macro leg. Story adds a transfer beat on the existing globe, preserving macro selection and country count. Unreviewed transfers are explicitly labelled. Terrain connectors carry movement IDs and review status and can consume reviewed multi-point geometry. Missing endpoint geometry still uses the existing visual fallback and is not considered operationally resolved.

The initializer `node scripts/build-movement-inventory.mjs` refuses to overwrite an existing ledger. Preserve human edits, sources and actuals when updating it. `node scripts/audit-route-continuity.mjs` checks inventory/schema consistency and reports unresolved connections; `--strict` fails until every connection is explained. Equal coordinates indicate geometric continuity only, not proof that all local transit or alternative corridor choices have been audited. Airport changes require reviewing ledger endpoint changes before the build passes.

Checks:

- `node --test scripts/test-continuity.mjs`
- `node scripts/release-build.mjs`
- `node scripts/audit-route-continuity.mjs --strict` (Release 3 gate; currently expected to fail)
- `cd qa && npm ci && npx playwright install chromium && npx playwright test`
- `node qa/run-local.mjs` runs the suite against a local static server.

The QA matrix is 1440/1920 desktop and 360/390/430 mobile. `OWR_CHROMIUM_PATH` supports a preinstalled Chromium; `OWR_QA_NO_VIDEO=1` retains screenshots/traces without requiring ffmpeg. Optional `OWR_QA_PROXY` and `OWR_QA_PROXY_TLS=1` are exclusively for test environments with TLS-intercepting proxies, never production application settings.

Remaining Release 3 gates: operational verification of transfer candidates, explicit choices for ambiguous airports, local airport/station and cross-border access checks (especially Vatican/San Marino), full terrain visual approval, full privacy review of free text/history, and reconciliation of transfer costs/time with the base plan. No public admin write endpoint is introduced; updates remain authenticated repository changes.

### Existing scope/coverage discrepancy
The unchanged macro data lists 195 countries but only 194 distinct countries occur as leg endpoints. North Korea (`Nordkorea`, country number 98) has no leg; the final leg returns to Germany. Therefore the 194-leg closed itinerary must not be described as a complete 195-country traversal. Resolving this requires a deliberate macro-route decision, not silently adding a border crossing as a domestic subleg. The strict audit reports this as a release blocker.


## Multi-trip platform foundation

The platform layer is additive and does not reinterpret the flagship macro itinerary.

- `data/platform/trips.json` is the public trip catalog.
- `data/platform/trips/*.json` contains generic regional or thematic routes.
- `data/platform/trip-schema.json` documents the reusable trip contract.
- `data/platform/traveller-context-schema.json` documents non-secret traveller planning context.
- `platform.js` / `platform.css` provide route discovery, Traveller Context and the regional Globe.gl renderer. They are compiled into the feature bundles.

The core abstraction is **place → visit/stop → segment**. A place is a geographic entity; a stop is a specific visit to that place; a segment connects two visits. This intentionally supports returning to Rome, repeated cruise port calls, loops, open-jaw itineraries and future user-created routes without duplicating place identity.

Transport is extensible rather than tied to international borders. Cruise itineraries use port visits as stops and sea movements as `cruise` segments; ferry, rail, road, flight and multimodal movements use the same segment contract. Route-specific attributes can be attached without changing the global country counter.

### Global perspective

No route should infer eligibility or advice from a German departure perspective. Traveller-specific logic is keyed by relevant planning dimensions such as passport country/countries, country of residence, preferred language and currency, origin, party composition and accessibility context. The first implementation stores that context only in browser local storage. It must never contain passport numbers, booking/payment data or private identity documents.

Global editorial defaults remain neutral and generic. Visa/entry, price, insurance, health and legal claims require current sources appropriate to the traveller context. Unknown values remain unknown.

### Compatibility

The flagship world trip remains on the existing `legacy-world` renderer, including Operations, Story and Terrain. Regional trips can reuse the standard Globe.gl view without Terrain. The platform validator explicitly fails if the legacy world data ceases to contain 195 country entries or 194 macro legs.

### Route evidence model

Regional trips may contain a `sources` registry. Segment and stage `sourceIds` resolve into that registry. Source records include issuer, issuer type, URL, check date and optionally a validity window. A segment may be marked `verified` only when it has evidence and a verification date; schedule-sensitive connections remain `current-check-required` even when the corridor itself is known to exist.

Published starting fares are not converted into a full trip budget. Connection time is not silently added to operator travel time. For multimodal routes, each stage can carry its own timing, fare and evidence. This allows a route to state, for example, that a ferry stage is verified while the onward coach connection still requires a date-specific check.

Entry guidance is deliberately separate from transport evidence. The Italy pilot points to official government/EU sources and requires Traveller Context rather than deriving citizenship or residence from locale, IP, currency or departure city.

### Cruise specialization

Cruises do not introduce a second route engine. A cruise port is a place; an embarkation, transit call or disembarkation is a stop/visit; sailing between calls is a segment with `mode: cruise`.

Cruise-specific metadata is attached to those existing layers:
- trip: nights, sea-day count, embarkation/disembarkation stop IDs, optional operator/vessel/sailing
- stop: call kind, optional arrival/departure, berth and tender state
- segment: onboard nights, sea-day numbers and sailing service status
- segment border context: origin/destination country, zone transition and whether Traveller Context is required

A sea day belongs to the sailing segment. It must never be invented as a geographic place. A closed-loop cruise may reuse the same home-port place through two distinct stop IDs.

Port infrastructure and a commercial sailing are separate claims. Port authority evidence can validate that a port accepts cruise traffic while the sailing remains illustrative. Only a selected real sailing may populate ship, operator, times, berth and price.

