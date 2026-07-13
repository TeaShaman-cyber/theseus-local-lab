---
name: theseus-shell-routing
description: Use before running local commands in Theseus when PowerShell, cmd, WSL, Bash, Node one-liners, Docker/Git/Infisical CLI, JSON/text processing, quoting, pipes, Windows paths, or repeated command checks are involved; choose the safest shell/tool route and avoid long fragile PowerShell command strings.
---

# Theseus Shell Routing

Use this as a pre-command reflex. Keep it small and operational.

## Route Ladder

1. For Docker status, logs, compose, and container management, prefer Docker MCP or an existing project task before raw CLI.
2. For text, JSON, filtering, pipes, hashes, multiline commands, or quoting-sensitive work, prefer `wsl bash -lc '...'`, Node, Python, or a checked-in script.
3. Use PowerShell only as a thin Windows bridge for short Windows-only checks, launching apps, or calling an already-safe script.
4. If a PowerShell command hits quoting, interpolation, ACL, pipe, or path weirdness once, stop and reroute through WSL/Node instead of patching the one-liner.
5. If a command becomes a repeated check, promote it to a VS Code task, small script, MCP route, or documented project workflow.

## Safety

- Never print secrets, raw `.env` values, private transcripts, or backup contents.
- For secret diagnostics, print only booleans, lengths, or short hash prefixes.
- Treat Codex shell, normal Windows user, Docker Desktop, VS Code, WSL, and VMs as separate contexts until runtime proof says otherwise.

## Pairing

- For Git operations, also use `theseus-git-hygiene`.
- For memory, prior decisions, or continuity, also use `theseus-memory-stack`.
- For broader local infrastructure, also use `local-agent-hygiene`.
