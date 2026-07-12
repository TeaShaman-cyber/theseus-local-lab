param(
  [ValidateSet("codex", "powershell", "vscode", "wsl", "other")]
  [string]$Context = "other"
)

$ErrorActionPreference = "Continue"

function Invoke-ReadOnlyCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @(),
    [int]$TimeoutSeconds = 10
  )

  $commandLine = (@($FilePath) + @($Arguments)) -join " "
  $result = [ordered]@{
    command = $commandLine
    available = $false
    exitCode = $null
    stdout = ""
    stderr = ""
    error = $null
  }

  $command = Get-Command $FilePath -ErrorAction SilentlyContinue
  if (-not $command) {
    $result.error = "not found"
    return $result
  }

  $result.available = $true
  $tempOut = [System.IO.Path]::GetTempFileName()
  $tempErr = [System.IO.Path]::GetTempFileName()

  try {
    $argumentLine = (@($Arguments) | ForEach-Object {
      $arg = [string]$_
      if ($arg -match '[\s"]') {
        '"' + ($arg -replace '"', '\"') + '"'
      } else {
        $arg
      }
    }) -join " "
    $process = Start-Process -FilePath $command.Source -ArgumentList $argumentLine -NoNewWindow -PassThru -Wait -RedirectStandardOutput $tempOut -RedirectStandardError $tempErr
    $result.exitCode = $process.ExitCode
    $result.stdout = Redact-Text (Read-TextFileBestEffort $tempOut)
    $result.stderr = Redact-Text (Read-TextFileBestEffort $tempErr)
  } catch {
    $result.error = $_.Exception.Message
  } finally {
    foreach ($tempPath in @($tempOut, $tempErr)) {
      try {
        [System.IO.File]::Delete($tempPath)
      } catch {
        continue
      }
    }
  }

  return $result
}

function Read-TextFileBestEffort {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return ""
  }

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -eq 0) {
    return ""
  }

  $nullCount = ($bytes | Where-Object { $_ -eq 0 }).Count
  if ($nullCount -gt [Math]::Max(4, [int]($bytes.Length / 8))) {
    $encodings = @(
      [System.Text.Encoding]::Unicode,
      [System.Text.Encoding]::UTF8,
      [System.Text.Encoding]::GetEncoding(866),
      [System.Text.Encoding]::Default
    )
  } else {
    $encodings = @(
      [System.Text.Encoding]::UTF8,
      [System.Text.Encoding]::GetEncoding(866),
      [System.Text.Encoding]::Default,
      [System.Text.Encoding]::Unicode
    )
  }

  foreach ($encoding in $encodings) {
    try {
      $text = $encoding.GetString($bytes).Trim([char]0xFEFF, [char]0x0000, "`r", "`n", " ")
      if ($text) {
        return $text
      }
    } catch {
      continue
    }
  }

  return ""
}

function Redact-Text {
  param([string]$Text)

  if (-not $Text) {
    return ""
  }

  $redacted = $Text
  $redacted = $redacted -replace '(?i)(https?://)([^/\s:@]+):([^@\s/]+)@', '$1<redacted-user>:<redacted-pass>@'
  $redacted = $redacted -replace '(?i)(token|key|secret|password|passwd|pwd)=([^;\s]+)', '$1=<redacted>'
  $redacted = $redacted -replace '(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+', '$1<redacted>'
  return $redacted
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port
  )

  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(1000, $false)
    if ($ok) {
      $client.EndConnect($async)
    }
    $client.Close()
    return [bool]$ok
  } catch {
    return $false
  }
}

function Get-ProxyEnvPresence {
  $names = @("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy")
  $presence = [ordered]@{}
  foreach ($name in $names) {
    $presence[$name] = [bool]([Environment]::GetEnvironmentVariable($name))
  }
  return $presence
}

function Get-RegistryProxyState {
  $state = [ordered]@{
    proxyEnable = $null
    hasProxyServer = $false
    error = $null
  }

  try {
    $path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    $item = Get-ItemProperty -Path $path -ErrorAction Stop
    $state.proxyEnable = $item.ProxyEnable
    $state.hasProxyServer = [bool]$item.ProxyServer
  } catch {
    $state.error = $_.Exception.Message
  }

  return $state
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHHmmss-fffZ")
$workspace = (Resolve-Path -LiteralPath ".").Path
$outDir = Join-Path $workspace "outputs\local_inventory"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$gitRoot = Invoke-ReadOnlyCommand -FilePath "git" -Arguments @("rev-parse", "--show-toplevel")
$dockerContext = Invoke-ReadOnlyCommand -FilePath "docker" -Arguments @("context", "show")
$dockerVersion = Invoke-ReadOnlyCommand -FilePath "docker" -Arguments @("version", "--format", "client={{.Client.Version}} server={{.Server.Version}}")

$inventory = [ordered]@{
  schema = "theseus-local-inventory/v1"
  createdUtc = (Get-Date).ToUniversalTime().ToString("o")
  context = $Context
  identity = [ordered]@{
    whoami = (Invoke-ReadOnlyCommand -FilePath "whoami").stdout
    userName = $env:USERNAME
    userDomain = $env:USERDOMAIN
    userProfile = $env:USERPROFILE
    cwd = $workspace
    psVersion = $PSVersionTable.PSVersion.ToString()
  }
  git = [ordered]@{
    root = $gitRoot.stdout
    rootExitCode = $gitRoot.exitCode
  }
  wsl = [ordered]@{
    status = Invoke-ReadOnlyCommand -FilePath "wsl.exe" -Arguments @("--status")
    listVerbose = Invoke-ReadOnlyCommand -FilePath "wsl.exe" -Arguments @("-l", "-v")
  }
  docker = [ordered]@{
    context = $dockerContext
    version = $dockerVersion
  }
  proxy = [ordered]@{
    envPresence = Get-ProxyEnvPresence
    internetSettings = Get-RegistryProxyState
    winHttp = Invoke-ReadOnlyCommand -FilePath "netsh.exe" -Arguments @("winhttp", "show", "proxy")
    v2rayNProcessPresent = [bool](Get-Process -Name "v2rayN" -ErrorAction SilentlyContinue)
    localPort10808Open = Test-TcpPort -HostName "127.0.0.1" -Port 10808
  }
}

$path = Join-Path $outDir "$timestamp-$Context.json"
$inventory | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
Write-Output $path
