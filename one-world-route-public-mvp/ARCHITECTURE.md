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
