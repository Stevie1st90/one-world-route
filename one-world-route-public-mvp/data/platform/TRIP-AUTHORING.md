# Trip authoring contract

ONE WORLD ROUTE is intentionally **data-first**. A new normal trip should not require edits to the renderer.

## Core model

Every trip uses the same graph:

**place -> stop/visit -> segment**

- A **place** is reusable geography.
- A **stop** is one visit to a place.
- A **segment** connects two adjacent visits.
- Returning to the same city or port uses a new stop ID pointing to the same place ID.

This supports round trips, rail journeys, road trips, cruises, island hopping, hiking routes, camper routes, city breaks, expeditions and future user-created trips without changing the core renderer.

## Internal Trip Builder

The preferred authoring path for new reusable trips is the local-only builder in `../internal-trip-builder/`.

Run it from the repository root:

```
npm run builder
```

Direct fallback:

```
node internal-trip-builder/server.mjs
```

Then open `http://127.0.0.1:4175/__builder/`.

The builder:

- creates drafts under `data/platform/drafts/` (gitignored),
- can clone an existing reusable public trip into a draft,
- computes catalog metrics from the actual trip graph,
- validates localization, graph continuity, transport modes, source evidence, discovery metadata and registered extensions,
- previews the draft through the real production regional engine without adding it to the public catalog,
- publishes only after the publication gate passes,
- runs the non-mutating platform quality suite before accepting publication,
- rolls the trip/catalog write back if any quality check fails,
- writes publication changes to the local working tree only; Git review, release bundle generation, browser QA, commit and deployment remain separate steps.

Draft preview works by locally injecting the selected draft into the catalog response. No draft-only branch exists in `platform.js`, and no builder code is shipped from the Vercel root.

## Adding a normal curated trip

1. Add `data/platform/trips/<slug>.json`.
2. Add one catalog entry to `data/platform/trips.json`.
3. Use `renderer: "regional-globe"`.
4. Give the catalog item normalized discovery metadata and Route Fit metadata.
5. Run platform validation and model tests.

No JavaScript change should be necessary.

## Trip kinds are open

`kind` is a normalized slug, not a closed product enum. Examples include:

- `round-trip`
- `rail`
- `road-trip`
- `cruise`
- `island-hopping`
- `camper`
- `cycling`
- `hiking`
- `expedition`

A new kind controls discovery/editorial labeling. It must **not** create a branch such as `if (trip.kind === "...")` in the core renderer.

## Extensions

Specialized metadata belongs in a namespaced `extensions` object and is rendered by a registered extension.

Examples:

```json
{
  "extensions": {
    "cruise": {
      "nights": 7,
      "seaDays": 1
    }
  }
}
```

The runtime extension registry currently supports cruise, road/vehicle and border context. Each presenter lives independently in `platform/extensions/` and registers itself with the runtime registry; `platform/extensions.js` only composes registered output. Unknown extensions must be ignored safely until a presenter is registered. Validation follows the same pattern: `scripts/platform-extension-validators.mjs` loads independent validators from `scripts/platform-extension-validators/`, while the core validator remains limited to the universal place -> stop -> segment contract.

During migration the model adapter also understands the existing legacy fields:

- trip `cruise` -> extension `cruise`
- trip `roadTrip` -> extension `roadTrip`
- stop `call` -> extension `cruiseCall`
- segment `cruise` -> extension `cruise`
- segment `roadContext` -> extension `road`
- segment `borderContext` -> extension `border`

New data should use the namespaced extension form. Compatibility aliases exist only to read older datasets during migration.

## Capabilities

Catalog `capabilities` describe what a trip can do. Examples:

- `globe`
- `terrain`
- `story`
- `traveller-context`
- `source-evidence`
- `entry-guidance`
- `vehicle-context`
- `border-context`

Capabilities are product features. Trip kind is editorial classification. Keep those concepts separate.



## Visual discovery and media

Journey discovery is **inspiration first**. A trip may declare a `media.hero` presentation independently from transport evidence.

- `type: "art-directed"` uses the built-in CSS visual themes and has no third-party licensing dependency.
- `type: "image"` is reserved for a controlled local/remote asset with explicit attribution and license metadata.
- Media never counts as route evidence and must not be used to imply that schedules, fares, access or services are verified.
- New editorial-preview journeys may publish with draft transport segments as long as unknown operational facts remain unknown.

The catalog can add presentation-only `visual` metadata such as `theme` and `featurePriority`. Renderers must still depend on the universal place → stop → segment model rather than trip IDs.

## Sources and volatile facts

Do not invent schedules, fares, border rules or eligibility.

- Unknown values remain `null`/unknown.
- Verified facts require source IDs.
- Date-sensitive services use `current-check-required`.
- Traveller-specific legal/entry outcomes require Traveller Context.
- Illustrative cruise sea legs must remain visually/editorially identifiable as illustrative until a real sailing is selected.

