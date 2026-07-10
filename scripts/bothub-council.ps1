param(
  [string]$PromptFile = "",

  [string]$Prompt,

  [string[]]$Models = @("deepseek-chat", "gpt-4o-mini", "gemini-2.5-flash", "claude-3-haiku"),
  [string]$ChairmanModel = "gpt-4o-mini",
  [int]$MaxTokens = 500,
  [int]$TimeoutSec = 120,
  [string]$OutputPath = "",
  [switch]$Quiet,
  [switch]$SkipPeerReview
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing .env.local"
  }

  $vars = @{}
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
    $name, $value = $line -split "=", 2
    $vars[$name.Trim()] = $value.Trim()
  }
  return $vars
}

function Invoke-BothubChat {
  param(
    [string]$BaseUrl,
    [string]$ApiKey,
    [string]$Model,
    [array]$Messages,
    [int]$Tokens,
    [int]$TimeoutSec
  )

  $body = @{
    model = $Model
    messages = $Messages
    temperature = 0.2
    max_tokens = $Tokens
  } | ConvertTo-Json -Depth 10

  try {
    $reply = Invoke-RestMethod -Method Post -Uri "$BaseUrl/chat/completions" -Headers @{
      Authorization = "Bearer $ApiKey"
      "Content-Type" = "application/json"
    } -Body $body -TimeoutSec $TimeoutSec

    return [pscustomobject]@{
      ok = $true
      model = $Model
      content = $reply.choices[0].message.content
      usage = $reply.usage
    }
  } catch {
    return [pscustomobject]@{
      ok = $false
      model = $Model
      error = $_.Exception.Message
    }
  }
}

function ConvertTo-ResponseLabel {
  param([int]$Index)
  return "Response $([char](65 + $Index))"
}

function Write-CouncilLog {
  param([string]$Message)
  if (-not $Quiet) {
    [Console]::Error.WriteLine("[bothub-council] $Message")
  }
}

$root = Split-Path -Parent $PSScriptRoot
if (-not [string]::IsNullOrWhiteSpace($PromptFile)) {
  $Prompt = Get-Content -LiteralPath $PromptFile -Raw
}
if ([string]::IsNullOrWhiteSpace($Prompt)) {
  throw "Prompt or PromptFile is required"
}

$vars = Read-DotEnv -Path (Join-Path $root ".env.local")
$apiKey = $vars["BOTHUB_API_KEY"]
$baseUrl = $vars["BOTHUB_BASE_URL"]
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "BOTHUB_API_KEY is empty" }
if ([string]::IsNullOrWhiteSpace($baseUrl)) { throw "BOTHUB_BASE_URL is empty" }
$baseUrl = $baseUrl.TrimEnd("/")

Write-CouncilLog "stage 1: asking $($Models.Count) model(s)"
$stage1Index = 0
$stage1 = @(foreach ($model in $Models) {
  $stage1Index += 1
  Write-CouncilLog "stage 1 $stage1Index/$($Models.Count): $model"
  $response = Invoke-BothubChat -BaseUrl $baseUrl -ApiKey $apiKey -Model $model -Tokens $MaxTokens -TimeoutSec $TimeoutSec -Messages @(
    @{
      role = "system"
      content = "Give a useful, concise answer. Prefer concrete tradeoffs. Keep room for playfulness when it helps thinking; do not become bureaucratic."
    },
    @{ role = "user"; content = $Prompt }
  )
  if ($response.ok) {
    Write-CouncilLog "stage 1 ${model}: ok, tokens=$($response.usage.total_tokens)"
  } else {
    Write-CouncilLog "stage 1 ${model}: failed: $($response.error)"
  }
  $response
})

$successful = @($stage1 | Where-Object { $_.ok })
Write-CouncilLog "stage 1 complete: $($successful.Count)/$($Models.Count) succeeded"
if ($successful.Count -eq 0) {
  [pscustomobject]@{ ok = $false; error = "All council models failed"; stage1 = $stage1 } | ConvertTo-Json -Depth 8
  exit 1
}

$labelToModel = @{}
$responseBlocks = for ($i = 0; $i -lt $successful.Count; $i++) {
  $label = ConvertTo-ResponseLabel -Index $i
  $labelToModel[$label] = $successful[$i].model
  "${label}:`n$($successful[$i].content)"
}

$stage2 = @()
if (-not $SkipPeerReview -and $successful.Count -gt 1) {
  Write-CouncilLog "stage 2: peer review by $($Models.Count) model(s)"
  $reviewPrompt = @"
Original prompt:
$Prompt

Anonymous responses:
$($responseBlocks -join "`n`n")

Evaluate each response for:
1. correctness and useful detail
2. safety and privacy discipline
3. practical actionability
4. ability to avoid premature fixation
5. humane tone, including lightness or humor when it helps thinking

End with exactly:
FINAL RANKING:
1. Response X
2. Response Y
"@

  $stage2Index = 0
  $stage2 = @(foreach ($model in $Models) {
    $stage2Index += 1
    Write-CouncilLog "stage 2 $stage2Index/$($Models.Count): $model"
    $response = Invoke-BothubChat -BaseUrl $baseUrl -ApiKey $apiKey -Model $model -Tokens $MaxTokens -TimeoutSec $TimeoutSec -Messages @(
      @{
        role = "system"
        content = "You are reviewing anonymous peer answers. Judge the work, not the model identity."
      },
      @{ role = "user"; content = $reviewPrompt }
    )
    if ($response.ok) {
      Write-CouncilLog "stage 2 ${model}: ok, tokens=$($response.usage.total_tokens)"
    } else {
      Write-CouncilLog "stage 2 ${model}: failed: $($response.error)"
    }
    $response
  })
  $stage2Success = @($stage2 | Where-Object { $_.ok })
  Write-CouncilLog "stage 2 complete: $($stage2Success.Count)/$($Models.Count) succeeded"
} else {
  Write-CouncilLog "stage 2 skipped"
}

$synthesisPrompt = @"
Original prompt:
$Prompt

Stage 1 responses:
$($successful | ForEach-Object { "Model: $($_.model)`n$($_.content)" } | Out-String)

Stage 2 peer reviews:
$($stage2 | Where-Object { $_.ok } | ForEach-Object { "Model: $($_.model)`n$($_.content)" } | Out-String)

Synthesize a final answer. Preserve concrete disagreement, avoid needless ceremony, and include one short note about whether humor/lightness helps this task.
"@

Write-CouncilLog "stage 3: chair synthesis by $ChairmanModel"
$stage3 = Invoke-BothubChat -BaseUrl $baseUrl -ApiKey $apiKey -Model $ChairmanModel -Tokens ($MaxTokens + 300) -Messages @(
  @{
    role = "system"
    content = "You are the council chair. Produce a concise synthesis with practical next steps."
  },
  @{ role = "user"; content = $synthesisPrompt }
) -TimeoutSec $TimeoutSec
if ($stage3.ok) {
  Write-CouncilLog "stage 3 ${ChairmanModel}: ok, tokens=$($stage3.usage.total_tokens)"
} else {
  Write-CouncilLog "stage 3 ${ChairmanModel}: failed: $($stage3.error)"
}

$result = [pscustomobject]@{
  ok = $true
  prompt = $Prompt
  models = $Models
  chairman_model = $ChairmanModel
  label_to_model = $labelToModel
  stage1 = $stage1
  stage2 = $stage2
  stage3 = $stage3
}

$json = $result | ConvertTo-Json -Depth 10
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
  Write-CouncilLog "saved result: $fullOutputPath"
}

$json
