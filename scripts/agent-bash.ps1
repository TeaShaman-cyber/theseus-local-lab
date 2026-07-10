param(
  [string]$Command = "",
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$bash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path -LiteralPath $bash)) {
  throw "Git Bash was not found at $bash"
}

$unixProjectRoot = $ProjectRoot -replace "\\", "/"
$drive = $unixProjectRoot.Substring(0, 1).ToLowerInvariant()
$rest = $unixProjectRoot.Substring(2)
$msysPath = "/$drive$rest"

if ([string]::IsNullOrWhiteSpace($Command)) {
  & $bash -lc "cd '$msysPath' && exec bash -l"
} else {
  & $bash -lc "cd '$msysPath' && $Command"
}
