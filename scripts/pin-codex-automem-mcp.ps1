$ErrorActionPreference = "Stop"

$ConfigPath = "C:\Users\s.poklad\.codex\config.toml"
$Root = Split-Path -Parent $PSScriptRoot
$Entrypoint = Join-Path $Root "work\mcp-automem-bridge\node_modules\@verygoodplugins\mcp-automem\dist\index.js"

if (-not (Test-Path $ConfigPath)) {
    throw "Codex config not found: $ConfigPath"
}

if (-not (Test-Path $Entrypoint)) {
    throw "Local mcp-automem entrypoint not found: $Entrypoint"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupPath = "$ConfigPath.bak-$stamp"
Copy-Item -LiteralPath $ConfigPath -Destination $BackupPath

$content = Get-Content -LiteralPath $ConfigPath -Raw
$old = @'
[mcp_servers.memory]
command = "npx"
args = ["-y", "@verygoodplugins/mcp-automem"]
'@

$entrypointToml = $Entrypoint.Replace("'", "''")
$new = @"
[mcp_servers.memory]
command = "node"
args = ['$entrypointToml']
"@

if (-not $content.Contains($old)) {
    throw "Expected npx-based mcp_servers.memory block was not found. No changes made."
}

$updated = $content.Replace($old, $new)
Set-Content -LiteralPath $ConfigPath -Value $updated -Encoding UTF8

Write-Host "Updated Codex AutoMem MCP config."
Write-Host "Backup: $BackupPath"
Write-Host "Entrypoint: $Entrypoint"
