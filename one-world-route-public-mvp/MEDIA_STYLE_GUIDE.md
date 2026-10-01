# ONE WORLD ROUTE Travel Visual System v1

The product is a global journey discovery platform. **Inspiration first, planning second.** The One World Journey is a showcase among many journeys. Covers are presentation media, never evidence of operating services, prices or verified access.

## Brand DNA

Cinematic Editorial Travel Illustration: credible geography, lightly stylised, original premium editorial composition. Atmospheric directional light, restrained saturation, soft highlights, readable midtones and foreground/midground/background depth. Medium detail that survives thumbnails. Use credible natural colours and avoid neon, gaming UI, kitsch posters, stock-photo sameness, collages and documentary-photo claims.

| Family | Visual character |
| --- | --- |
| rail-cinematic | Clean graphic lines, unbranded rail element, dramatic landscape perspective |
| road-cinematic | Expansive landscape, winding road, strong horizon, golden/blue hour |
| nature-atmospheric | Authentic topography, atmosphere, minimal artificial elements |
| coastal-editorial | Luminous water, coastline shapes, spacious aerial/coastal framing |
| culture-editorial | Local architectural forms, streets and human scale without postcard collages |
| planetary | Recognisable continents, Earth curvature, topographic depth and global scale |

Families are derived from open journey kinds/themes, with an optional `visual.visualFamily` override. Region palette is shared by globe routes, region accents and journey visuals: Europe cyan, Asia violet, Africa gold, North America blue, South America emerald, Oceania turquoise, polar ice blue. Selection also uses thickness, opacity, label and a direct action; colour alone never communicates selection.

## Formats and composition

Start with a 16:9 master for cards and heroes. Support 4:5 portrait and 9:16 vertical derivatives. Keep the principal motif inside the central 55% and leave top 15%/bottom 20% quiet for overlays. Store a normalized `{x,y}` focal point between 0 and 1; inspect all crops. Use an alternate composition when one master cannot crop cleanly. No text in the generated image; HTML supplies titles, facts and controls.

Delivery uses responsive WebP assets, lazy-loaded card images and one cover per hero. Keep the source master. Aim for ≤250 KB card derivatives and ≤600 KB hero/vertical derivatives, checking quality rather than blindly compressing. No autoplay videos or new image libraries are required.

## Media lifecycle and rights

`data/platform/generated-media.json` is the small registry; `graphics-backlog.json` is the planning queue. A planned brief is not an asset. Published generated images must include assetId, type=image, mediaKind, tripId/placeId/collectionId as appropriate, sourceType=generated, generator, promptVersion, createdAt, aspectRatio, rightsStatus=approved, attributionRequired, attribution, license, focalPoint, localized alt and status=published. Preserve prompt/model provenance. Attribution identifies ONE WORLD ROUTE and the generating tool rather than pretending the image is an original travel photograph.

Generated does not automatically mean rights-cleared. Review geography, brands, recognisable people, protected characters, architecture/context and resemblance to third-party works before approval. Do not copy photos, posters, stock images or a named living artist’s style. No logos, commercial liveries, misleading service claims or invented assets. Record the applicable generation terms/usage basis in `license`; do not promise unconditional legal clearance.

Use `visual.coverAssetId` on catalog metadata or `media.heroAssetId` on a trip to reference an approved registry record. Existing inline `media.hero` remains compatible. The build resolves approved published records into the existing media manifest; pending records never replace fallbacks. Local `./assets/` paths only, with path traversal rejected. Derivatives use `{asset, focalPoint}` under landscape/portrait/vertical. The manifest preserves provenance instead of duplicating it manually.

Example record after actual generation and review:

```json
{"assetId":"journey-cover","type":"image","mediaKind":"cover","tripId":"journey-id","asset":"./assets/trips/journey-cover.webp","aspectRatio":"16:9","sourceType":"generated","generator":"record actual tool/model","promptVersion":"cinematic-editorial-v1","createdAt":"record actual creation date","rightsStatus":"approved","attributionRequired":false,"attribution":"ONE WORLD ROUTE · AI-generated illustration","license":"record applicable reviewed usage basis","focalPoint":{"x":0.5,"y":0.45},"alt":{"en":"Describe the depicted geography and illustrated nature"},"status":"published","derivatives":{"portrait":{"asset":"./assets/trips/journey-cover-4x5.webp","focalPoint":{"x":0.5,"y":0.45}},"vertical":{"asset":"./assets/trips/journey-cover-9x16.webp","focalPoint":{"x":0.5,"y":0.45}}}}
```

## Prompt structure

Original illustration + journey/concept + geographically grounded motif + family character + shared lighting/colour/depth + aspect/crop safe zones + negative constraints. Every near-final prompt is in GRAPHICS_NEEDED.md. Before generating, replace a broad itinerary brief with one coherent real landscape; never blend distant landmarks into a geographically false scene. Final approval is still necessary.

## Route Visual System

Every published journey receives an **AUTO** geographic visual; optional reusable destination media adds **DESTINATION-ENRICHED** coverage; an approved dedicated cover adds **JOURNEY-BESPOKE** coverage. These are internal availability labels, never public quality classes. There is no Premium Journey category.

Central policy: approved bespoke cover → suitable approved destination → automatic route image → existing abstract art. Single-country journeys may use their country asset. Multi-country journeys need an explicit `visualAnchor`; continental/global journeys default to route imagery unless deliberately anchored. A social context requires a genuine vertical derivative or an original 9:16 asset; it skips a landscape-only illustration. Planning prefers the route image. `platform/visual-policy.js` is shared by the browser and manifest generator.

