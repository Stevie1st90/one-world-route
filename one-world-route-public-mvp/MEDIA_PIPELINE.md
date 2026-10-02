# ONE WORLD ROUTE — Production Media Pipeline v2

## Stable naming

Source master:
`source--journey--<trip-id>--cover--16x9--v001.png`

Delivery:
`journey--<trip-id>--cover--16x9--v001--w<width>.webp`

Repository path:
`assets/media/journeys/<trip-id>/cover/v001/`

The trip ID is therefore present in the directory, asset ID and every delivery filename.

## Production roles

- Source PNG: editorial master; retained outside the delivery repository long-term.
- WebP variants: delivery assets only.
- Registry: source provenance, SHA-256, focal point, alt text and rights/review state.
- `heroAssetId`: points a Journey to the approved registry entry.
- Auto Route Visual remains the fallback and geographic/orientation visual.

## Current coverage

After Journey Cover Batch 0001, 18 of the current 21 Journeys have an approved bespoke 16:9 cover. The standard queue therefore contains only the remaining non-special Journeys. `world-195` is intentionally handled as a separate planetary/hybrid visual because factual route geometry must come from route data, not image generation.

## Fast future batch workflow

1. `npm run covers:queue -- --limit=10 --out=/tmp/cover-batch.json`
2. Generate the batch using the output prompts and exact `sourceFilename` values.
3. Place all generated PNGs in one incoming folder.
4. `npm run covers:review -- --spec=/tmp/cover-batch.json --source-dir=/incoming --out=/tmp/review.jpg`
5. Review the contact sheet as a batch. Only exceptions need individual re-generation.
6. Mark accepted items `reviewStatus: approved`.
7. `npm run covers:ingest -- --spec=/tmp/approved-batch.json --source-dir=/incoming`
8. Run `node scripts/release-build.mjs`.

Recommended batch size: **up to 10 covers** per generation pass. The generator queue hard-caps the standard batch at 10.

A batch means **up to 10 isolated single-asset generations followed by one shared review**. Do not ask the image model to combine multiple Journeys into one collage or multi-scene output. Each queue item has one exact `tripId`, one exact `sourceFilename` and one prompt.

Published approved Journey Covers are automatically excluded from future queues. `world-195` is excluded from the normal queue by default; use `--include-special=true` only for an explicit special-visual production pass.

The goal is batch review, not one-image-at-a-time review.

## Scaling

For thousands of Journeys, generated Source Masters should move to object storage. The delivery repository should contain only optimized derivatives until CDN/object-storage delivery is introduced.

Destination media should not be generated for every Place. User-owned, creator-authorized and licensed real media can later populate Place media pools; generated Destination Visuals should be selective.

## Operations

Repository-changing media runs must follow [`PRODUCTION_WORKFLOW.md`](./PRODUCTION_WORKFLOW.md), including isolated worktrees, explicit generated-file allowlists and repository-root-aware Git path checks.
