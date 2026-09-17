# ONE WORLD ROUTE — Public Explorer

A zero-backend public MVP for the 195-country route project.

## What is implemented

- Full-screen interactive 3D globe using `globe.gl` 2.46.2 from jsDelivr
- All 194 executable route segments from the V19 operational master
- All 195 countries, including the separate DPRK scope
- 12 route phases with focus controls
- Clickable country points and route arcs
- Search / command palette (`Ctrl/Cmd + K`)
- Shareable URL state for segment, country, layer, phase and mode
- Explore and Operations modes
- Layers: Route, Status, Visa, Health, Cost, Risk, Progress, Critical Path
- Filters: transport, booking tier, feasibility, alert
- Segment and country detail panels
- Source links and verification dates
- Timeline slider and animated route playback
- Responsive glassmorphism UI and mobile drawers
- Public/private data separation

## Privacy model

The site consumes only `data/public-route.json`, generated from the private V19 master workbook. The public export intentionally excludes:

- PNRs / booking references
- booked/paid amounts and payment dates
- passport details
- insurance identifiers
- private document links
- emergency contacts
- liquidity/card information

Do not replace the public JSON with the full workbook.

## Run locally

Because browsers block local `fetch()` from `file://`, use any static server:

```bash
python -m http.server 8080 -d site
```

Then open `http://localhost:8080`.

## Free deployment

### GitHub Pages
Push the contents of `site/` to a repository and publish the repository root (or `/docs`). No backend is required.

### Vercel / Cloudflare Pages
Deploy `site/` as a static directory. There is no build command for this MVP.

## Runtime dependencies

The MVP loads the globe engine from jsDelivr and geographic country centroids from REST Countries, with the mledoze/countries GitHub dataset as fallback. Route data itself is local/static.

## Next.js scaffold

The repository root also contains an optional Next.js scaffold for the later production migration. The current execution environment had no npm DNS access, so the verified deliverable is the zero-build static app in `site/`.
