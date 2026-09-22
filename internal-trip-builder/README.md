# ONE WORLD ROUTE · Internal Trip Builder

Local-only authoring workspace for reusable regional trips.

## Start

From the repository root:

```bash
node internal-trip-builder/server.mjs
```

Open:

```
http://127.0.0.1:4317/
```

The server binds to loopback by default. It is intentionally outside the Vercel Root Directory (`one-world-route-public-mvp`) and must not be exposed as a public authoring surface.

## Workflow

1. Create a draft with a normalized slug and open trip kind.
2. Fill localized catalog/trip copy.
3. Add places.
4. Add ordered stops/visits.
5. Build or edit one segment between every adjacent stop.
6. Attach source evidence.
7. Save and use **Live preview**. The preview runs the actual public Regional Engine; the builder only injects the draft catalog/dataset responses.
8. Run **Validate**.
9. **Publish** is enabled only after the draft gate is green.
10. Publish writes the trip into `one-world-route-public-mvp/data/platform/trips/` and updates `data/platform/trips.json`.
11. The server then runs the authoritative platform validator plus model, navigation and regional-runtime tests. A failure rolls the public data files back.

Drafts remain in `internal-trip-builder/drafts/` and are git-ignored.

## Design constraints

- No trip-ID branches in the public renderer.
- `kind` remains an open slug.
- Specialized data belongs in namespaced `extensions`.
- Unknown/volatile schedules and fares stay unknown or `current-check-required`.
- Verified segments require valid source references.
- The flagship 195/194 invariants are never edited by the builder.
