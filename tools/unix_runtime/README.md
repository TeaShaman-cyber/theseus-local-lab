# Unix Runtime Probe

This is a manual, read-only Unix tool layer for the Windows-native Codex
agent. It does not move Codex into WSL and it does not change global Codex
configuration, hooks, MCP profiles, memory services, Docker volumes, or VM
state.

## Probe one backend

Run the VS Code task `Theseus Unix Runtime: probe backend` and select exactly
one backend:

- `wsl` — the primary Unix route, using an explicit WSL distribution and Linux
  working directory;
- `docker` — a separate read-only Docker engine version probe;
- `ubuntu-vm` — the configured SSH alias, which may be unavailable when the VM
  is powered off or unreachable.

Family Research also has a separate manual task, `Family Research: codex-do
read-only probe`. It targets the explicit `codex-do` SSH host/user and the
fixed `/root/workspaces/family-research-lab` workspace. It is not an alias for
`ubuntu-vm`, WSL, or Docker and never falls back between those backends.

The task never tries another backend when the selected one fails. Every JSON
receipt reports the selected backend, status, bounded output, exit outcome,
postcondition, and `fallback_used: false` in phase one.

The equivalent CLI form is:

```text
node tools/unix_runtime/unix_runtime.mjs probe --backend wsl
```

Add `--no-log` for a receipt without a session-timeline write. The CLI accepts
bounded backend options such as `--distro`, `--cwd`, and `--host`; it does not
accept arbitrary shell commands.

## Scope boundary

Only `read-only` probes are available in this phase. `scoped-write` remains
rejected until a separate task catalogue defines allowlisted operations,
artifact boundaries, and independent postconditions. WSL, Docker, the Ubuntu
VM, and `codex-do` are separate routes for explicit tool work, not startup
services for Codex, hooks, AutoMem, MemPalace, Graphify, or Sonar.
