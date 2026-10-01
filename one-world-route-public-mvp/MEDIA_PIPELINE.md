# ONE WORLD ROUTE — Production Media Pipeline v1

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

## First batch

Eight approved 16:9 Journey Covers are included in this package. The installer creates 480/800/1200/1600 WebP derivatives at quality 84 and registers them.

## Fast future batch workflow

1. `npm run covers:queue -- --limit=24 --out=/tmp/cover-batch.json`
2. Generate the batch using the output prompts and exact `sourceFilename` values.
3. Place all generated PNGs in one incoming folder.
4. `npm run covers:review -- --spec=/tmp/cover-batch.json --source-dir=/incoming --out=/tmp/review.jpg`
5. Review the contact sheet as a batch. Only exceptions need individual re-generation.
6. Mark accepted items `reviewStatus: approved`.
7. `npm run covers:ingest -- --spec=/tmp/approved-batch.json --source-dir=/incoming`
8. Run `node scripts/release-build.mjs`.

Recommended batch size: 12–24 covers. The goal is batch review, not one-image-at-a-time review.

## Scaling

For thousands of Journeys, generated Source Masters should move to object storage. The delivery repository should contain only optimized derivatives until CDN/object-storage delivery is introduced.

Destination media should not be generated for every Place. User-owned, creator-authorized and licensed real media can later populate Place media pools; generated Destination Visuals should be selective.
