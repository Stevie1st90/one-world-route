# ONE WORLD ROUTE — Production Workflow Runbook

This file is the canonical operating procedure for repository-changing ONE WORLD ROUTE work.

The goal is fast, repeatable delivery without reintroducing the same Windows/Git/build/image-pipeline failures.

## 1. Core rule: isolated worktrees

Do not run generated-output or release automation in the developer's active working tree.

Preferred pattern:

1. `git fetch origin`
2. create a temporary detached worktree from the intended remote ref,
3. run install/build/tests inside that worktree,
4. stage only an explicit task allowlist,
5. commit,
6. push with `git push origin HEAD:refs/heads/<remote-branch>`,
7. remove/prune the worktree.

Never reset unrelated user changes to make a task appear clean.

## 2. Git path rule

Git porcelain paths are repository-root-relative even when commands run inside `one-world-route-public-mvp`.

Prefer exact expected-file allowlists. Do not rely on brittle subdirectory-relative regexes.

For Windows scripts, treat empty Git command output as an empty array/string; never call `.Trim()` on a possible `$null` value. Use `--untracked-files=all` when individual generated files matter.

## 3. Generated-file policy

Commit deterministic product outputs when they change, including:

- `assets/generated/routes/<trip-id>/*.webp`
- `assets/media/journeys/<trip-id>/...`
- `data/platform/route-visuals.json`
- `data/platform/trip-index.json`
- `data/platform/visual-briefs.json`
- `data/platform/visual-coverage.json`
- `data/platform/graphics-backlog.json`
- `data/platform/generated-media.json`
- `data/platform/media-manifest.json`
- `data/platform/world-showcase-visual.json`
- `GRAPHICS_NEEDED.md`
- `sitemap.xml`
- generated bundles only when their source/build creates a real diff.

Do not commit:

- `node_modules/`
- Playwright artifacts
- local source PNG cover masters
- local preview folders
- `data/platform/locale-coverage.json`.

## 4. Catalog expansion

For catalog growth:

1. add Journey dataset(s),
2. add catalog entries,
3. keep new routes `editorial-preview` until operational evidence is complete,
4. never invent fares, schedules, journey times or guarantees,
5. ground editorial concepts in suitable official tourism/transport sources,
6. run `npm ci`,
7. run `node scripts/release-build.mjs`,
8. verify platform/public-data validation,
9. verify `world-195` remains **195 countries / 194 international legs**,
10. verify every Journey has its required route assets,
11. stage only expected files,
12. run `git diff --cached --check`,
13. commit/push/PR,
14. merge only after targeted CI is green,
15. verify Vercel + production smoke when a deploy is available.

## 5. Journey covers — normal batches

Normal production batches contain **up to 10 Journeys**.

### Dispatch contract

The operator sends **one batch instruction**, but the image system executes **one independent image-generation call per Journey**.

For a 10-Journey batch:

- one operator prompt,
- ten unique queue items,
- ten separate image-generation calls,
- exactly one image per call,
- fixed queue order,
- no approval pause between calls,
- stop after call 10.

Never use one call with `n=10` for different Journeys. That failure mode produced multiple variants of the first Journey (the observed “10× Alaska” problem).

Generate the queue with:

```powershell
npm run covers:batch
```

The queue/prompt artifacts are local operator artifacts. Each item locks sequence, `callId`, `tripId`, filename and prompt. Duplicate trip IDs/call IDs/filenames are rejected.

Already-published approved covers are excluded from later queues.

### Stage downloaded results

```powershell
npm run covers:stage -- --spec="data/platform/cover-generation-queue.json" --source-dir="<download-folder>"
```

The stage step verifies count, deterministic order, duplicates, readable dimensions, approximately 16:9 and minimum source width, then applies canonical filenames.

### Shared visual QA

Review the complete batch once. Use only:

- `ACCEPT`
- `REGENERATE`
- `REJECT`

Check Journey identity, geography, travel-mode plausibility, unwanted text/logos, invented route overlays, crop safety, artifacts and differentiation. Regenerate only outliers.

### Release approved batch

```powershell
npm run covers:release -- --spec="<approved-batch.json>" --source-dir="<approved-master-folder>"
```

The repository runner validates approval state, ingests masters, creates responsive WebPs, updates registries/hero IDs, runs release build + media audits/tests, performs diff checks and enforces the explicit allowlist.

Source masters remain outside the delivery repository.

### Windows apply runner

