# ONE WORLD ROUTE — Internal Trip Builder

Local-only authoring environment for reusable regional trips.

## Start

From the repository root:

\`\`\`bash
npm run builder
\`\`\`

Direct Node fallback:

\`\`\`bash
node internal-trip-builder/server.mjs
\`\`\`

Open:

\`\`\`
http://127.0.0.1:4175/__builder/
\`\`\`

The server binds only to \`127.0.0.1\`. It is intentionally outside the Vercel Root Directory and is not part of the public website.

## Workflow

0. Open **Experience coverage** for destination-content coverage and **Maintenance queue** for source/review work across all journeys.
1. Create a new draft from a journey archetype (rail, road trip, camper, cruise, island hopping, round trip or multimodal) or clone an existing reusable public trip.
2. Build the route quickly with **Route skeleton** (`Place | CC | latitude | longitude | nights`) or edit the place → stop → segment graph directly.
3. Add source evidence with **Evidence source** by explicitly selecting the affected segment numbers and verification status; use raw JSON only for advanced cases.
4. Complete title, discovery subtitle and journey summary for every supported language in **Localization workspace**.
5. Add namespaced extension data where the journey type requires it.
6. Save and run the publication gate.
7. Preview using the actual production regional renderer. The local server injects the draft into the catalog only for that preview session.
8. Publish locally. The builder writes the trip into \`data/platform/trips/\` and updates \`trips.json\` only after validation succeeds.
9. Review the resulting Git diff and use the normal branch, CI, visual QA and deployment workflow.

## Safety

- Drafts live in \`one-world-route-public-mvp/data/platform/drafts/\` and are gitignored.
- Publish does not commit or deploy.
- Catalog metrics are recomputed from the trip graph.
- Route skeleton generates only draft segments and never invents sources or verification.
- Evidence source requires an explicit source, affected segment selection and verification status; it never auto-verifies a route.
- New drafts start globally neutral; once route countries exist, primary/subregional discovery regions are derived from the existing country metadata. Explicit curated regions remain untouched.
- Archetypes provide generic route-policy, maintenance cadence, capabilities, discovery mode and visual-theme defaults without trip-specific runtime code.
- Publication runs the non-mutating platform quality suite, including draft contracts and maintenance queue tests, before public files are kept.
- A failed quality check rolls the catalog/trip publication back transactionally.
- Placeholder or missing trip summaries, titles, place names and required source evidence block publication.
- Duplicate segment IDs, broken graph sequences, invalid coordinates and malformed country codes block publication.
- The flagship 195/194 invariants remain under the existing platform validator.
- Experience coverage is calculated live from published journeys and reusable place profiles; it is advisory and never blocks a valid new route.
- Maintenance queue deduplicates identical source URLs across journeys and exposes expiry/review state, reuse count and the next review date. The weekly workflow uploads the JSON queue and refreshes a single maintenance issue.

## Production verification

The public runtime has a separate post-deploy smoke workflow in `.github/workflows/production-smoke.yml`. After every push to `main`, it waits for the Vercel commit status to report a successful production deployment and then checks the live Flagship, Cruise and Rail routes on desktop and mobile. This catches deployment-only regressions such as stale bundles, regional tooltip leakage and mobile shell drift.
