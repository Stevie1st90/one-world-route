# ONE WORLD ROUTE — Production Workflow Runbook

This file is the canonical operating procedure for repository-changing ONE WORLD ROUTE work.

The goal is fast, repeatable delivery without reintroducing the same Windows/Git/build errors.

## 1. Core rule: use an isolated worktree for automation

Do not use the developer's currently checked-out working tree for generated-output or release-build automation.

Preferred pattern:

1. `git fetch origin`
2. Create a temporary detached worktree from the remote feature branch.
3. Run install/build/tests inside that worktree.
4. Stage only an explicit allowlist of expected files.
5. Commit in the detached worktree.
6. Push with `git push origin HEAD:<remote-branch>`.
7. Remove the worktree.

This avoids:
- stale local branches,
- switching the user's active branch,
- untracked build artifacts blocking a run,
- previous task state leaking into the next task.

## 2. Never assume Git output paths are relative to the current subdirectory

Git path output is repository-root-relative even when the command is run inside
`one-world-route-public-mvp`.

Therefore do not validate staged paths with patterns such as:

`^assets/generated/routes/`

Use either:
- an explicit repository-root prefix: `^one-world-route-public-mvp/assets/generated/routes/`, or
- a non-anchored / suffix-based match, or
- preferably an exact allowlist built from the expected trip IDs.

For generated route visuals, validation should compare the exact expected files rather than only a global count.

## 3. Generated-file policy

### Commit

The following release outputs are part of the product and should be committed when they change:

- `assets/generated/routes/<trip-id>/*.webp`
- `data/platform/route-visuals.json`
- `data/platform/trip-index.json`
- `data/platform/visual-briefs.json`
- `data/platform/visual-coverage.json`
- `data/platform/graphics-backlog.json`
- `data/platform/media-manifest.json`
- `GRAPHICS_NEEDED.md`
- `sitemap.xml`
- built bundles only when their source changes and the release build produces a real diff

### Do not commit

- `node_modules/`
- Playwright/test artifacts
- Source PNG cover masters
- `data/platform/locale-coverage.json` (local release-build report)

`data/platform/locale-coverage.json` is ignored by `.gitignore`.

## 4. Catalog-expansion workflow

For a catalog expansion:

1. Add new Journey datasets.
2. Add catalog entries.
3. Keep new routes `editorial-preview` unless live operational evidence is complete.
4. Never invent fares, schedules, travel times or operator guarantees.
5. Use official tourism / transport sources to ground the editorial route concept.
6. Run `npm ci`.
7. Run `node scripts/release-build.mjs`.
8. Verify platform data validation.
9. Verify the world Journey still preserves 195 countries / 194 international legs.
10. Verify each new Journey has exactly four Auto Route Visual WebPs.
11. Stage only the expected generated allowlist.
12. Run `git diff --cached --check`.
13. Commit, push, open/update PR.
14. Wait for CI.
15. Merge only after required checks are green.
16. Verify Vercel and production smoke.

## 5. Journey-cover workflow

Standard production batch: up to 10 Journeys.

### Dispatch contract

The operator sends **one batch instruction**, but the image system must execute **one independent image-generation call per Journey**.

For a 10-Journey batch the only valid topology is:

- 1 operator prompt,
- 10 unique queue items,
- 10 separate image-generation tool calls,
- exactly 1 image per tool call,
- fixed queue order,
- no approval pause between calls,
- stop after call 10.

Never implement a multi-Journey batch as one image call with `n=10`. A multi-image call shares one effective prompt and can produce ten variants of the first Journey (the observed “10× Alaska” failure mode).

The queue builder encodes this contract in `dispatchContract` and emits a single operator prompt that explicitly requires separate `n=1` calls.

### Generate the batch

Run:

```powershell
npm run covers:batch
```

This produces local, ignored artifacts:

- `data/platform/cover-generation-queue.json`
- `data/platform/cover-generation-operator-prompt.md`

The prompt is designed to be pasted once into the image-generation chat. The image orchestrator must then advance through the numbered queue without asking the operator for ten separate messages.

Each queue item contains:

