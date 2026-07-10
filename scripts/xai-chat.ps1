param(
  [string]$Prompt = "",
  [string]$PromptFile = "",
  [string]$Model = "",
  [int]$MaxTokens = 500,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env.local"
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing .env.local"
}

if (-not [string]::IsNullOrWhiteSpace($PromptFile)) {
  $Prompt = Get-Content -LiteralPath $PromptFile -Raw
}
if ([string]::IsNullOrWhiteSpace($Prompt)) {
  throw "Prompt or PromptFile is required"
}

$vars = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
  if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
  $name, $value = $line -split "=", 2
  $vars[$name.Trim()] = $value.Trim()
}

$key = $vars["XAI_API_KEY"]
$base = $vars["XAI_BASE_URL"]
if ([string]::IsNullOrWhiteSpace($key)) { throw "XAI_API_KEY is empty" }
if ([string]::IsNullOrWhiteSpace($base)) { $base = "https://api.x.ai/v1" }
if ([string]::IsNullOrWhiteSpace($Model)) { $Model = $vars["XAI_MODEL"] }
if ([string]::IsNullOrWhiteSpace($Model)) { $Model = "grok-4.5" }
$base = $base.TrimEnd("/")

$body = @{
  model = $Model
  messages = @(
    @{
      role = "system"
      content = "You are a practical, skeptical engineering collaborator. Be concise, concrete, and humane."
    },
    @{ role = "user"; content = $Prompt }
  )
  temperature = 0.2
  max_tokens = $MaxTokens
} | ConvertTo-Json -Depth 10

$reply = Invoke-RestMethod -Method Post -Uri "$base/chat/completions" -Headers @{
  Authorization = "Bearer $key"
  "Content-Type" = "application/json"
} -Body $body -TimeoutSec 120

$result = [pscustomobject]@{
  ok = $true
  provider = "xai"
  model = $Model
  content = $reply.choices[0].message.content
  usage = $reply.usage
}

$json = $result | ConvertTo-Json -Depth 8
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
  $fullOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
  } else {
    Join-Path $root $OutputPath
  }
  $parent = Split-Path -Parent $fullOutputPath
  if (-not [string]::IsNullOrWhiteSpace($parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  Set-Content -LiteralPath $fullOutputPath -Value $json -Encoding UTF8
}

$json
