# Agent Shell

Purpose: provide a small Unix-like working shell for Codex tasks while the host
remains Windows.

## Why

PowerShell is useful, but it has repeatedly caused friction for scripts that
want Unix-style quoting, arrays, JSON, pipes, and long-running diagnostics. This
folder provides two escape hatches:

- `scripts/agent-bash.ps1`: immediate Git Bash wrapper, no Docker build.
- `scripts/agent-shell.ps1`: Docker-backed Linux shell, more repeatable.

## Quick Use

Git Bash:

```powershell
.\scripts\agent-bash.ps1 -Command "pwd && uname -a"
```

Docker shell:

```powershell
.\scripts\agent-shell.ps1
```

Docker one-shot:

```powershell
.\scripts\agent-shell.ps1 -Command "python3 --version && jq --version"
```

## Intended Boundary

Use this shell for repo-local scripting, data transforms, JSON inspection,
SQLite checks, and small Python helpers.

Keep Docker Desktop, Windows-specific services, secrets, and GUI work on the
host side. The shell is a workbench, not a replacement operating system.
