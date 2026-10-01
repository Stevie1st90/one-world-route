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
- `platform/*.js` contains reusable runtime services: registry, localization, model helpers, Traveller Context, discovery, extensions and map styling.
- `platform.js` is the orchestration/bootstrap layer for regional UI and rendering.
- `platform.css` contains the shared platform presentation layer.
- These sources are compiled into the feature bundles.

The core abstraction is **place → visit/stop → segment**. A place is a geographic entity; a stop is a specific visit to that place; a segment connects two visits. This intentionally supports returning to Rome, repeated cruise port calls, loops, open-jaw itineraries and future user-created routes without duplicating place identity.

Transport is extensible rather than tied to international borders. Cruise itineraries use port visits as stops and sea movements as `cruise` segments; ferry, rail, road, flight and multimodal movements use the same segment contract. Route-specific attributes can be attached without changing the global country counter.

### Global perspective

No route should infer eligibility or advice from a German departure perspective. Traveller-specific logic is keyed by relevant planning dimensions such as passport country/countries, country of residence, preferred language and currency, free-text origin, structured starting country, party composition and accessibility context. The broad discovery region is derived from the selected starting country rather than manually requested from the traveller. The first implementation stores that context only in browser local storage. It must never contain passport numbers, booking/payment data or private identity documents.

Global editorial defaults remain neutral and generic. Visa/entry, price, insurance, health and legal claims require current sources appropriate to the traveller context. Unknown values remain unknown.

### Runtime module boundaries

The generic platform is split by responsibility:

- **runtime registry** — extension registration and discovery
- **model** — place/stop/segment graph helpers, route geometry, bounds and capability queries
- **traveller** — allowlisted local-storage planning context
- **UI primitives** — shared dialogs, global route/traveller actions, toasts and regional settings snapshots
- **navigation** — reusable trip URL construction and regional URL state
- **discovery** — catalog facets and transparent Route Fit predicates
- **regional shell** — trip chrome, stop navigation and chapter rail
- **regional detail** — generic trip/stop/segment detail rendering
- **journey guide** — deterministic route-depth summary derived from stop duration, transport modes, price coverage, verification state and route context
- **place experiences** — lazy-loaded country shards for reusable evergreen destination inspiration; route files carry only `experienceRef` references
- **regional globe** — Globe.gl isolation, route geometry, camera and focus behavior
- **regional timeline** — timeline DOM, selected-segment playback and playback timer
- **regional controls** — settings wiring and methodology UI
- **regional selection** — selected segment/stop interaction coordination across detail, globe, timeline, terrain and story
- **extensions composer** — combines registered presenter output without knowing concrete trip kinds
- **extension presenters** — independent `platform/extensions/*.js` modules such as cruise, road and border
- **i18n** — platform and legacy-world message data
- **formatters** — stateless duration, cost/currency and localized editorial-note formatting
- **legacy localization** — DOM translation compatibility for the Flagship world renderer only
- **map style** — shared terrain localization/branding for world and regional renderers
- **platform bootstrap** — catalog/profile bootstrap and dependency wiring; regional rendering behavior lives in dedicated modules

Core route rendering must not branch on a specific trip ID or trip kind. A normal new route is data-only. Specialized behavior must be introduced as a namespaced extension and registered presenter/validator. Runtime presenters live in independent `platform/extensions/` modules and are composed generically by `platform/extensions.js`. Extension validation is split into `scripts/platform-extension-validators/` modules loaded through a registry. Adding a new specialization therefore does not require editing either the core renderer or the core platform-data validator.

Current pilot data has been migrated to namespaced extensions:
- `extensions.cruise`
- `extensions.roadTrip`
- stop `extensions.cruiseCall`
- segment `extensions.cruise`
- segment `extensions.road`
- segment `extensions.border`
- place `extensions.port`

The model adapter still reads the previous field names for backward compatibility.

Trip kinds are open normalized slugs. Capabilities determine product behavior. This allows, for example, `camper`, `cycling`, `hiking`, `rail` or `expedition` routes to use the same renderer without expanding a closed enum.

### Compatibility

The flagship world trip remains on the existing `legacy-world` renderer, including Operations, Story and Terrain. Regional trips can reuse the standard Globe.gl view without Terrain. The platform validator explicitly fails if the legacy world data ceases to contain 195 country entries or 194 macro legs.

Place Experience content is a separate stable-content layer. A place may reference one localized evergreen profile through `experienceRef`. The runtime loads only the country shards needed by the active journey. The same profile can serve rail, road, cruise or future journeys without duplicating copy. Operational claims never belong in this layer.

Regional Journey Guide content is intentionally derived, not a second editorial datastore. It consumes the same place → stop → segment graph and therefore scales automatically to newly published regional journeys. Volatile facts remain in their evidence and maintenance layers.

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

