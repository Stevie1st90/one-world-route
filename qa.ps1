param(
  [ValidateSet('regional','mobile','discovery','flagship','full')]
  [string]$Scope = 'regional'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = Join-Path $RepoRoot 'one-world-route-public-mvp'
$Qa = Join-Path $Project 'qa'

function Resolve-Chromium {
  if ($env:OWR_CHROMIUM_PATH -and (Test-Path -LiteralPath $env:OWR_CHROMIUM_PATH)) {
    return $env:OWR_CHROMIUM_PATH
  }

  $programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $programFilesX86 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $programFilesX86 'Microsoft\Edge\Application\msedge.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  if (-not $candidates) {
    throw 'Chrome/Edge nicht gefunden. OWR_CHROMIUM_PATH auf eine Chromium-basierte Browser-EXE setzen.'
  }
  return $candidates[0]
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js ist nicht im PATH.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm ist nicht im PATH.'
}

$env:OWR_CHROMIUM_PATH = Resolve-Chromium
$env:OWR_QA_NO_VIDEO = '1'

$playwright = Join-Path $Qa 'node_modules\@playwright\test\cli.js'
if (-not (Test-Path -LiteralPath $playwright)) {
  Write-Host 'Installiere lokale QA-Abhängigkeiten ...' -ForegroundColor Cyan
  & npm ci --prefix $Qa
  if ($LASTEXITCODE -ne 0) { throw 'npm ci für QA ist fehlgeschlagen.' }
}

Set-Location $Project

switch ($Scope) {
  'regional' {
    & node qa/run-local.mjs tests/platform-smoke.spec.mjs '--grep=@regional' '--project=desktop-1440' '--workers=2'
  }
  'mobile' {
    & node qa/run-local.mjs tests/platform-smoke.spec.mjs '--grep=@regional @mobile-critical' '--project=mobile-390' '--workers=2'
  }
  'discovery' {
    & node qa/run-local.mjs tests/platform-smoke.spec.mjs '--grep=@discovery' '--project=desktop-1440' '--workers=2'
  }
  'flagship' {
    & node qa/run-local.mjs tests/platform-smoke.spec.mjs '--grep=@flagship' '--project=desktop-1440' '--workers=2'
  }
  'full' {
    Write-Host 'Bewusster Full-Regional-QA-Lauf (Desktop + Mobile) ...' -ForegroundColor Yellow
    & node scripts/release-build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Release-Build ist fehlgeschlagen.' }
    & node qa/run-local.mjs tests/regional-platform.spec.mjs '--project=desktop-1440' '--project=mobile-390' '--workers=2'
  }
}

if ($LASTEXITCODE -ne 0) {
  throw "Lokale QA ($Scope) ist fehlgeschlagen."
}

Write-Host "Lokale QA ($Scope) erfolgreich. GitHub CI bleibt das Merge-Gate." -ForegroundColor Green
