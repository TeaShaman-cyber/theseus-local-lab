param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$NetDir = Join-Path $ProjectRoot "stateful-agent-net"

Push-Location $NetDir
try {
    docker compose down
}
finally {
    Pop-Location
}