Destination records use `destination: {type: "continent"|"region"|"country"|"place", id: "stable identity"}` in the existing registry. Country IDs are ISO codes; place IDs reuse the existing `experienceRef`, e.g. `JP:kyoto`. Region/continent IDs reuse discovery facets. No asset copies are made per journey. Optional `visualAnchor` on catalog metadata or a dataset selects one of these identities. Registry records retain rights approval, license, provenance, localized alt, focal points and native derivatives. Owned/licensed assets are also supported; generated assets continue to require generator and prompt provenance.

Scope derives from minimal circular geographic bounds, latitude span, cosine-adjusted span in kilometres, continent coverage and country membership: LOCAL <80 km, REGIONAL <450 km, then NATIONAL for one country or MULTI-COUNTRY; CONTINENTAL above 6,500 km or 60° latitude; GLOBAL above 250° longitude or four continents and >10,000 km. Thresholds describe presentation extent, not travel distance. No trip ID determines the scope. Small multi-country routes can remain regional; large one-country routes can become continental.

The v1 source is legally reusable generalized Natural Earth shaded relief. Local/regional presets retain more relief contrast; continental presets soften it. It is not a detailed local DEM. No labels clutter the image. Constant stroke widths, navy casing, light halo, the shared continent palette and sparse stop markers preserve readability. Schematic endpoint/centroid connectors are dashed and disclosed; they are not verified rail/road/service geometry.

Camera fit uses actual stops and all available intermediate geometry. A minimum circular longitude interval avoids dateline expansion; flat views unwrap that interval. Every ratio is fitted natively with overlay padding, particularly larger bottom padding for Social. Global views show complementary orthographic hemispheres so the entire route is represented without hiding the back of the planet. Clipped path runs restart at the horizon rather than drawing false connections. These are paired planetary route views, not one cropped hemisphere.

Outputs: landscape 1200 × 675 plus responsive 600 × 338, portrait 800 × 1000, vertical 900 × 1600. Route images use contain rather than arbitrary cropping in the UI. Artwork can retain focal crops. Cards are ordinary lazy images; heroes load their displayed image; Social loads its native vertical image when opened. Existing interactive Globe, Terrain and Story remain separate.

Build workflow, cache and storage are documented in ARCHITECTURE.md; provider rights, limitations, scaling costs and the PMTiles migration path are in ROUTE_VISUAL_PROVIDERS.md. No new country/AI artwork is required to publish a journey. The two experimental Japan images remain unapproved and are not installed.

## Visual roles v2 and usage matrix

A journey cover communicates how a journey feels. A route visual communicates where it runs. The latter remains the build-time baseline for every published journey; neither is evidence of current route feasibility.

| Context | Preferred role | Fallback |
| --- | --- | --- |
| Discovery / featured / journey identity | approved journey cover | suitable destination → auto route → abstract |
| Planning / route overview / share geography | auto route visual | interactive explorer → abstract; never a cinematic cover |
| Social first frame | approved native 9:16 journey cover | suitable native destination → native vertical route → abstract |
| Social route scene | native vertical route visual | existing schematic route scene |
| Place experience | approved reusable place visual | existing place presentation |
| Region discovery | deterministic continent-centered Earth portrait | restrained background; no six runtime globes |

`resolveJourneyVisual(meta, {purpose, ratio})` remains the single resolution policy. The same media manifest carries destination assets, journey covers, route imagery and region portraits. Single-country destinations still need editorial suitability; multi-country destinations require an explicit `visualAnchor`. Orientation contexts never substitute artwork. Native 9:16 assets are required before artwork can resolve in Social. Full-bleed 16:9 cards share one renderer for featured and compact variants: route images retain their complete geometry; artwork uses focal points. Cards never promise a premium tier.

### Attribution and flags

Natural Earth imagery carries voluntary provenance (`attributionRequired: false`). Discovery cards and identity slots therefore omit repetitive source captions; the Methodology disclosure and source manifests retain source/license information and the schematic-not-navigation distinction. Assets requiring visible attribution continue to display their credit. SVG flags are locally vendored from flag-icons 7.5.0 under MIT, with the full license and source hashes in `assets/flags`. One country shows its flag/name; two or three show at most three flags; larger groups add a remainder and country count; world journeys use one globe. Flags are decorative alongside a single country name, otherwise have localized country labels. No per-card third-party requests.

### Cover production and differentiation

`build-visual-briefs.mjs` deterministically creates all current journey briefs from source data. A family follows journey kind, modes and themes, with an explicit valid override. Rail / road / nature / coastal / culture / planetary scenes remain distinct even within the same country. One coherent scene only; no landmark collage. Suggested anchors use explicit metadata, existing Place Experience references or longest listed stays; inferred anchors always need manual scene review. No capital-city assumption, season or route fact is invented. Brief-ready does not mean rights-approved or generation-approved.

The graphics backlog contains optional/recommended journey covers and existing optional collection briefs. Publishing never requires three manual derivatives. 16:9 is the discovery master; separate 9:16 is recommended only by Social priority, not an automatic crop requirement. Future collection assets use the same rights-aware registry and appropriate semantic anchors; no collage engine. A cover can be registered later without a UI change. No experimental Japan artwork is approved by this release.

### Scale

The existing v1 hash outputs, geography and rendering remain untouched. Region portraits reuse that Earth renderer with a rotated source texture and one hemisphere extraction; build-time only, six small WebP assets, incremental checksums. At roughly 1,000 journeys or 200 MB of generated images, move immutable media to a controlled CDN/object store and shard discovery metadata before large catalogs. Keep source rights, review status, content hashes and rollback retention. The renderer is generalized relief, not detailed local DEM; future high-resolution providers require independent data-rights review.
