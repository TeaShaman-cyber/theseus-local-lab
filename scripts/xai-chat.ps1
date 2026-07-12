param(
  [string]$Prompt = "",
  [string]$PromptFile = "",
  [string]$Model = "",
  [int]$MaxTokens = 500,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "provider-env.ps1")

if (-not [string]::IsNullOrWhiteSpace($PromptFile)) {
  $Prompt = Get-Content -LiteralPath $PromptFile -Raw
}
if ([string]::IsNullOrWhiteSpace($Prompt)) {
  throw "Prompt or PromptFile is required"
}

if ([string]::IsNullOrWhiteSpace($Model)) {
  $provider = Get-ProviderConfig -ProviderPrefix "XAI" -DefaultBaseUrl "https://api.x.ai/v1" -DefaultModel "grok-4.5"
  $Model = $provider.Model
} else {
  $provider = Get-ProviderConfig -ProviderPrefix "XAI" -DefaultBaseUrl "https://api.x.ai/v1"
}

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

$reply = Invoke-RestMethod -Method Post -Uri "$($provider.BaseUrl)/chat/completions" -Headers @{
  Authorization = "Bearer $($provider.ApiKey)"
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
