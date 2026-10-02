# ONE WORLD ROUTE — CI Validation Strategy

The CI contract is designed to keep validation time bounded as the Journey catalog grows.

## Critical-path principle

PR validation must scale with **risk**, not with the total number of Journeys.

Every PR keeps two mandatory gates:

1. **Core checks** — schemas, deterministic artifacts, policy/unit tests.
2. **Release build and preview** — full release generation plus local route preview smoke.

Browser QA is scope-selected from the PR diff.

## Risk tiers

### Tier A — generated/editorial metadata

Examples:

- route visual manifests,
- visual briefs/coverage,
- media manifest,
- graphics backlog,
- trip index,
- generated route WebPs.

Gate: Core + Release.

These files do not independently trigger Builder/Regional/Discovery browser suites because their deterministic contracts are already checked by Core/Release.

### Tier B — Journey/catalog content

Examples:

- `data/platform/trips/<trip-id>.json`
- `data/platform/trips.json`
- collection metadata.

Gate:

- Core + Release,
- changed-Journey browser smoke,
- fast representative Discovery smoke when catalog/discovery metadata changes.

The changed-Journey browser smoke checks every changed Journey on desktop, but only a bounded sample of up to two changed Journeys on mobile. This prevents browser time from growing linearly on both viewports.

### Tier C — runtime/UI code

Examples:

- Home/Discovery runtime,
- Regional runtime,
- Flagship runtime,
- Place Experience runtime,
- Internal Trip Builder.

Gate: Core + Release + the relevant full browser suite(s).

Full Discovery uses parallel desktop/mobile workers.

## Production gate

A main push does not repeat PR browser regression.

After deployment, Production smoke uses the two critical representative viewports:

- desktop 1440,
- mobile 390.

The broader viewport matrix is intentionally not on the merge critical path.

## Full regression

`.github/workflows/platform-full-regression.yml` runs the broad browser matrix outside the PR critical path on schedule and can also be started manually.

It covers:

- Discovery at 1440/1920 and mobile 360/390/430,
- Regional desktop and all critical mobile widths,
- Flagship,
- Place Experiences.

This preserves broad regression coverage without forcing every content/media batch to wait for it.

## Performance targets

Typical content/media/catalog PR:

- scope detection: < 15 s
- Core: < 30 s
- Release: < 30 s
- targeted browser critical path: approximately 1–3 min

Runtime/UI PRs can take longer because they intentionally run full browser coverage.

The important invariant is that adding more published Journeys does not automatically add more full-browser suites to every PR.

## Rules for future CI changes

- Do not add a new full browser suite to the default PR path unless the changed scope genuinely requires it.
- Prefer deterministic Node validation over browser validation for data contracts.
- Prefer representative browser sampling over exhaustive rendering when schema/data validation already covers every item.
- Keep broad device matrices scheduled/manual.
- Do not weaken assertions merely to reduce runtime.
- Fix stale hard-coded catalog counts; tests must derive expected catalog size from source data.
- Measure critical-path duration, not the sum of parallel job durations.
