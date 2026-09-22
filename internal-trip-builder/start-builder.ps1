$ErrorActionPreference = "Stop"

$builder = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $builder

Write-Host "ONE WORLD ROUTE - Internal Trip Builder" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found in PATH. Install/use Node.js 22 or newer."
}

$version = node --version
Write-Host "Node: $version"
Write-Host "Starting: http://127.0.0.1:4177/builder/" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray

node .\server.mjs
