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

1. Create a new draft or clone an existing reusable public trip.
2. Edit identity/discovery metadata and the place → stop → segment graph.
3. Add source evidence and namespaced extension data.
4. Save and run the publication gate.
5. Preview using the actual production regional renderer. The local server injects the draft into the catalog only for that preview session.
6. Publish locally. The builder writes the trip into \`data/platform/trips/\` and updates \`trips.json\` only after validation succeeds.
7. Review the resulting Git diff and use the normal branch, CI, visual QA and deployment workflow.

## Safety

- Drafts live in \`one-world-route-public-mvp/data/platform/drafts/\` and are gitignored.
- Publish does not commit or deploy.
- Catalog metrics are recomputed from the trip graph.
- Publication runs the non-mutating platform quality suite: public/platform validation, model, locale, formatter, share, navigation, regional runtime, rail, story and continuity tests.
- A failed quality check rolls the catalog/trip publication back transactionally.
- Placeholder or missing trip summaries, titles, place names and required source evidence block publication.
- Duplicate segment IDs, broken graph sequences, invalid coordinates and malformed country codes block publication.
- The flagship 195/194 invariants remain under the existing platform validator.

## Production verification

The public runtime has a separate post-deploy smoke workflow in `.github/workflows/production-smoke.yml`. After every push to `main`, it waits for the Vercel commit status to report a successful production deployment and then checks the live Flagship, Cruise and Rail routes on desktop and mobile. This catches deployment-only regressions such as stale bundles, regional tooltip leakage and mobile shell drift.