## Invariants

The flagship remains separate:

- 195 country entries
- 194 international macro legs
- domestic/local movements never increase that count

A regional trip must never mutate those metrics.

## Required checks

Run:

```
node scripts/validate-platform-data.mjs
node --test scripts/test-platform-model.mjs
node --test scripts/test-platform-navigation.mjs
node scripts/release-build.mjs
```

For browser QA also run the Playwright suite in `qa/`.


## Personalization contract

Every journey can use the global traveller context as the user's personal origin. Do not duplicate the same home origin in every journey.

Use `routePolicy` to state whether the authored route itself may change:

- `startMode: "fixed"` — route order is fixed; the personal origin only affects arrival/departure planning.
- `startMode: "endpoints"` + `reversible: true` — the user may start at either route end and the runtime derives a reverse itinerary.
- `startMode: "any-stop"` — reserved for routes whose data model genuinely supports starting at any stop (for example a fully modelled loop).

Directional transport evidence, fares and timing MUST NOT be reused after reversing a route unless `reverseEvidenceReusable` / `reversePlanningReusable` explicitly say so. The safe default is false.

The product must never invent a "best" gateway from a free-text home city. A future geocoding/routing provider may rank entry gateways, but until such a provider is configured the user chooses the eligible route start explicitly.

## Reusable Place Experiences

Stable destination inspiration belongs in the shared place-experience library, not in every trip file.

A place can opt into reusable content with:

```json
{
  "id": "rome",
  "countryCode": "IT",
  "experienceRef": "IT:rome"
}
```

Profiles live in country shards under `data/platform/place-experiences/`. The runtime loads only shards referenced by the active journey. A Rome profile can therefore be reused by a round trip, road trip or future journey without duplicating translations or maintenance.

Each profile contains:
- a localized evergreen `essence`,
- normalized experience tags,
- `reviewedAt` and `reviewDays` maintenance metadata.

Use this layer for long-lived destination character such as history, food, urban atmosphere, coast, nature or mountains. Do **not** put timetables, fares, opening hours, visa rules, closures, seasonal service availability or other volatile claims here.

If a place has no `experienceRef`, the journey still renders normally. Missing experience coverage is an editorial enhancement opportunity, not a renderer failure. This lets coverage grow progressively without making new journey publication dependent on writing 100% of destination copy first.

## Automatic Journey Guide

Every published regional trip receives a Journey Guide without a second hand-written content file. The guide derives from the canonical trip graph:

- `stop.dayStart` / `stop.dayEnd` → average stay and time concentration,
- segment transport modes → travel flow,
- verification state → current-date review needs,
- known segment costs → transport-price coverage,
- entry, vehicle and origin-access contracts → before-booking context.

Authors should improve the underlying route data rather than copy these facts into prose. This makes the same product depth available to the 18th, 100th or 1000th journey and prevents the guide from drifting away from the itinerary.

The guide does **not** invent activities, live schedules, prices, border outcomes or a “best” gateway. Rich destination stories may still be added as stable editorial content, while date-sensitive claims remain source-backed.

## Low-maintenance content architecture

Keep three layers separate:

1. **Stable journey content** — places, stop order, editorial story, visual media and long-lived discovery metadata.
2. **Shared knowledge** — reusable planning guidance that can apply to many journeys. Store it in `data/platform/shared-knowledge.json`.
3. **Volatile sourced facts** — timetables, fares, entry rules, closures, operator services, access restrictions and similar facts that require current evidence.

Do not copy the same volatile claim into dozens of trip files. If the claim is broadly reusable, model it as shared knowledge with scope and review metadata. If it is route-specific, keep it source-backed in the trip dataset.

Each new trip should define `maintenance`:

```json
{
  "maintenance": {
    "tier": "live-dependent",
    "sourceReviewDays": 90,
    "sharedKnowledge": true
  }
}
```

The maintenance audit is advisory for stale sources and hard-fails only malformed contracts by default. This keeps day-to-day operations low while still surfacing review work.

## Scaling rule

Adding the 18th, 100th or 1000th journey must not require renderer branches for a trip ID. A new journey should normally require only:

- one dataset,
- one catalog entry,
- optional shared-knowledge entries,
- rights-cleared media,
- validation.

If a new travel type needs specialized behavior, implement a reusable capability/extension, not a trip-specific conditional.

The release build generates compact preview geometry into `data/platform/trip-index.json`. Discovery uses that index for the global globe and loads a full trip dataset only when the user opens the journey. Do not add homepage code that fetches every trip file.

Large catalogs must use progressive rendering. A new discovery surface should page or batch results rather than assuming the complete catalog can be rendered at once.
