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
