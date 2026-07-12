$ErrorActionPreference = "Stop"
$PersistHome = $false
$AgentImage = $false
$ProviderPrefix = "BOTHUB"
$CodeWhaleArgs = @()

for ($i = 0; $i -lt $args.Count; $i += 1) {
  switch -Regex ($args[$i]) {
    "^-PersistHome$" {
      $PersistHome = $true
      continue
    }
    "^-AgentImage$" {
      $AgentImage = $true
      continue
    }
    "^-ProviderPrefix$" {
      if ($i + 1 -ge $args.Count) { throw "-ProviderPrefix requires BOTHUB or XAI" }
      $ProviderPrefix = $args[$i + 1].ToUpperInvariant()
      $i += 1
      continue
    }
    default {
      $CodeWhaleArgs += $args[$i]
    }
  }
}

if ($ProviderPrefix -notin @("BOTHUB", "XAI")) {
  throw "ProviderPrefix must be BOTHUB or XAI."
}

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $ProjectRoot ".env.local"

$vars = @{}
if (Test-Path -LiteralPath $envPath) {
  foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
    if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
    $name, $value = $line -split "=", 2
    $vars[$name.Trim()] = $value.Trim()
  }
}

$apiKeyName = "${ProviderPrefix}_API_KEY"
$baseUrlName = "${ProviderPrefix}_BASE_URL"
$modelName = "${ProviderPrefix}_MODEL"

$apiKey = if ([Environment]::GetEnvironmentVariable($apiKeyName)) { [Environment]::GetEnvironmentVariable($apiKeyName) } else { $vars[$apiKeyName] }
$baseUrl = if ([Environment]::GetEnvironmentVariable($baseUrlName)) { [Environment]::GetEnvironmentVariable($baseUrlName) } else { $vars[$baseUrlName] }
$model = if ([Environment]::GetEnvironmentVariable($modelName)) { [Environment]::GetEnvironmentVariable($modelName) } else { $vars[$modelName] }
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "$apiKeyName is empty" }
if ([string]::IsNullOrWhiteSpace($baseUrl)) {
  $baseUrl = if ($ProviderPrefix -eq "XAI") { "https://api.x.ai/v1" } else { "https://openai.bothub.chat/v1" }
}
if ([string]::IsNullOrWhiteSpace($model)) {
  $model = if ($ProviderPrefix -eq "XAI") { "grok-4.5" } else { "gpt-4o-mini" }
}

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

$dockerArgs = @(
  "run",
  "--rm",
  "-e", "OPENAI_API_KEY=$apiKey",
  "-e", "OPENAI_BASE_URL=$baseUrl",
  "-e", "OPENAI_MODEL=$model",
  "-e", "HOME=/tmp/codewhale-home",
  "-e", "CODEWHALE_CONFIG_PATH=/tmp/codewhale-home/config.toml",
  "-v", "${ProjectRoot}:/workspace"
)
$dockerArgs += $homeArgs
$dockerArgs += @("-w", "/workspace", $image)
$dockerArgs += $globalArgs
$dockerArgs += $CodeWhaleArgs

& docker @dockerArgs
