param(
  [string]$OutputDir = "backups",
  [switch]$DryRun,
  [switch]$IncludeAutoMemApi,
  [string]$AutoMemUrl = "http://127.0.0.1:8001",
  [string]$AdminToken = $env:AUTOMEM_ADMIN_TOKEN,
  [switch]$IncludeCodexConfig = $true
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupName = "ai-hut-safe-$Timestamp"
$OutputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
  $OutputDir
} else {
  Join-Path $ProjectRoot $OutputDir
}
$StagingRoot = Join-Path $OutputPath "$BackupName.staging"
$ArchivePath = Join-Path $OutputPath "$BackupName.zip"

$IncludeFiles = @(
  ".env.example",
  ".gitignore",
  "RESTORE.md"
)

$IncludeDirs = @(
  "agent-shell",
  "codewhale",
  "outputs",
  "scripts",
  "stateful-agent-net"
)

$ExcludeDirNames = @(
  ".git",
  ".codex",
  ".agents",
  ".codewhale-home",
  "backups",
  "node_modules",
  "tmp",
  "work",
  "__pycache__"
)

$ExcludeFileNames = @(
  ".env",
  ".env.local"
)

$ExcludeFilePatterns = @(
  "*.key",
  "*.pem",
  "*.pfx",
  "*.sqlite-journal",
  "*.log"
)

function Test-ExcludedPath {
  param([string]$Path)

  $relative = [System.IO.Path]::GetRelativePath($ProjectRoot, $Path)
  $parts = $relative -split '[\\/]'
  foreach ($part in $parts) {
    if ($ExcludeDirNames -contains $part) {
      return $true
    }
  }

  $leaf = Split-Path -Leaf $Path
  if ($ExcludeFileNames -contains $leaf) {
    return $true
  }

  foreach ($pattern in $ExcludeFilePatterns) {
    if ($leaf -like $pattern) {
      return $true
    }
  }

  return $false
}

function Copy-SafeItem {
  param(
    [string]$RelativePath
  )

  $source = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path -LiteralPath $source)) {
    return @()
  }

  $copied = @()
  $sourceItem = Get-Item -LiteralPath $source -Force

  if (-not $sourceItem.PSIsContainer) {
    if (-not (Test-ExcludedPath $sourceItem.FullName)) {
      $target = Join-Path $StagingRoot $RelativePath
      $targetParent = Split-Path -Parent $target
      if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
        Copy-Item -LiteralPath $sourceItem.FullName -Destination $target -Force
      }
      $copied += $RelativePath
    }
    return $copied
  }

  Get-ChildItem -LiteralPath $sourceItem.FullName -Force -Recurse -File |
    Where-Object { -not (Test-ExcludedPath $_.FullName) } |
    ForEach-Object {
      $relative = [System.IO.Path]::GetRelativePath($ProjectRoot, $_.FullName)
      $target = Join-Path $StagingRoot $relative
      $targetParent = Split-Path -Parent $target
      if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force
      }
      $script:CopiedPaths += $relative
    }
  return $copied
}

function Get-SanitizedText {
  param([string]$Text)

  $lines = $Text -split "\r?\n"
  $sanitized = foreach ($line in $lines) {
    if ($line -match '^\s*[\w.-]*(API_KEY|TOKEN|SECRET|PASSWORD|KEY)\s*=') {
      $line -replace '=.*$', '= "***REDACTED***"'
    } else {
      $line
    }
  }
  return ($sanitized -join "`n")
}

if (-not (Test-Path -LiteralPath $OutputPath)) {
  if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
  }
}

if ((Test-Path -LiteralPath $StagingRoot) -and -not $DryRun) {
  Remove-Item -LiteralPath $StagingRoot -Recurse -Force
}

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $StagingRoot | Out-Null
}

$script:CopiedPaths = @()

foreach ($file in $IncludeFiles) {
  $script:CopiedPaths += Copy-SafeItem -RelativePath $file
}

foreach ($dir in $IncludeDirs) {
  Copy-SafeItem -RelativePath $dir | Out-Null
}

if ($IncludeCodexConfig) {
  $codexConfig = Join-Path $env:USERPROFILE ".codex\config.toml"
  if (Test-Path -LiteralPath $codexConfig) {
    $relative = "codex-config\config.toml.redacted"
    if (-not $DryRun) {
      $target = Join-Path $StagingRoot $relative
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
      $raw = Get-Content -LiteralPath $codexConfig -Raw
      Set-Content -LiteralPath $target -Value (Get-SanitizedText $raw) -Encoding UTF8
    }
    $script:CopiedPaths += $relative
  }
}

$autoMemBackupStatus = "skipped"
if ($IncludeAutoMemApi) {
  if ([string]::IsNullOrWhiteSpace($AdminToken)) {
    $autoMemBackupStatus = "skipped: AUTOMEM_ADMIN_TOKEN/AdminToken not provided"
  } else {
    $backupTarget = Join-Path $StagingRoot "automem\automem-backup-$Timestamp.tar.gz"
    if (-not $DryRun) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupTarget) | Out-Null
      Invoke-WebRequest `
        -Uri "$AutoMemUrl/backup" `
        -Headers @{ "X-Admin-Token" = $AdminToken } `
        -OutFile $backupTarget `
        -TimeoutSec 120 | Out-Null
    }
    $script:CopiedPaths += "automem\automem-backup-$Timestamp.tar.gz"
    $autoMemBackupStatus = "included"
  }
}

$manifest = @"
# Safe Backup Manifest

- Created: $(Get-Date -Format o)
- Project root: $ProjectRoot
- Archive: $ArchivePath
- AutoMem API backup: $autoMemBackupStatus
- Codex config snapshot: $IncludeCodexConfig

## Included Roots

$($IncludeFiles + $IncludeDirs | ForEach-Object { "- $_" } | Out-String)

## Excluded

- secrets: .env, .env.local, .env.* except .env.example
- heavy/generated: work/, tmp/, node_modules/, .codewhale-home/, backups/
- repository internals: .git/
- local app folders: .codex/, .agents/
- key/certificate patterns: *.key, *.pem, *.pfx

## Copied Paths

$($script:CopiedPaths | Sort-Object -Unique | ForEach-Object { "- $_" } | Out-String)
"@

if ($DryRun) {
  "Dry run: no files written."
  $manifest
  exit 0
}

Set-Content -LiteralPath (Join-Path $StagingRoot "BACKUP_MANIFEST.md") -Value $manifest -Encoding UTF8

if (Test-Path -LiteralPath $ArchivePath) {
  Remove-Item -LiteralPath $ArchivePath -Force
}

Compress-Archive -Path (Join-Path $StagingRoot "*") -DestinationPath $ArchivePath -CompressionLevel Optimal
Remove-Item -LiteralPath $StagingRoot -Recurse -Force

"Created safe backup:"
$ArchivePath
