param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [int]$IntervalSeconds = 900
)

$ErrorActionPreference = "Stop"
$NetDir = Join-Path $ProjectRoot "stateful-agent-net"

Push-Location $NetDir
try {
    $env:OBSERVATORY_INTERVAL_SECONDS = [string]$IntervalSeconds
    docker compose up -d --build --force-recreate collector
    docker compose ps
}
finally {
    Pop-Location
}
