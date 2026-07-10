$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$AutoMemDir = Join-Path $Root "work\automem"

if (-not (Test-Path $AutoMemDir)) {
    throw "AutoMem directory not found: $AutoMemDir"
}

Push-Location $AutoMemDir
try {
    docker compose stop
} finally {
    Pop-Location
}

Write-Host "AutoMem containers stopped. Volumes and memory data were kept."
