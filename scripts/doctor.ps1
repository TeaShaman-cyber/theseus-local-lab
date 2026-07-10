param(
  [switch]$Json,
  [switch]$SkipDocker
)

$ErrorActionPreference = "Continue"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function New-Check {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Detail
  )
  [pscustomobject]@{
    name = $Name
    status = $Status
    detail = $Detail
  }
}

function Invoke-DoctorCheck {
  param(
    [string]$Name,
    [scriptblock]$Check
  )
  try {
    & $Check
  } catch {
    New-Check -Name $Name -Status "fail" -Detail $_.Exception.Message
  }
}

function Get-CommandText {
  param(
    [string]$Command,
    [string[]]$Arguments = @()
  )
  $output = & $Command @Arguments 2>&1
  return ($output | Out-String).Trim()
}

$checks = @()

$checks += Invoke-DoctorCheck "powershell" {
  New-Check -Name "powershell" -Status "ok" -Detail $PSVersionTable.PSVersion.ToString()
}

$checks += Invoke-DoctorCheck "git" {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) { return New-Check -Name "git" -Status "missing" -Detail "git not found in PATH" }
  New-Check -Name "git" -Status "ok" -Detail (Get-CommandText "git" @("--version"))
}

$checks += Invoke-DoctorCheck "git-workspace" {
  $gitEntry = Join-Path $ProjectRoot ".git"
  if (-not (Test-Path -LiteralPath $gitEntry)) {
    return New-Check -Name "git-workspace" -Status "missing" -Detail ".git does not exist"
  }

  if ((Test-Path -LiteralPath $gitEntry -PathType Container) -and -not (Get-ChildItem -LiteralPath $gitEntry -Force | Select-Object -First 1)) {
    return New-Check -Name "git-workspace" -Status "fail" -Detail ".git directory exists but is empty"
  }

  $root = Get-CommandText "git" @("rev-parse", "--show-toplevel")
  if ($LASTEXITCODE -eq 0) {
    return New-Check -Name "git-workspace" -Status "ok" -Detail $root
  }
  New-Check -Name "git-workspace" -Status "fail" -Detail $root
}

$checks += Invoke-DoctorCheck "safe-directory" {
  $safe = Get-CommandText "git" @("config", "--get-all", "safe.directory")
  if ($safe -match [regex]::Escape($ProjectRoot)) {
    return New-Check -Name "safe-directory" -Status "ok" -Detail $ProjectRoot
  }
  New-Check -Name "safe-directory" -Status "warn" -Detail "workspace not listed in git safe.directory"
}

$checks += Invoke-DoctorCheck "chocolatey" {
  $choco = Get-Command choco -ErrorAction SilentlyContinue
  if (-not $choco) { return New-Check -Name "chocolatey" -Status "missing" -Detail "choco not found" }
  New-Check -Name "chocolatey" -Status "ok" -Detail (Get-CommandText "choco" @("--version"))
}

$checks += Invoke-DoctorCheck "winget" {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) { return New-Check -Name "winget" -Status "missing" -Detail "winget not found in this shell" }
  New-Check -Name "winget" -Status "ok" -Detail (Get-CommandText "winget" @("--version"))
}

$checks += Invoke-DoctorCheck "git-bash" {
  $script = Join-Path $PSScriptRoot "agent-bash.ps1"
  $result = & $script -Command "echo agent-bash-ok" 2>&1
  if ($LASTEXITCODE -eq 0 -and ($result | Out-String) -match "agent-bash-ok") {
    return New-Check -Name "git-bash" -Status "ok" -Detail "agent-bash wrapper works"
  }
  New-Check -Name "git-bash" -Status "fail" -Detail (($result | Out-String).Trim())
}

$checks += Invoke-DoctorCheck "automem-http" {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -TimeoutSec 5
  $detail = "status=$($health.status); memories=$($health.memory_count); vectors=$($health.vector_count)"
  if ($health.status -eq "healthy") {
    return New-Check -Name "automem-http" -Status "ok" -Detail $detail
  }
  New-Check -Name "automem-http" -Status "warn" -Detail $detail
}

if (-not $SkipDocker) {
  $checks += Invoke-DoctorCheck "docker-cli" {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) { return New-Check -Name "docker-cli" -Status "missing" -Detail "docker not found" }
    $result = Get-CommandText "docker" @("ps", "--format", "{{.Names}}")
    if ($LASTEXITCODE -eq 0) {
      return New-Check -Name "docker-cli" -Status "ok" -Detail ($result -replace "`r?`n", ", ")
    }
    New-Check -Name "docker-cli" -Status "fail" -Detail $result
  }

  $checks += Invoke-DoctorCheck "agent-shell" {
    $script = Join-Path $PSScriptRoot "agent-shell.ps1"
    $result = & $script -Command "echo agent-shell-ok" 2>&1
    if ($LASTEXITCODE -eq 0 -and ($result | Out-String) -match "agent-shell-ok") {
      return New-Check -Name "agent-shell" -Status "ok" -Detail "agent-shell wrapper works"
    }
    New-Check -Name "agent-shell" -Status "fail" -Detail (($result | Out-String).Trim())
  }
}

if ($Json) {
  $checks | ConvertTo-Json -Depth 4
  exit 0
}

"Codex Windows Hut Doctor"
"Project: $ProjectRoot"
""
$checks | Sort-Object name | Format-Table -AutoSize
