$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$AutoMemDir = Join-Path $Root "work\automem"
$HealthUrl = "http://127.0.0.1:8001/health"

Write-Host "AutoMem directory: $AutoMemDir"

try {
    $response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 10
    Write-Host "AutoMem API: healthy"
    $response | ConvertTo-Json -Depth 8
} catch {
    Write-Host "AutoMem API: not reachable at $HealthUrl"
    Write-Host $_.Exception.Message
}

if (Test-Path $AutoMemDir) {
    Push-Location $AutoMemDir
    try {
        docker compose ps
    } catch {
        Write-Host "Docker status unavailable from this shell:"
        Write-Host $_.Exception.Message
    } finally {
        Pop-Location
    }
} else {
    Write-Host "AutoMem directory not found."
}