### International SEO contract

`data/platform/trips.json` is the source of truth for public locales. Localized trip share routes use `/:lang/trip/:slug` and are rendered by `api/share.js`. Unsupported language codes are never allowed to create canonical URLs.

Each localized trip page includes its own canonical URL, all supported `hreflang` alternates, an `x-default` route and Schema.org `TouristTrip` JSON-LD. The interactive target preserves `lang` in the query string. An explicit URL language takes precedence over a previously stored browser-language preference.

Sitemap generation uses the same catalog locale list, avoiding a separate hard-coded SEO language matrix.

### Route Discovery

Trip discovery is catalog-driven. Every public catalog item carries normalized `regions`, `themes`, `modes` and a duration band. The browser derives filters from those fields instead of maintaining a separate route-category list. Catalog validation rejects routes without discovery metadata.

### Vehicle Context and road trips

Road trips reuse the normal place → visit/stop → segment model. Vehicle-specific metadata lives in the road extension (currently `segment.extensions.road`) for cross-border status, toll systems, urban-access checks and rental approval requirements.

Traveller Context optionally carries a non-secret Vehicle Context:
- vehicle type
- registration country
- fuel/powertrain
- Euro emissions class
- whether a rental is approved for cross-border use

The platform must not infer road eligibility from nationality or language. Cross-border rental approval is contract-specific; non-EU licence recognition can be country-specific; toll and low-emission-zone outcomes can depend on the exact vehicle. Therefore unresolved road segments remain `current-check-required` until those inputs are known.

### Local preview server

`scripts/serve-local.mjs` serves static assets and mirrors the production share rewrites for `/trip/:slug`, `/:lang/trip/:slug`, `/route/:id` and `/country/:slug`. This allows manual and CI verification without consuming a Vercel deployment. CI smoke-tests the local root and localized trip pages after the release build.


## Internal authoring plane

Curated trip creation is separated from the public runtime. The local-only `internal-trip-builder/` tool is outside the Vercel Root Directory and binds to `127.0.0.1` only.

Its pipeline is:

**draft -> shared publication contract -> real regional-engine preview -> transactional local publish -> normal Git/CI/visual-QA/deploy flow**

Drafts are stored under gitignored `data/platform/drafts/`. Preview does not modify the public catalog on disk: the local builder server injects the selected draft into the catalog response for the preview session and points its dataset at the draft file. The browser therefore exercises the same `platform.js` and regional modules used by production.

Publication recomputes catalog metrics from the trip graph and runs the same extension validators used by the public platform. Before a local publication is accepted, the builder runs the non-mutating platform quality suite: public/platform data validation, model, locale, formatter, share, navigation, regional runtime, rail, story and continuity tests. Any failure rolls back both `trips.json` and the target trip file. Release bundle generation and browser QA remain in the normal CI path, so the authoring tool never commits, pushes or deploys.

## Post-deploy production verification

`.github/workflows/production-smoke.yml` runs after every push to `main`. It waits until the GitHub commit status from Vercel reports a successful deployment, then executes Playwright against `https://one-world-route.vercel.app` on desktop and mobile. The smoke suite checks Flagship 195/194 invariants, mobile shell stability, the Cruise regional tooltip isolation contract and the Central Europe Rail shared-engine route. Screenshots/traces are retained as workflow artifacts.
# Scalable journey visual pipeline

`scripts/route-visual-model.mjs` extracts segment coordinates first, regional stop endpoints second, or existing waypoint/airport geometry for datasets with country-based segments. The existing country-centroid fallback is explicitly schematic. Available operational connector geometry supplements the geographic illustration without changing international-leg identity/counts. The 195/194 world model is never edited by visual authoring.

`scripts/route-visual-provider.mjs` is an authoring-only local raster adapter, exposing `render(route, ratio, target)`. It decodes the bundled, checksum-verified Natural Earth source once, computes inverse geographic samples, applies the editorial style and overlays the route. Sharp is a pinned build dependency, not a browser library. A future offline MapLibre/PMTiles/DEM adapter can implement the same small interface; no provider SDK is loaded by cards.

Authoring commands, from the public app directory after `npm ci`:

```bash
node scripts/build-route-visuals.mjs --all
node scripts/build-route-visuals.mjs --trip=japan-by-rail
node scripts/build-route-visuals.mjs --check
node scripts/build-route-visuals.mjs --all --prune
node scripts/build-media-manifest.mjs
node scripts/build-visual-coverage.mjs
```

