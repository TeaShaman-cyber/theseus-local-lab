param(
  [string]$Prompt = "connection test",
  [string]$Model = "",
  [string]$PromptFile = "",
  [int]$MaxTokens = 300
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "provider-env.ps1")

if ([string]::IsNullOrWhiteSpace($Model)) {
  $provider = Get-ProviderConfig -ProviderPrefix "BOTHUB" -DefaultBaseUrl "https://openai.bothub.chat/v1" -DefaultModel "gpt-4o-mini"
  $Model = $provider.Model
} else {
  $provider = Get-ProviderConfig -ProviderPrefix "BOTHUB" -DefaultBaseUrl "https://openai.bothub.chat/v1"
}

if (-not [string]::IsNullOrWhiteSpace($PromptFile)) {
  if (-not (Test-Path -LiteralPath $PromptFile)) {
    throw "PromptFile not found: $PromptFile"
  }
  $Prompt = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $PromptFile))
}

$body = @{
  model = $Model
  messages = @(
    @{ role = "user"; content = $Prompt }
  )
  temperature = 0.2
  max_tokens = $MaxTokens
} | ConvertTo-Json -Depth 6

$reply = Invoke-RestMethod -Method Post -Uri "$($provider.BaseUrl)/chat/completions" -Headers @{
  Authorization = "Bearer $($provider.ApiKey)"
  "Content-Type" = "application/json"
} -Body $body -TimeoutSec 90

[pscustomobject]@{
  model = $Model
  response = $reply.choices[0].message.content
  usage = $reply.usage
} | ConvertTo-Json -Depth 6
