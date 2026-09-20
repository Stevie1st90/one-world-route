# ONE WORLD ROUTE — Public Explorer

A production-oriented interactive explorer for one continuous journey through all 195 sovereign states.

## Implemented
- 195 countries / 194 executable route legs / 12 chapters
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