The input hash includes extracted route geometry, stops, country/region styling, localized title, kind, renderer/style versions, actual renderer/model code hash, aspect/output size, preset scope, provider and source checksum. A changed journey regenerates only its three native formats and small landscape derivative. Unchanged files are reused and their output checksum is checked. A source/style/renderer change intentionally invalidates affected outputs. Filenames include the first 16 hash hex characters; manifests contain complete input and output hashes. No timestamps or randomness are added to generated output.

`--check` imports no Sharp and renders nothing. It rejects stale manifests, missing/corrupt native or responsive assets and invalid source approval/checksum. The release workflow generates only stale assets, then creates the existing media manifest and coverage report. CI runs `--check` and targeted geometry/policy tests. Generation and media/coverage refresh also run in the existing builder publication workflow; rollback restores these manifests as well as the catalog and original publication snapshots. Failed attempts can leave unreferenced immutable files; safe later pruning removes them.

`platform/visual-policy.js` owns the single fallback rule. `platform/media.js` provides descriptors, rendering markup and cached manifest loading; it does not duplicate that rule. The browser and authoring manifest both call the policy. Hero resolution, discovery cards and Social use these descriptors. Existing Place Experience identities resolve destination visuals from the same registry without copying assets. Collection/region destination references can use that library; automatic aggregate collection rendering is deliberately not implemented as a collage.

`data/platform/route-visuals.json` records formats, camera fit, source, scope, geometry basis and dimensions. The existing `media-manifest.json` gains eligible covers, destination assets and route assets while retaining its hero/gallery compatibility fields. `visual-coverage.json` records automatic, destination, bespoke, portrait, vertical, rights and resolved state, with a generated country/region/place queue. The internal builder exposes a lightweight visual coverage panel for published journeys. None of these coverage levels are public product tiers.

For v1, hash-named WebP assets are under `assets/generated/routes/<trip-id>/`; the reusable source and rights descriptor are under `data/visual-sources/`. Only compressed source and delivery derivatives are committed. `--prune` removes obsolete files for the catalog's current journeys; retain versions through rollback/cache windows in a future CDN workflow. Around 1,000 journeys or 200 MB, move image objects to an approved bucket/CDN and retain code/license descriptors/manifests in Git. A future remote adapter must use an explicit URL allowlist and staged uploads; current browser assets are restricted to safe local paths. See ROUTE_VISUAL_PROVIDERS.md for costs and licensing.

## Journey Visual Experience v2

Visual policy remains centralized in `platform/visual-policy.js` and `platform/media.js`. Discovery and identity resolve approved covers, suitable destinations, then the unchanged automatic route output. Orientation resolves geographic imagery only. Social switches between native inspirational first-frame media and native geographic route-scene media. Region cache output `region-visuals.json` is folded into the existing media manifest, not a second editorial registry.

`build-region-visuals.mjs` rotates the rights-approved Natural Earth texture to six declarative cameras and reuses `localReliefProvider.render` without modifying the v1 route renderer or its hash contract. Separate temporary filenames prevent Sharp cache reuse across cameras. Final images extract the first orthographic hemisphere, preserving real coastlines and restrained region accents. Region counts still come from the current catalog. Local flags use the vendored MIT assets; future journeys require no runtime service or manual flag creation.

`platform/journey-shell.js` derives Explore / Plan / Story / Terrain / Operations from capability and planning data. It mounts one public mode navigation in the left identity column on desktop and above the explorer on mobile. `platform.js` adapts those actions to regional components or the legacy-world engine. Legacy mode controls remain hidden event targets; Operations data/tabs and the world engine remain intact. The legacy Plan adapter opens the existing planning-date/context dialog; regional Plan opens existing detailed planning. Legacy world stop/layer/timeline/Operations internals remain distinct because a core rewrite would risk the 195/194 topology. The public identity, action language and mode hierarchy are shared. This is an incremental shell migration, not a universal data conversion.

The left column holds identity and stops, the center interactive exploration, and the right understanding/planning. Regional overviews no longer repeat the static route image. Optional `editorial.whyThisJourney` provides up to four localized source-backed points; otherwise existing summary/highlights remain the editorial content.

Story moves the shared navigation into the visible stage on desktop as well as mobile. The legacy adapter retains journey and locale query parameters across mode changes and restores historic explorer links without sending them to Home. Terrain ownership is derived from the active engine, not merely the presence of a `trip` query parameter. The existing terrain and hillshade DEM sources remain separate; a bounded 45-second load deadline accommodates slower tile networks before the existing fallback is shown.

`visual-brief-model.mjs` and `build-visual-briefs.mjs` produce `visual-briefs.json` for the catalog and update the existing graphics queue. Internal builder publishing regenerates briefs and restores all affected manifests/backlog on failure. The builder exposes `/__builder/api/visual-briefs`; status remains internal. Cover creation and rights review remain separate from automatic journey publishing. No images or automatic social posts are generated by this block.
