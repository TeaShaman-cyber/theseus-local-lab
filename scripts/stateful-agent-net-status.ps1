param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [int]$Tail = 80
)

$ErrorActionPreference = "Continue"
$NetDir = Join-Path $ProjectRoot "stateful-agent-net"

Push-Location $NetDir
try {
    docker compose ps
    ""
    docker compose logs --tail=$Tail collector
}
finally {
    Pop-Location
}
