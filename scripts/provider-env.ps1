$ErrorActionPreference = "Stop"

function Read-LocalEnvFile {
  param([string]$Path)

  $vars = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $vars
  }

  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
    $name, $value = $line -split "=", 2
    $vars[$name.Trim()] = $value.Trim()
  }
  return $vars
}

function Get-ProviderEnvValue {
  param(
    [hashtable]$Vars,
    [string]$Name
  )

  $envValue = [Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($envValue)) {
    return $envValue
  }
  return $Vars[$Name]
}

function Get-ProviderConfig {
  param(
    [ValidateSet("BOTHUB", "XAI")]
    [string]$ProviderPrefix,
    [string]$DefaultBaseUrl,
    [string]$DefaultModel = "",
    [switch]$RequireModel
  )

  $root = Split-Path -Parent $PSScriptRoot
  $vars = Read-LocalEnvFile -Path (Join-Path $root ".env.local")

  $apiKeyName = "${ProviderPrefix}_API_KEY"
  $baseUrlName = "${ProviderPrefix}_BASE_URL"
  $modelName = "${ProviderPrefix}_MODEL"

  $apiKey = Get-ProviderEnvValue -Vars $vars -Name $apiKeyName
  $baseUrl = Get-ProviderEnvValue -Vars $vars -Name $baseUrlName
  $model = Get-ProviderEnvValue -Vars $vars -Name $modelName

  if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "$apiKeyName is empty. Run through Infisical or restore the ignored .env.local fallback."
  }
  if ([string]::IsNullOrWhiteSpace($baseUrl)) {
    $baseUrl = $DefaultBaseUrl
  }
  if ([string]::IsNullOrWhiteSpace($model)) {
    $model = $DefaultModel
  }
  if ($RequireModel -and [string]::IsNullOrWhiteSpace($model)) {
    throw "$modelName is empty."
  }

  [pscustomobject]@{
    ApiKey = $apiKey
    BaseUrl = $baseUrl.TrimEnd("/")
    Model = $model
  }
}
