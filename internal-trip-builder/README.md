# ONE WORLD ROUTE — Internal Trip Builder

This tool is intentionally located **outside** the Vercel project root (`one-world-route-public-mvp`).
It is for local/internal route authoring and is not part of the public deployment.

## Start

### Windows / PowerShell

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\internal-trip-builder\start-builder.ps1
```

### Cross-platform

```bash
cd internal-trip-builder
npm start
```

No package install is required; the runtime uses Node.js built-ins only.

Open:

```
http://127.0.0.1:4177/builder/
```

## Workflow

1. Create a draft.
2. Edit the real platform model: place → stop/visit → segment.
3. Add source evidence and discovery metadata.
4. Use **Preview in real engine**. The local server injects the draft into an isolated catalog response and serves the existing public app under `/preview/<slug>/`. The preview therefore uses the same Regional Engine, Story, Terrain, Settings and extension runtime as the public product.
5. Run **Publish gate**. The candidate is copied into a temporary sandbox and checked with the real platform validator plus model, navigation and locale tests.
6. Only after a green gate can **Publish to catalog** write the trip dataset and catalog entry into the local `one-world-route-public-mvp/data/platform` tree.
7. Review the generated git diff, run normal repository QA and commit through the usual development branch workflow.

## Safety properties

- No browser-side direct file-system writes.
- Draft workspace is excluded from git.
- Preview does not mutate the public catalog.
- Publish gate does not mutate the public catalog.
- Publishing does not commit or deploy automatically.
- Existing public trip IDs/slugs cannot be overwritten.
- Catalog metrics are derived from the trip dataset rather than trusted from manual input.
- New trips remain on the shared `regional-globe` renderer.

## Draft workspace

Drafts are written to:

```
internal-trip-builder/workspace/<slug>/
  trip.json
  catalog.json
```

The workspace is local-only and ignored by git.
