# Windows and Script Lessons

Date: 2026-07-09

Purpose: preserve the engineering friction discovered while setting up local
AutoMem, Docker, Bothub, and the first stateful-agent telemetry prototype.

## What Resisted

- Codex runs under a restricted Windows sandbox identity, while Docker Desktop
  belongs to the normal local Windows user context.
- Direct Docker CLI access from the sandbox can fail with Docker pipe permission
  errors even when Docker Desktop and containers are healthy.
- Docker remains usable through approved/elevated command execution, and Codex
  can safely talk to local services over HTTP, e.g. `127.0.0.1:8001`.
- Network access from the normal sandbox can fail with socket-permission errors;
  Bothub and model inventory calls require approved external execution.
- Long model-conclave runs were silent until final JSON output, creating poor
  operator feedback during multi-minute runs.
- Heavy council runs can involve many sequential calls: stage 1 model answers,
  stage 2 peer reviews, then chair synthesis.
- Some model responses may truncate at `MaxTokens`, so peer review should judge
  completeness and not just content quality.
- This workspace has a `.git` entry, but `git status` reports it is not a normal
  Git repository; avoid relying on Git diff until that is clarified.

## Changes Made

- `scripts/bothub-council.ps1` now supports:
  - `-PromptFile`
  - `-OutputPath`
  - `-TimeoutSec`
  - progress logging to stderr
  - `-Quiet`
- `stage1` and `stage2` are forced to arrays so the JSON schema stays stable
  when a council has only one model.
- Smoke tests:
  - `tmp/bothub-council-progress-smoke.json`: progress logging visible.
  - `tmp/bothub-council-array-smoke.json`: quiet mode and stable array output.
- The council result is saved to JSON before summarization, so the large output
  does not need to remain in live context.
- A digest file is used as the preferred human/Codex reading surface.

## Operational Pattern

- Prefer local HTTP health checks over direct Docker pipe access when possible.
- Ask for approved external execution only for real Docker/network operations.
- Keep scripts quiet on stdout when they need to return machine-readable JSON;
  progress should go to stderr.
- In PowerShell interpolated strings, use `${name}:` when a variable is followed
  by a colon. Plain `$name:` is parsed as a scoped-variable form and can break
  the script.
- For old Windows hardware, prefer one-shot or low-cadence jobs before cron.
- Treat failures and friction as first-class telemetry, not embarrassment.

## Unix-Like Workbench Decision

- WSL exists as a Windows component, but no Linux distribution is installed yet.
- Git Bash works now and can provide an immediate lightweight Unix-like shell.
- A Docker-backed `agent-shell` workbench was added for repeatable Linux-style
  tasks without committing to a full VM or WSL distro install.
- The first `agent-shell` wrapper smoke test exposed a command-splitting issue:
  Docker treated the entire command string as an executable. The wrapper now
  runs non-interactive commands through `bash -lc`.
- Preferred order:
  1. Git Bash wrapper for tiny commands and quoting-sensitive scripts.
  2. Docker `agent-shell` for repeatable Python/Node/SQLite/jq work.
  3. WSL Ubuntu/Debian only if Docker shell proves insufficient.
  4. Full VM only if isolation or Linux services require it.

## Doctor Script Findings

- Added `scripts/doctor.ps1` as the first repeatable environment health check.
- Normal sandbox:
  - AutoMem and Git Bash are ok.
  - Docker and agent-shell fail through Docker pipe/config permissions.
  - `.git` exists but is empty, so this workspace is not currently a valid Git
    repository.
  - `winget` is not visible.
- Approved/elevated context:
  - Docker, agent-shell, AutoMem, Git Bash, Chocolatey, Git, and winget are ok.
  - `.git` remains empty.
  - `safe.directory` differs by execution identity.
- Chocolatey correction: `Get-Command choco` showed file version `0.12.1.0`,
  but `choco --version` reports the actual CLI version `2.7.3`.

## Next Script Improvements

- Add partial checkpoint files after stage 1 and stage 2 of Bothub council runs.
- Add a compact cost/tokens summary generator for council JSON files.
- Add local system metrics to `stateful-agent-net`: CPU temperature if available,
  RAM pressure, disk pressure, and network latency.
- Add a 14-day runner only after the one-shot collector remains stable.
