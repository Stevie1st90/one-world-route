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
