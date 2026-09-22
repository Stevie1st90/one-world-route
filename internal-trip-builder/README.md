# ONE WORLD ROUTE · Internal Trip Builder

Local authoring environment for reusable trips. This directory intentionally lives **outside** the Vercel Root Directory (`one-world-route-public-mvp`) and is therefore not part of the public site deployment.

## Start on Windows

From the repository root:

```powershell
.\internal-trip-builder\Start-TripBuilder.ps1
```

Default URL:

```text
http://127.0.0.1:4180/
```

A different port can be supplied without editing files:

```powershell
.\internal-trip-builder\Start-TripBuilder.ps1 -Port 4190
```

Direct Node start is also supported:

```powershell
node .\internal-trip-builder\server.mjs
```

## Workflow

1. Create a draft with a normalized slug and open trip kind.
2. Edit localized content, Places, Stops, Segments, Discovery/Route Fit and Sources.
3. Use **Reconcile adjacency** after changing Stops.
4. Run **Validate** while authoring.
5. Use **Preview** to load the draft through the real public regional engine.
6. Change the draft status from `draft` to a publishable status such as `sourced-beta`, `illustrative-template` or `planned`.
7. Resolve all blocking validation errors and placeholder text.
8. Choose **Publish to working tree** and type the exact slug.

Publication writes:

- `one-world-route-public-mvp/data/platform/trips/<slug>.json`
- the matching catalog entry in `one-world-route-public-mvp/data/platform/trips.json`

It then runs the existing full platform validator. A failed platform validation automatically rolls back both writes.

**Publishing does not commit, merge or deploy.** Those remain separate reviewable Git/Vercel steps.

## Draft storage

Draft JSON files live in `internal-trip-builder/drafts/` and are ignored by Git by default. This keeps unfinished editorial work out of commits while allowing the builder to persist local work.

## Preview architecture

A preview URL such as `/preview/alpine-rail-loop/?trip=alpine-rail-loop&lang=en` serves the actual files from `one-world-route-public-mvp`.

Only two resources are overlaid for the selected draft:

- `data/platform/trips.json`
- `data/platform/trips/<slug>.json`

This means the draft is rendered by the same regional globe, timeline, detail panels, Story, Terrain, Settings and extension registry as a published trip.

## Safety guarantees

- Builder is outside the Vercel root.
- Development branch is explicitly disabled in `vercel.json`.
- Slugs cannot be changed in-place through the save API.
- Drafts cannot shadow an existing public trip.
- Verified segments require valid source references and verification dates.
- Existing extension validators are reused by the builder.
- Publish is transactional and rolls back if the full platform validator fails.
- No Git commit or Vercel deployment is performed by the builder.

## Tests

From the repository root:

```powershell
node --test .\internal-trip-builder\test-draft-core.mjs .\internal-trip-builder\test-server.mjs
```

The same tests run in GitHub Actions.