- one sequence number,
- one `callId`,
- one unique `tripId`,
- one exact source filename,
- one concise production prompt,
- `imagesPerToolCall: 1`.

Queue construction fails on duplicate `tripId`, `callId` or source filename.

Already published approved bespoke covers are excluded from future queues.

`world-195` is excluded from ordinary cover batches and uses the separate hybrid strategy: cinematic Earth base + factual route geometry rendered from platform data.

### Stage downloaded results

Image-chat downloads may arrive with generic names such as `...-1.png` through `...-10.png`. Do not rename ten files manually.

Stage them with:

```powershell
npm run covers:stage -- --spec="data/platform/cover-generation-queue.json" --source-dir="<download-folder>"
```

The staging script:

- requires exactly the expected number of images,
- natural-sorts numbered filenames so `-10` does not sort before `-9`,
- maps them to the locked queue order,
- rejects exact duplicate files,
- verifies readable dimensions,
- verifies approximately 16:9,
- requires at least 1200 px source width,
- writes canonical source-master filenames,
- writes a machine-readable staging report.

Semantic correctness is deliberately **not** auto-approved. A technically valid image can still depict the wrong Journey.

### Shared visual QA

Run one shared review after the entire batch, not ten individual approval loops.

Review every cover for:

- correct Journey identity,
- geographic plausibility,
- travel-mode plausibility,
- no text/logos/brand livery,
- no invented route/map overlay,
- crop safety,
- obvious image-generation artifacts,
- differentiation from adjacent covers,
- consistency with the product family.

Use only:

- `ACCEPT`
- `REGENERATE`
- `REJECT`

Regenerate only outliers. Never regenerate accepted covers merely to create extra variants.

### Ingest + release

After every accepted item has explicit `reviewStatus=approved`, use the one-command release runner from a clean isolated worktree:

```powershell
npm run covers:release -- --spec="<approved-batch.json>" --source-dir="<approved-master-folder>"
```

The runner performs the repetitive production steps in one deterministic pass:

1. refuses a dirty worktree by default,
2. verifies 1-10 unique approved Journey items and source masters,
3. runs `npm ci` unless explicitly skipped,
4. ingests the approved masters,
5. creates responsive WebPs,
6. updates the generated-media registry and each Journey `heroAssetId`,
7. runs the release build,
8. validates platform data,
9. audits media rights/contracts,
10. runs the media unit tests,
11. runs `git diff --check`,
12. rejects unexpected changed paths and prints the exact release allowlist.

Source PNG masters remain outside the delivery repository. Only approved delivery WebPs, Journey/media metadata and deterministic release outputs are staged and committed.

Do not rebuild this command sequence manually for every batch. If a recurring release failure is discovered, fix `release-cover-batch.mjs` and this runbook so the next batch inherits the correction.

### Windows apply runner

