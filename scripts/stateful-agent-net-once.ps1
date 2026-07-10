param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$NetDir = Join-Path $ProjectRoot "stateful-agent-net"
Push-Location $NetDir
try {
    docker compose run --rm collector once
}
finally {
    Pop-Location
}