Do not create a new helper script for every batch. Use the repository-owned Windows runner:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\one-world-route-public-mvp\scripts\apply-cover-batch.ps1" -BundleZip "<approved-cover-batch.zip>"
```

The runner uses a detached temporary worktree and pushes `HEAD:refs/heads/<remote-batch-branch>`. It does not depend on a local branch with that name.

If a recurring failure occurs, fix the repository runner/tests/runbook instead of patching the next batch manually.

## 6. `world-195` cover — deterministic full-bleed special path

`world-195` is intentionally excluded from normal 10-Journey image batches.

### Final visual contract

The canonical `world-195` hero is:

- **one full-bleed flat world map**,
- no star field,
- no AI-generated background,
- no globe pair,
- no capsule/card/frame,
- approved Natural Earth relief as the basemap,
- verified ONE WORLD ROUTE geometry as the route layer,
- **195 countries / 194 international legs** unchanged,
- thin restrained continent-family route colors,
- no intermediate white nodes,
- Antarctica visually de-emphasized,
- Europe/West-Asia dense routes slightly reduced in opacity,
- antimeridian crossings split instead of drawing false long lines across the map.

The renderer contract is machine-readable in:

- `data/platform/world-showcase-visual.json`
- `scripts/world-showcase-renderer.mjs`
- `scripts/test-world-showcase-visual.mjs`
- `scripts/test-world-showcase-compositor.mjs`.

Current canonical renderer identifiers:

- render style: `premium-full-bleed-world-v1`
- projection: `equirectangular-full-bleed`
- production strategy: `deterministic-full-bleed-world-route`.

There is **no image-generation prompt** and no source-space-image dependency.

### Build/check spec

```powershell
npm run world:visual:spec
npm run world:visual:check
```

### Preview

No `--base` argument is required:

```powershell
npm run world:visual:preview -- --out-dir="<preview-folder>"
```

Preview must produce responsive 480/800/1200/1600 WebPs plus `world-showcase-preview.json` containing:

- `renderStyle= premium-full-bleed-world-v1`
- `projection= equirectangular-full-bleed`
- `fullBleed=true`
- `spaceBackground=false`
- `countries=195`
- `internationalLegs=194`.

Perform one visual QA on the 1600px output. Because all geography/route geometry is deterministic, QA is about readability and presentation, not geographic invention.

### Publish

After visual approval:

```powershell
npm run world:visual:publish -- --approved=true
```

Publishing:

1. creates the four delivery WebPs,
2. registers `journey--world-195--cover--16x9--v001`,
3. records Natural Earth + route provenance,
4. updates `data/public-route.json#media.heroAssetId`,
5. leaves the verified route data unchanged.

Then run the normal release build/validation and commit all deterministic generated outputs.

Do not reintroduce a free-form AI background into this workflow.

## 7. Stable naming

Normal Journey cover master:

`source--journey--<trip-id>--cover--16x9--v001.png`

Delivery:

`journey--<trip-id>--cover--16x9--v001--w<width>.webp`

`world-195` has no separate image master; its delivery variants are deterministically rendered from project data + Natural Earth.

## 8. Scaling rule

Scale by batches and deterministic generators, not operator messages.

For 1,000 Journeys, the target is roughly 100 unattended 10-Journey dispatches plus deterministic special renderers where appropriate—not 1,000 manually written prompts.

The queue contract is provider-independent so a future image API/worker can consume the same queue without changing Journey IDs, filenames, QA states or ingestion.

## 9. Windows / PowerShell rules

- `$ErrorActionPreference = "Stop"`
- always check native exit codes,
- prefer `git -C <repo-root>` where path interpretation matters,
- never assume a variable from an earlier PowerShell session exists,
- never continue after a thrown precondition and then print misleading “success” messages,
- do not reset unrelated user changes,
- isolate generated work in a temporary worktree.

## 10. Validation strategy

Optimize for speed **and** correctness.

Use the cheapest correct validation layer first:

- full-catalog data validator,
- media validator for media changes,
- deterministic unit/contract tests for generators,
- exact generated-file checks,
- browser smoke only when shared UI/runtime behavior changed.

Browser E2E must not grow linearly with catalog size.

Target PR behavior:

- Discovery verifies all IDs at contract/DOM level and only representative shared renderers,
- changed-Journey browser smoke opens at most representative modes,
- content-only changes prefer desktop browser sampling,
- generated editorial reports should not imply unrelated Builder/Regional suites,
- scheduled/manual confidence runs retain broad browser coverage,
- standalone Production smoke is the primary post-merge live gate.

When a failure is isolated to a deterministic contract, fix/test that contract instead of repeatedly running large suites.

## 11. Build cleanup before rebase

If a clean release worktree produces unrelated deterministic build drift outside the task allowlist:

1. stage/commit intended files,
2. inspect remaining changes,
3. restore only proven build-only drift,
4. fetch/rebase/push.

Never rebase a dirty worktree.

## 12. Failure recovery

When a runner fails:

1. identify the exact completed phase,
2. preserve already-generated valid assets,
3. resume from the last verified state,
4. inspect branch/staged/untracked state before modifying anything,
5. fix recurring root causes in repository scripts/tests/docs.

For Windows CRLF/LF drift, prefer a clean temporary worktree/cherry-pick of the already-created task commit rather than repeatedly normalizing the active tree.

## 13. Definition of done

A product block is done only when:

- source/data changes are committed,
- required deterministic outputs are committed,
- targeted validation is green,
- PR CI is green,
- PR is merged,
- Vercel is successful when deployment capacity is available,
- production smoke is green when applicable,
- temporary helpers/workflows are removed,
- the canonical runbook is updated for any new recurring failure mode.

This runbook takes precedence over one-off handoff scripts when they conflict.
