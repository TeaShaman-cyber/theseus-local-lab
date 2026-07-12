param(
  [int]$Limit = 40,
  [string]$Filter = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "provider-env.ps1")

$provider = Get-ProviderConfig -ProviderPrefix "XAI" -DefaultBaseUrl "https://api.x.ai/v1"
$models = Invoke-RestMethod -Method Get -Uri "$($provider.BaseUrl)/models" -Headers @{
  Authorization = "Bearer $($provider.ApiKey)"
} -TimeoutSec 30

$items = @($models.data)
if (-not [string]::IsNullOrWhiteSpace($Filter)) {
  $items = @($items | Where-Object { $_.id -like "*$Filter*" })
}

"Models: $($items.Count)"
$items | Select-Object -First $Limit -ExpandProperty id
