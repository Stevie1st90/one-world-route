# Route visual providers and costs

Research date: 2026-10-01. No paid account, API key, secret or tariff was activated.

## v1 decision

Static images use the bundled **Natural Earth II 1:50m shaded relief and water v3.2.0**, compressed from the geographic TIFF to WebP without changing its 10800 × 5400 grid. Provenance, original URL, SHA256 and reviewed rights are in `data/visual-sources/source.json`. A local authoring-only renderer samples this grid and overlays existing journey geometry. No external map or tile request occurs during rendering or card display. Image hosting/CDN and build compute still have their ordinary platform costs.

Natural Earth explicitly permits personal, educational and commercial use, modification and dissemination of its public-domain raster/vector data; no permission or credit is required. We retain voluntary credit and the source URL. This is generalized shaded relief and idealized land cover, not current satellite imagery, a high-resolution DEM or an evidence source. The grid spacing is approximately 3.7 km at the equator. A LOCAL preset cannot invent fine detail missing from the source; detailed local DEM rendering remains future work.

Primary sources:
- https://www.naturalearthdata.com/about/terms-of-use/
- https://www.naturalearthdata.com/downloads/50m-raster-data/50m-natural-earth-2/
- https://naturalearth.s3.amazonaws.com/50m_raster/NE2_50M_SR_W.zip

## Existing interactive maps and alternatives

| Option | Rights / export / caching | Cost / operations | Decision |
| --- | --- | --- | --- |
| Local Natural Earth raster | Public domain; local storage, redistribution and rendered derivatives permitted | No provider requests or per-render fee; one local source; bounded build CPU | Production static visuals |
| OpenFreeMap public instance | Official FAQ permits commercial interactive use with OSM/OpenMapTiles attribution. Terms prohibit automated data collection without permission; MIT code does not grant blanket tile/data rights | Officially no view/request limit or API key for normal use; donation-funded; no SLA | Existing interactive basemap retained. No automated batch export from its public service; use legally reviewed downloadable/self-hosted data if migrating |
| Mapterhorn | Code BSD-3; terrain comes from multiple open datasets with per-source attribution/licenses | Public interactive tiles; data download and self-hosting available; storage and bandwidth are your responsibility | Existing interactive terrain retained. No blanket export/redistribution clearance is inferred for every country dataset; not used by v1 exports |
| MapTiler Cloud | Free plan is non-commercial/R&D. Cloud terms restrict server-side cache, screenshots as substituted delivery, export and bulk downloading; custom written agreement needed for this pipeline | Cannot estimate lawful batch cost from a standard subscription alone | Not enabled; obtain a written export/cache agreement and quote before consideration |
| MapLibre + own PMTiles/vector data + licensed DEM | Renderer license is separate from vector/DEM rights. OSM-derived data requires its applicable attribution/database obligations; each DEM must be reviewed | Own storage/CDN/range GETs and data generation; no inherent fee per journey; greater operations than the current raster | Preferred migration path when detailed/local terrain or much larger traffic justifies it |

Primary sources:
- https://openfreemap.org/ and https://openfreemap.org/quick_start/
- https://openfreemap.org/tos/
- https://mapterhorn.com/, https://mapterhorn.com/attribution/, https://mapterhorn.com/data-access/
- https://www.maptiler.com/terms/cloud/
- https://docs.protomaps.com/pmtiles/cloud-storage
- https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt

OpenFreeMap's Terms of Service, last updated September 9, 2026, prohibit automated data collection without permission. Its FAQ allowing commercial interactive use and describing unlimited requests is not authorization for bulk collection. This pipeline avoids that legal dependency as well as the operational dependency: local licensed data keeps authoring independent of public service availability and future service changes.

## Scaling model

Measure current output from `route-visuals.json`: four files per journey (1200 × 675, 600 × 338, 800 × 1000, 900 × 1600), roughly 0.15 MB per journey for the current proof set. Budget **0.2 MB per journey** conservatively; complex future geometry can increase this. The reusable source adds 5.1 MB once. No huge TIFF/source masters are committed.

| Journeys | Files | Expected outputs at 0.15 MB | Conservative at 0.2 MB | Initial renders | One changed journey |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 400 | 15 MB | 20 MB | 300 native renders + 100 small resizes | 3 native renders + 1 resize |
| 1,000 | 4,000 | 150 MB | 200 MB | 3,000 native renders + 1,000 resizes | 3 native renders + 1 resize |
| 10,000 | 40,000 | 1.5 GB | 2 GB | 30,000 native renders + 10,000 resizes | 3 native renders + 1 resize |

A targeted local benchmark decoded the reusable source in 0.795 seconds and rendered the three native formats of five geographic fixtures in 1.01–1.16 seconds per journey. These are observations on this authoring host, not runner guarantees; global hemispheres, larger geometry and parallel contention can differ. At 1.1 seconds per journey, illustrative native rendering is about 2 minutes / 18 minutes / 3.1 hours for 100 / 1,000 / 10,000 journeys, plus source decode, resize, hashing and I/O. A changed journey needs only its own three renders and one resize.

External tile requests: **zero** for initial render, re-render and static card views in every scenario. Map-provider cost: **$0** in every scenario. Rendering compute is paid only if the chosen build/authoring runner bills it; total = changed journey CPU seconds × runner price, not catalog size on every release. A no-change release validates hashes and reuses all files.

CDN traffic depends on views, not only number of journeys. The current small landscape files average about 15 KB: one million actual image downloads would be about 15 GB before browser/CDN caching. Each displayed card generally fetches one responsive image, not all four. Existing Vercel plan usage/allowances and traffic are unknown, so no claim that total hosting is free is made.

For a future optional R2 Standard bucket, official rates on the research date are $0.015/GB-month, $4.50/million Class A operations, $0.36/million Class B operations, no egress fee; included monthly usage is 10 GB-month, 1 million A and 10 million B operations. Billing rounds up units. The above image storage and a single initial upload of 400/4,000/40,000 objects fit those allowances if otherwise unused. This is an illustrative alternative, not an activated service or a guarantee about future prices. Workers, domains, other metered services and tax are separate.

Source: https://developers.cloudflare.com/r2/pricing/

## Migration trigger and path

Move generated outputs out of Git around **1,000 journeys or 200 MB of generated assets**, earlier if revision history becomes expensive. Keep source code, source/license descriptors and manifests in Git; put immutable hash-named image objects in an approved object bucket/CDN. Extend the controlled asset-path policy with an explicit host allowlist, preserve checksums/rights and stage uploads before publishing the new manifest. Keep prior objects through a rollback/cache window; prune only unreferenced versions after that window. Do not store artistic masters in the application repository.

For finer maps, implement another `render(route, ratio, target)` provider. Start with a small legally reviewed regional vector/DEM archive, render offline with MapLibre, compare visual quality and actual compute/bandwidth, then broaden. PMTiles requires Range GET support and correct CORS; each range request is a billable storage read where that provider charges for reads. Public browsing of interactive maps remains a separate cost/use path from static images.
