# RunInfra cost/limit metrics for Prometheus textfile collector.
# Reads the provider's own account endpoint through the official CLI, writes a
# .prom file that windows_exporter's textfile collector exposes.
# The API key is read from the Hermes .env and never printed or written here.

$ErrorActionPreference = "Stop"
$outDir = "C:\Apps\theseus-metrics"
$outFile = Join-Path $outDir "runinfra.prom"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$envFile = "C:\Users\s.poklad\AppData\Local\hermes\.env"
$line = Select-String -Path $envFile -Pattern '^RUNINFRA_API_KEY=' | Select-Object -First 1
if (-not $line) { Write-Output "no RUNINFRA_API_KEY"; exit 1 }
$env:RUNINFRA_API_KEY = ($line.Line -replace '^RUNINFRA_API_KEY=', '').Trim()

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"   # npx writes progress lines to stderr
$raw = (& npx -y "@runinfra/cli@latest" account --json 2>&1 | Out-String)
$ErrorActionPreference = $prevEap
$start = $raw.IndexOf('{')
if ($start -lt 0) { Write-Output "no json: $($raw.Substring(0, [Math]::Min(300, $raw.Length)))"; exit 1 }
$json = $raw.Substring($start) | ConvertFrom-Json

$c = $json.account.credits
$lim = $json.account.limits
$frozen = if ($json.account.frozen.frozen) { 1 } else { 0 }

$balance   = [double]$c.balance_cents / 100.0
$available = [double]$c.available_cents / 100.0
$spent     = [double]$c.period.spent_cents / 100.0
$period    = $c.period.start

$lines = @(
  "# HELP runinfra_credits_balance_usd RunInfra credit balance in USD",
  "# TYPE runinfra_credits_balance_usd gauge",
  "runinfra_credits_balance_usd{provider=`"runinfra`"} $balance",
  "# HELP runinfra_credits_available_usd RunInfra available (unheld) credits in USD",
  "# TYPE runinfra_credits_available_usd gauge",
  "runinfra_credits_available_usd{provider=`"runinfra`"} $available",
  "# HELP runinfra_spent_usd RunInfra spend for the current billing period in USD",
  "# TYPE runinfra_spent_usd gauge",
  "runinfra_spent_usd{provider=`"runinfra`",period_start=`"$period`"} $spent",
  "# HELP runinfra_frozen Whether the RunInfra account is frozen",
  "# TYPE runinfra_frozen gauge",
  "runinfra_frozen{provider=`"runinfra`"} $frozen"
)

if ($lim) {
  if ($lim.hostedConcurrencyCap) {
    $lines += "# TYPE runinfra_limit_hosted_concurrency gauge"
    $lines += "runinfra_limit_hosted_concurrency{provider=`"runinfra`"} $($lim.hostedConcurrencyCap.value)"
  }
  if ($lim.hostedTpmCap) {
    $lines += "# TYPE runinfra_limit_hosted_tpm gauge"
    $lines += "runinfra_limit_hosted_tpm{provider=`"runinfra`"} $($lim.hostedTpmCap.value)"
  }
  if ($lim.rpmCap) {
    $lines += "# TYPE runinfra_limit_rpm gauge"
    $lines += "runinfra_limit_rpm{provider=`"runinfra`"} $($lim.rpmCap.value)"
  }
}

# Atomic write so the collector never reads a half-written file.
$tmp = "$outFile.tmp"
$lines -join "`n" | Set-Content -Path $tmp -Encoding ASCII
Move-Item -Path $tmp -Destination $outFile -Force

Write-Output ("runinfra.prom written: balance=$balance available=$available spent=$spent frozen=$frozen")
