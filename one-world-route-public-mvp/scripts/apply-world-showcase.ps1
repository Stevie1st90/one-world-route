param(
    [string]$RepoRoot = "C:\Projects\one-world-route",
    [string]$Branch = "world-195-full-bleed-red-route-v2"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Native {
    param([Parameter(Mandatory=$true)][string]$FilePath,[Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$FilePath failed with exit code $LASTEXITCODE" }
}

if (-not (Test-Path -LiteralPath $RepoRoot)) { throw "Repository not found: $RepoRoot" }
$worktree = $null

try {
    Write-Host ""
    Write-Host "=== ONE WORLD ROUTE - WORLD-195 FULL-BLEED RED-ROUTE RELEASE ===" -ForegroundColor Cyan
    Write-Host "Remote branch: $Branch"

    Invoke-Native git -C $RepoRoot fetch origin
    Invoke-Native git -C $RepoRoot worktree prune

    $remoteBranch = @(& git -C $RepoRoot ls-remote --heads origin $Branch 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Could not query remote branch state." }
    if ($remoteBranch.Count -gt 0) { throw "Remote branch already exists: $Branch" }

    $originMain = [string](& git -C $RepoRoot rev-parse origin/main)
    if ($LASTEXITCODE -ne 0 -or -not $originMain) { throw "Could not resolve origin/main." }
    $originMain = $originMain.Trim()

    $worktree = Join-Path $env:TEMP ("owr-world-195-release-" + $PID)
    if (Test-Path -LiteralPath $worktree) { Remove-Item -LiteralPath $worktree -Recurse -Force }
    Invoke-Native git -C $RepoRoot worktree add --detach $worktree $originMain

    $app = Join-Path $worktree "one-world-route-public-mvp"
    Push-Location $app
    try {
        Invoke-Native npm.cmd ci

        Write-Host ""
        Write-Host "=== RENDER + PUBLISH WORLD-195 ===" -ForegroundColor Cyan
        Invoke-Native node.exe scripts/compose-world-showcase-cover.mjs --publish=true --approved=true

        Write-Host ""
        Write-Host "=== RELEASE BUILD ===" -ForegroundColor Cyan
        Invoke-Native node.exe scripts/release-build.mjs

        Write-Host ""
        Write-Host "=== TARGETED VALIDATION ===" -ForegroundColor Cyan
        Invoke-Native node.exe scripts/validate-platform-data.mjs
        Invoke-Native node.exe scripts/validate-public-data.mjs
        Invoke-Native node.exe scripts/audit-platform-media.mjs
        Invoke-Native node.exe --test scripts/test-world-showcase-visual.mjs scripts/test-world-showcase-compositor.mjs scripts/test-platform-media.mjs
    }
    finally {
        Pop-Location
    }

    $stage = @(
        "one-world-route-public-mvp/assets/media/journeys/world-195/cover/v001",
        "one-world-route-public-mvp/data/public-route.json",
        "one-world-route-public-mvp/data/platform/generated-media.json",
        "one-world-route-public-mvp/data/platform/world-showcase-visual.json",
        "one-world-route-public-mvp/data/platform/trip-index.json",
        "one-world-route-public-mvp/data/platform/visual-briefs.json",
        "one-world-route-public-mvp/data/platform/visual-coverage.json",
        "one-world-route-public-mvp/data/platform/graphics-backlog.json",
        "one-world-route-public-mvp/data/platform/media-manifest.json",
        "one-world-route-public-mvp/GRAPHICS_NEEDED.md",
        "one-world-route-public-mvp/sitemap.xml"
    )

    foreach ($p in $stage) {
        if (Test-Path -LiteralPath (Join-Path $worktree $p)) {
            Invoke-Native git -C $worktree add -- $p
        }
    }

    Invoke-Native git -C $worktree diff --cached --check
    $staged = @(& git -C $worktree diff --cached --name-only)
    if ($staged.Count -eq 0) { throw "No world showcase release changes were staged." }

    $required = @(
        "one-world-route-public-mvp/data/public-route.json",
        "one-world-route-public-mvp/data/platform/generated-media.json",
        "one-world-route-public-mvp/data/platform/world-showcase-visual.json"
    )
    foreach ($p in $required) {
        if ($staged -notcontains $p) { throw "Required release file was not staged: $p" }
    }

    $webps = @($staged | Where-Object { $_ -like "one-world-route-public-mvp/assets/media/journeys/world-195/cover/v001/*.webp" })
    if ($webps.Count -ne 4) { throw "Expected exactly four world-195 cover WebPs; staged $($webps.Count)." }

    Invoke-Native git -C $worktree commit -m "Publish full-bleed world-195 red-route cover"

    foreach ($p in @(
        "one-world-route-public-mvp/features.bundle.js",
        "one-world-route-public-mvp/features.bundle.css",
        "one-world-route-public-mvp/core.bundle.js",
        "one-world-route-public-mvp/core.bundle.css"
    )) { & git -C $worktree restore --worktree -- $p 2>$null }

    $remaining = @(& git -C $worktree status --porcelain)
    if ($remaining.Count -gt 0) { throw "Worktree is not clean after commit:`n$($remaining -join "`n")" }

    Invoke-Native git -C $worktree fetch origin
    Invoke-Native git -C $worktree rebase origin/main
    Invoke-Native git -C $worktree push origin ("HEAD:refs/heads/" + $Branch)

    $commit = [string](& git -C $worktree rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or -not $commit) { throw "Could not resolve final commit." }

    Write-Host ""
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "REMOTE_BRANCH=$Branch"
    Write-Host "COMMIT=$($commit.Trim())"
    Write-Host "JOURNEY=world-195"
    Write-Host "COVER=journey--world-195--cover--16x9--v001"
}
finally {
    if ($worktree -and (Test-Path -LiteralPath $worktree)) {
        & git -C $RepoRoot worktree remove --force $worktree 2>$null
    }
    & git -C $RepoRoot worktree prune 2>$null
}
