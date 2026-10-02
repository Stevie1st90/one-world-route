param(
    [Parameter(Mandatory=$true)][string]$BundleZip,
    [string]$RepoRoot = "C:\Projects\one-world-route",
    [string]$Branch = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Native {
    param([Parameter(Mandatory=$true)][string]$FilePath,[Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$FilePath failed with exit code $LASTEXITCODE" }
}

if (-not (Test-Path -LiteralPath $RepoRoot)) { throw "Repository not found: $RepoRoot" }
$BundleZip = (Resolve-Path -LiteralPath $BundleZip).Path
$extractRoot = Join-Path $env:TEMP ("owr-cover-bundle-" + [guid]::NewGuid().ToString("N"))
$worktree = $null
$createdBranch = $false

try {
    New-Item -ItemType Directory -Path $extractRoot | Out-Null
    Expand-Archive -LiteralPath $BundleZip -DestinationPath $extractRoot -Force

    $specs = @(Get-ChildItem -LiteralPath $extractRoot -Recurse -File -Filter "cover-batch-*-approved.json")
    if ($specs.Count -ne 1) { throw "Expected exactly one approved batch spec, found $($specs.Count)." }
    $specPath = $specs[0].FullName
    $batch = Get-Content -LiteralPath $specPath -Raw | ConvertFrom-Json
    $items = @($batch.items)
    if ($items.Count -lt 1 -or $items.Count -gt 10) { throw "Approved batch must contain 1-10 items." }
    $tripIds = @($items | ForEach-Object { [string]$_.tripId })
    if (($tripIds | Sort-Object -Unique).Count -ne $tripIds.Count) { throw "Duplicate tripId in approved batch." }
    if (@($items | Where-Object { $_.reviewStatus -ne "approved" }).Count -gt 0) { throw "Every item must be approved." }

    if (-not $Branch) { $Branch = ([string]$batch.batchId) + "-ingest-v1" }
    $masters = Join-Path $extractRoot "_masters"
    New-Item -ItemType Directory -Path $masters | Out-Null
    foreach ($item in $items) {
        $name = [string]$item.sourceFilename
        $matches = @(Get-ChildItem -LiteralPath $extractRoot -Recurse -File | Where-Object { $_.Name -eq $name -and $_.DirectoryName -ne $masters })
        if ($matches.Count -ne 1) { throw "$($item.tripId): expected exactly one source master named $name; found $($matches.Count)." }
        Copy-Item -LiteralPath $matches[0].FullName -Destination (Join-Path $masters $name)
    }

    Write-Host ""
    Write-Host "=== ONE WORLD ROUTE · APPROVED COVER BATCH ===" -ForegroundColor Cyan
    Write-Host "Batch: $($batch.batchId) · Journeys: $($items.Count) · Branch: $Branch"

    Invoke-Native git -C $RepoRoot fetch origin
    Invoke-Native git -C $RepoRoot worktree prune

    $remoteBranch = @(& git -C $RepoRoot ls-remote --heads origin $Branch 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Could not query remote branch state." }
    if ($remoteBranch.Count -gt 0) { throw "Remote branch already exists: $Branch" }

    $localBranch = @(& git -C $RepoRoot branch --list $Branch 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Could not query local branch state." }
    if ($localBranch.Count -gt 0) {
        $active = [string](& git -C $RepoRoot branch --show-current)
        if ($LASTEXITCODE -ne 0) { throw "Could not determine active branch." }
        if ($active.Trim() -eq $Branch) { throw "Retry branch is active in the developer worktree: $Branch" }
        Write-Host "Removing stale local retry branch: $Branch" -ForegroundColor Yellow
        Invoke-Native git -C $RepoRoot branch -D $Branch
    }

    $originMain = [string](& git -C $RepoRoot rev-parse origin/main)
    if ($LASTEXITCODE -ne 0 -or -not $originMain) { throw "Could not resolve origin/main." }
    $originMain = $originMain.Trim()
    $worktree = Join-Path $env:TEMP ("owr-" + [string]$batch.batchId + "-" + $PID)
    if (Test-Path -LiteralPath $worktree) { Remove-Item -LiteralPath $worktree -Recurse -Force }
    Invoke-Native git -C $RepoRoot worktree add -b $Branch $worktree $originMain
    $createdBranch = $true

    $app = Join-Path $worktree "one-world-route-public-mvp"
    Push-Location $app
    try {
        Invoke-Native npm.cmd ci
        Invoke-Native node.exe scripts/release-cover-batch.mjs "--spec=$specPath" "--source-dir=$masters" "--skip-install=true"
    } finally { Pop-Location }

    $stage = New-Object System.Collections.Generic.List[string]
    $stage.Add("one-world-route-public-mvp/data/platform/generated-media.json")
    foreach ($id in $tripIds) {
        $stage.Add("one-world-route-public-mvp/data/platform/trips/$id.json")
        $stage.Add("one-world-route-public-mvp/assets/media/journeys/$id/cover/v001")
    }
    foreach ($p in @(
        "one-world-route-public-mvp/data/platform/trip-index.json",
        "one-world-route-public-mvp/data/platform/visual-briefs.json",
        "one-world-route-public-mvp/data/platform/visual-coverage.json",
        "one-world-route-public-mvp/data/platform/graphics-backlog.json",
        "one-world-route-public-mvp/data/platform/media-manifest.json",
        "one-world-route-public-mvp/GRAPHICS_NEEDED.md",
        "one-world-route-public-mvp/sitemap.xml"
    )) { if (Test-Path -LiteralPath (Join-Path $worktree $p)) { $stage.Add($p) } }

    foreach ($p in ($stage | Sort-Object -Unique)) { Invoke-Native git -C $worktree add -- $p }
    Invoke-Native git -C $worktree diff --cached --check
    $staged = @(& git -C $worktree diff --cached --name-only)
    if ($staged.Count -eq 0) { throw "No cover release changes were staged." }
    Invoke-Native git -C $worktree commit -m ("Ingest approved Journey cover batch " + [string]$batch.batchId)

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
    Invoke-Native git -C $worktree push -u origin ("HEAD:" + $Branch)
    $commit = [string](& git -C $worktree rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or -not $commit) { throw "Could not resolve final commit." }
    Write-Host ""
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "REMOTE_BRANCH=$Branch"
    Write-Host "COMMIT=$($commit.Trim())"
    Write-Host "JOURNEYS=$($items.Count)"
}
finally {
    if ($worktree -and (Test-Path -LiteralPath $worktree)) { & git -C $RepoRoot worktree remove --force $worktree 2>$null }
    & git -C $RepoRoot worktree prune 2>$null
    if ($createdBranch) {
        $remoteNow = @(& git -C $RepoRoot ls-remote --heads origin $Branch 2>$null)
        $localNow = @(& git -C $RepoRoot branch --list $Branch 2>$null)
        if ($localNow.Count -gt 0) {
            $activeNow = [string](& git -C $RepoRoot branch --show-current 2>$null)
            if ($activeNow.Trim() -ne $Branch) { & git -C $RepoRoot branch -D $Branch 2>$null }
        }
    }
    if (Test-Path -LiteralPath $extractRoot) { Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
