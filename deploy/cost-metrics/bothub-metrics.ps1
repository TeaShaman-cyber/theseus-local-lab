# BotHub (bothub.chat) caps metrics for the Prometheus textfile collector.
# Balance and plan come from the provider's own API: GET /api/v2/auth/me with the
# access token returns subscription.balance (caps) and the plan definition.
# The token is read from the Hermes .env and is never printed or written here.

$ErrorActionPreference = "Stop"
$outDir = "C:\Apps\theseus-metrics"
$outFile = Join-Path $outDir "bothub.prom"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$envFile = "C:\Users\s.poklad\AppData\Local\hermes\.env"
$key = $null
foreach ($pattern in '^BOTHUB_API_KEY=', '^HINDSIGHT_BOTHUB_KEY=') {
  $line = Select-String -Path $envFile -Pattern $pattern | Select-Object -First 1
  if ($line) { $key = ($line.Line -replace $pattern, '').Trim(); break }
}
if (-not $key) { Write-Output "no BotHub key in .env"; exit 1 }

$resp = Invoke-RestMethod -Uri "https://bothub.chat/api/v2/auth/me" -Headers @{
  Authorization = "Bearer $key"
  Accept        = "application/json"
} -TimeoutSec 30

$sub = $resp.subscription
$balance   = if ($sub.availableBalance -ne $null) { [double]$sub.availableBalance } else { [double]$sub.balance }
$raw       = [double]$sub.balance
$planType  = if ($sub.plan) { [string]$sub.plan.type } else { "unknown" }
$planTok   = if ($sub.plan) { [double]$sub.plan.tokens } else { 0 }
$planPrice = if ($sub.plan) { [double]$sub.plan.price } else { 0 }

$lines = @(
  "# HELP bothub_caps_available Caps available to spend on BotHub",
  "# TYPE bothub_caps_available gauge",
  "bothub_caps_available{provider=`"bothub`",plan=`"$planType`"} $balance",
  "# HELP bothub_caps_balance Raw caps balance on BotHub",
  "# TYPE bothub_caps_balance gauge",
  "bothub_caps_balance{provider=`"bothub`",plan=`"$planType`"} $raw",
  "# HELP bothub_plan_tokens Token allowance of the current BotHub plan",
  "# TYPE bothub_plan_tokens gauge",
  "bothub_plan_tokens{provider=`"bothub`",plan=`"$planType`"} $planTok",
  "# HELP bothub_plan_price_rub Monthly price of the current BotHub plan in RUB",
  "# TYPE bothub_plan_price_rub gauge",
  "bothub_plan_price_rub{provider=`"bothub`",plan=`"$planType`"} $planPrice"
)

$tmp = "$outFile.tmp"
$lines -join "`n" | Set-Content -Path $tmp -Encoding ASCII
Move-Item -Path $tmp -Destination $outFile -Force

Write-Output ("bothub.prom written: available=$balance plan=$planType tokens=$planTok price=$planPrice RUB")
