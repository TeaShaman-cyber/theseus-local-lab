param(
  [switch]$PersistHome,
  [switch]$AgentImage,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CodeWhaleArgs
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $ProjectRoot ".env.local"
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing .env.local"
}

$vars = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
  if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
  $name, $value = $line -split "=", 2
  $vars[$name.Trim()] = $value.Trim()
}

$apiKey = $vars["BOTHUB_API_KEY"]
$baseUrl = $vars["BOTHUB_BASE_URL"]
$model = $vars["BOTHUB_MODEL"]
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "BOTHUB_API_KEY is empty" }
if ([string]::IsNullOrWhiteSpace($baseUrl)) { $baseUrl = "https://openai.bothub.chat/v1" }
if ([string]::IsNullOrWhiteSpace($model)) { $model = "deepseek-chat" }

$homeArgs = @()
if ($PersistHome) {
  $homeDir = Join-Path $ProjectRoot ".codewhale-home"
  New-Item -ItemType Directory -Force -Path $homeDir | Out-Null
  $homeArgs = @("-v", "${homeDir}:/tmp/codewhale-home")
}

if (-not $CodeWhaleArgs -or $CodeWhaleArgs.Count -eq 0) {
  $CodeWhaleArgs = @("--help")
}

$globalArgs = @(
  "--provider", "openai",
  "--base-url", $baseUrl,
  "--model", $model,
  "--telemetry", "false"
)

$image = if ($AgentImage) { "codewhale-agent:latest" } else { "ghcr.io/hmbown/codewhale:latest" }

docker run --rm `
  -e "OPENAI_API_KEY=$apiKey" `
  -e "OPENAI_BASE_URL=$baseUrl" `
  -e "OPENAI_MODEL=$model" `
  -e "HOME=/tmp/codewhale-home" `
  -e "CODEWHALE_CONFIG_PATH=/tmp/codewhale-home/config.toml" `
  -v "${ProjectRoot}:/workspace" `
  @homeArgs `
  -w /workspace `
  $image `
  @globalArgs `
  @CodeWhaleArgs
