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

The runtime extension registry currently supports cruise, road/vehicle and border context. Unknown extensions must be ignored safely until a presenter is registered. Validation follows the same pattern: `scripts/platform-extension-validators.mjs` loads independent validators from `scripts/platform-extension-validators/`, while the core validator remains limited to the universal place -> stop -> segment contract.

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
