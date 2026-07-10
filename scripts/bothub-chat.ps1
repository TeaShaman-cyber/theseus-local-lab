param(
  [string]$Prompt = "connection test",
  [string]$Model = "",
  [string]$PromptFile = "",
  [int]$MaxTokens = 300
)

$ErrorActionPreference = "Stop"
$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) ".env.local"
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing .env.local"
}

$vars = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
  if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
  $name, $value = $line -split "=", 2
  $vars[$name.Trim()] = $value.Trim()
}

$key = $vars["BOTHUB_API_KEY"]
$base = $vars["BOTHUB_BASE_URL"]
if ([string]::IsNullOrWhiteSpace($key)) { throw "BOTHUB_API_KEY is empty" }
if ([string]::IsNullOrWhiteSpace($base)) { throw "BOTHUB_BASE_URL is empty" }

if ([string]::IsNullOrWhiteSpace($Model)) {
  $Model = $vars["BOTHUB_MODEL"]
}
if ([string]::IsNullOrWhiteSpace($Model)) {
  $Model = "gpt-4o-mini"
}

if (-not [string]::IsNullOrWhiteSpace($PromptFile)) {
  if (-not (Test-Path -LiteralPath $PromptFile)) {
    throw "PromptFile not found: $PromptFile"
  }
  $Prompt = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $PromptFile))
}

$base = $base.TrimEnd("/")
$body = @{
  model = $Model
  messages = @(
    @{ role = "user"; content = $Prompt }
  )
  temperature = 0.2
  max_tokens = $MaxTokens
} | ConvertTo-Json -Depth 6

$reply = Invoke-RestMethod -Method Post -Uri "$base/chat/completions" -Headers @{
  Authorization = "Bearer $key"
  "Content-Type" = "application/json"
} -Body $body -TimeoutSec 90

[pscustomobject]@{
  model = $Model
  response = $reply.choices[0].message.content
  usage = $reply.usage
} | ConvertTo-Json -Depth 6
