param(
  [int]$Port = 4180
)

$ErrorActionPreference = "Stop"

$BuilderRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $BuilderRoot

Set-Location $RepoRoot
$env:OWR_BUILDER_PORT = [string]$Port

Write-Host "Starting ONE WORLD ROUTE Internal Trip Builder..." -ForegroundColor Cyan
Write-Host "URL: http://127.0.0.1:$Port/" -ForegroundColor Green
Write-Host "Drafts stay local. Publish writes only to the working tree." -ForegroundColor DarkGray

node "$BuilderRoot\server.mjs"
