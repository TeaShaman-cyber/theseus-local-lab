param(
  [int]$Limit = 40,
  [string]$Filter = ""
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

$key = $vars["XAI_API_KEY"]
$base = $vars["XAI_BASE_URL"]
if ([string]::IsNullOrWhiteSpace($key)) { throw "XAI_API_KEY is empty" }
if ([string]::IsNullOrWhiteSpace($base)) { $base = "https://api.x.ai/v1" }
$base = $base.TrimEnd("/")

$models = Invoke-RestMethod -Method Get -Uri "$base/models" -Headers @{
  Authorization = "Bearer $key"
} -TimeoutSec 30

$items = @($models.data)
if (-not [string]::IsNullOrWhiteSpace($Filter)) {
  $items = @($items | Where-Object { $_.id -like "*$Filter*" })
}

"Models: $($items.Count)"
$items | Select-Object -First $Limit -ExpandProperty id
