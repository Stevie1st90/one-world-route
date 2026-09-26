# Roadmap

## Implemented Release 2 foundation
- Runtime consolidation into core/features bundles
- Automated desktop/mobile regression tests
- Curated corridor geometry framework
- Automated public-data validation and sanitizing
- Changelog
- SEO clean URLs and sitemap
- Plan vs Actual foundation
- Journal/media foundation
- Journey statistics
- Installable PWA shell
- Terrain chapter camera navigation

## Continue before departure
- The canonical country-path correction is implemented; the remaining work is operational verification, not macro-count repair.
- Use the machine-readable flagship readiness audit and generated P0/P1/P2 operations queue as the canonical departure-readiness source; clear its blockers instead of maintaining manual status counts.
- Keep the canonical topology invariant: Germany → … → Malta contains all 195 sovereign states exactly once across 194 official international legs; Malta → Germany is a separate post-trip return.
- Expand curated waypoints from Europe I across every non-flight ground/ferry corridor.
- Reverify volatile borders, visas and transport sources.
- Run the Playwright suite before each public release.
- Move basemap/DEM delivery away from community tile infrastructure before sustained large traffic.

## During the journey
- Update actual-progress from real check-ins.
- Add journal photos/field notes.
- Record plan changes instead of overwriting history.
- Compare planned vs actual days, spend and route.

## Deliberately excluded
- Accounts/comments/community
- Affiliate-booking funnels
- Private operational documents


## Multi-trip platform

Implemented foundation:
- generic trip catalog and route URLs
- localized crawlable trip URLs with canonical/hreflang and TouristTrip structured data
- reusable place / visit / segment schema
- Traveller Context without a German-default assumption
- regional standard-globe rendering
- Italy Grand Tour sourced beta with operator/government evidence
- cruise/ferry/rail/road/flight-ready transport taxonomy
- Western Mediterranean cruise demonstrator with port calls, sea days and Schengen border context
- Southern Europe Road Trip with Vehicle Context, cross-border rental/toll/LEZ source model
- Route Discovery filters for type, region, duration and search
- Vercel-free local preview server with CI smoke tests

Next product layers:
- expand the source-backed nationality/passport and residence rule engine beyond the Italy official-resolver foundation
- extend implemented route discovery with origin-market relevance, seasonality and accessibility filters
- practical trip-planning layer (implemented first on Italy): day-by-day itinerary, known transport minimum, fare/evidence coverage and Route Fit
- browser-local save, saved-only discovery, JSON/CSV/ICS export and explicit-assumption budget estimator
- My Trips workspace with route planning status, start date, planning season, Traveller Context checks and portable browser-local backup
- practical planning layer enabled across every published regional journey while unknown transport costs remain explicit
- neutral comparison of up to three journeys with Traveller Context-aware party/accessibility checks
- crawlable localized trip pages with source-derived itinerary, planning and evidence content
- sourced full-trip cost bands and seasonal variants
- connect the implemented cruise port-call / sea-day model to real operator sailings and cabin/pricing data
- route builder and collaboration only after the public read-only model is proven