For Windows production operation, do not create one-off helper scripts for each batch. Use the repository-owned runner:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\one-world-route-public-mvp\scripts\apply-cover-batch.ps1" -BundleZip "<approved-cover-batch.zip>"
```

The runner extracts the approved bundle, validates 1-10 approved unique Journeys, creates an isolated **detached** worktree from current `origin/main`, calls the Node release runner directly (not through npm argument forwarding), stages the explicit cover-release allowlist, commits, rebases and pushes `HEAD:<remote-batch-branch>`. It never creates or deletes a local branch with the remote batch name, so stale local retry branches cannot block a new run.

The release allowlist is tested against real Git porcelain output. Use `--untracked-files=all` so Git reports individual WebP files rather than collapsing a newly-created Journey directory. Paths are normalized whether Git reports them relative to the application directory or repository root.

### Scaling rule

The workflow must scale by **batches**, not by operator messages.

For 1,000 Journeys the target is roughly 100 unattended 10-Journey dispatches, not 1,000 manually written prompts. The current chat-based orchestration is the compatibility layer; a future provider/API worker can consume the same queue contract without changing Journey data, filenames, QA states or ingestion.

## 6. Stable naming

Journey cover master:

`source--journey--<trip-id>--cover--16x9--v001.png`

Delivery:

`journey--<trip-id>--cover--16x9--v001--w<width>.webp`

Auto Route Visuals remain build-generated and are keyed by Journey ID plus content hash.

## 7. PowerShell / Windows rules

- Use `$ErrorActionPreference = "Stop"`.
- Check native process exit codes.
- Prefer `git -C <repo-root> ...` when path interpretation matters.
- Do not delete/restore files merely to make a dirty tree look clean unless the file is explicitly classified as disposable.
- Do not reset a user's working tree if unrelated changes exist.
- Known disposable generated reports should be ignored by Git rather than repeatedly removed in runners.

## 8. Validation strategy

Optimize for speed + correctness.

The PR fast gate is intentionally bounded. Browser E2E must validate shared renderers and representative interaction paths; it must not grow linearly with the Journey catalog.

Use focused checks first:
- data validator across the full catalog,
- media validator when media changes,
- generated-asset exact-file verification,
- targeted browser smoke based on changed scope.

PR browser rules:
- Discovery asserts every catalog Journey ID in the rendered DOM, then opens one representative shared renderer per viewport.
- Changed-Journey browser smoke validates every changed ID at contract level and opens at most three representative Journeys, preferring rail, road/car and ferry when present.
- Content-only Journey changes run the browser sample on desktop; responsive/mobile coverage belongs to UI/component changes.
- Generated route/media registries do not imply Builder, Flagship or Regional browser scope.
- Media renderer/cover-slot changes additionally run the focused media-slot browser fixture.
- Target budget: Discovery PR smoke <= 60 s; Content Journey browser smoke <= 90 s; overall PR wall clock <= 2-3 minutes where runner availability permits.

Broad `@discovery` browser coverage remains available through the scheduled/manual confidence run. The standalone `Production smoke` workflow is the single post-merge live-deployment gate. The broader Production browser confidence suite runs only on scheduled/manual validation so main pushes do not execute two overlapping live-browser suites.

Do not repeatedly run large test suites when the failure is clearly isolated to one deterministic contract. Do not remove important assertions merely to meet a timing target; move exhaustive validation to the cheapest correct abstraction layer instead.

## 9. Post-build cleanup before fetch/rebase

A release build may rewrite deterministic tracked outputs such as the four runtime bundles even when those files are intentionally outside the current task's staged allowlist.

Therefore the required order is:

1. start from a verified clean worktree,
2. run the build,
3. stage the explicit task allowlist,
4. verify and commit the intended staged outputs,
5. inspect remaining unstaged changes,
6. if the run started clean and the remaining changes are build-only drift outside the task allowlist, restore those unstaged tracked changes,
7. only then fetch/rebase/push.

Never run `git rebase` with a dirty worktree.

For Windows runner flows, the safe pattern after the intended commit is:

```powershell
$remaining = @(git status --porcelain)
if ($remaining.Count -gt 0) {
    # Only after the runner has proved that it started from a clean tree
    # and that these are build-only unstaged changes.
    git restore --worktree -- .
}
git fetch origin
git rebase origin/<feature-branch>
```

Do not use this cleanup pattern when unrelated user changes were present before the build.

## 9. Failure recovery

When a runner fails:

1. Determine exactly which phase completed.
2. Do not repeat expensive completed work.
3. Build a resume step from the last verified state.
4. Verify the current branch and staged/untracked files before changing anything.
5. Preserve generated assets that already passed validation.
6. Fix the root cause in repository scripts/docs when the failure pattern can recur.

### Windows line-ending recovery

If a tracked bundle remains dirty after `git restore --worktree -- .` and Git reports a CRLF/LF warning, do not keep trying to normalize the user's active worktree during the release.

Use a temporary isolated worktree from the current remote feature branch and cherry-pick the already-created task commit into that worktree. Then push from the temporary worktree.

This is the preferred recovery for completed commits blocked only by local line-ending drift.

## 10. Definition of done

A product block is done only when:

- source/data changes are committed,
- required generated outputs are committed,
- targeted validation is green,
- PR CI is green,
- PR is merged,
- Vercel reports success,
- production smoke is green when applicable,
- no task-specific temporary workflow or helper remains in the repository,
- the active runbook is updated if a new recurring failure mode was discovered.

This runbook takes precedence over one-off handoff scripts when they conflict.
