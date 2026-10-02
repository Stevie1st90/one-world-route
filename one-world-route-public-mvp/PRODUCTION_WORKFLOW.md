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

Standard generation batch: up to 10 Journeys.

A batch means up to 10 isolated single-image generations followed by one shared review.

Never ask the image model to produce multiple Journeys in one collage.

For each Journey:

- one `tripId`
- one exact source filename
- one prompt
- one independent image generation
- no previous screenshot/image as reference unless explicitly intended

Already published bespoke covers are excluded from future generation queues.

`world-195` is excluded from ordinary cover batches and uses the separate hybrid strategy:
cinematic Earth base + factual route geometry rendered from platform data.

After review:

1. accept/reject the batch once,
2. regenerate only outliers,
3. preserve PNG masters outside the delivery repo,
4. ingest accepted masters,
5. create responsive WebPs,
6. update registry and `heroAssetId`,
7. run release build and media tests,
8. commit only delivery assets/metadata.

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

Use focused checks first:
- data validator,
- media validator when media changes,
- generated-asset exact-file verification,
- targeted browser smoke based on changed scope.

Then rely on repository CI for broader validation.

Do not repeatedly run large test suites when the failure is clearly isolated to one deterministic contract.

For changed-Journey browser tests, the total test timeout must scale with the number of changed Journeys; do not weaken individual assertions merely to avoid timeout failures.

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
