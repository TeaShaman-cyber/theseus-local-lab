param(
  [string]$Command = "bash",
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ShellDir = Join-Path $ProjectRoot "agent-shell"
Push-Location $ShellDir
try {
  if ($Command -eq "bash") {
    docker compose run --rm agent-shell bash
  } else {
    docker compose run --rm agent-shell bash -lc $Command
  }
}
finally {
  Pop-Location
}
