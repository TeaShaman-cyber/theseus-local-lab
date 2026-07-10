$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$AutoMemDir = Join-Path $Root "work\automem"
$HealthUrl = "http://127.0.0.1:8001/health"

if (-not (Test-Path $AutoMemDir)) {
    throw "AutoMem directory not found: $AutoMemDir"
}

Push-Location $AutoMemDir
try {
    docker compose up -d
} finally {
    Pop-Location
}

$deadline = (Get-Date).AddSeconds(60)
do {
    try {
        $response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5
        Write-Host "AutoMem API: healthy"
        $response | ConvertTo-Json -Depth 8
        exit 0
    } catch {
        Start-Sleep -Seconds 3
    }
} while ((Get-Date) -lt $deadline)

throw "AutoMem did not become healthy within 60 seconds."
