---
name: local-agent-hygiene
description: Before running Windows CLI commands, PowerShell scripts, Docker CLI commands, GitHub tooling, local service checks, or repeatable setup tasks, check whether a VS Code task, Docker Desktop MCP tool, Copilot advisor prompt, WSL/container workflow, session journal, or SQLite/MCP log path would be safer and easier to resume.
---

# Local Agent Hygiene

Use this skill as an interrupt before touching local infrastructure. The goal is
to reduce repeated Windows/PowerShell friction and make work easier to resume
after context compaction.

## Quick Interrupt

Before typing a local command, ask:

1. Is this PowerShell, `cmd.exe`, or Windows quoting-sensitive work?
   - Prefer a VS Code task, WSL, a container, or a small Node/Python script.
2. Is this Docker status, logs, compose, or container management?
   - Check Docker Desktop MCP Toolkit or MCP catalog first.
3. Is this GitHub, CI, VS Code integration, or tooling advice?
   - Ask Copilot advisor with a safe, explicit, non-secret prompt.
4. Will this become a repeated check?
   - Codify it in `.vscode/tasks.json`, a small script, or an MCP-backed query.
5. Did this produce a durable lesson?
   - Save an observable checkpoint in the session journal, SQLite log, or AutoMem.

## Tool Choice Ladder

1. For Docker or containers, check MCP/Docker Desktop paths first.
   - Search MCP tools or Docker MCP catalog before using raw `docker`.
   - Use raw Docker CLI only for quick verification or when MCP lacks the needed
     capability.
   - If Docker CLI is needed, expect Windows pipe permission differences between
     sandbox and normal user contexts.

2. For coding and validation, prefer VS Code-native feedback.
   - Use existing `.vscode/tasks.json` tasks when available.
   - Keep lint, spell-check, shell-check, markdownlint, and GitHub integration in
     VS Code as the visible workbench.
   - Add or update tasks when a check becomes repeated.

3. For GitHub, CI, VS Code, or toolchain second opinions, ask Copilot advisor.
   - Use `tools/copilot_advisor/copilot_advisor.mjs`.
   - Send only explicit, non-secret prompts.
   - Use `COPILOT_ADVISOR_PROXY=http://127.0.0.1:10808` when v2rayN is the active
     route.
   - Treat Copilot as an advisor, not the primary agent.

4. For logs and journals, prefer normalized local artifacts.
   - Capture observable state, not hidden reasoning.
   - Use `tools/session_journal/session_journal.mjs` for snapshots.
   - Keep raw high-volume journal output ignored by Git; back it up through the
     local backup lattice.
   - If analysis becomes frequent, store normalized events in SQLite and expose
     them through MCP.

5. For Unix-like scripting, prefer WSL or a container workbench.
   - Keep Windows host scripts thin.
   - Avoid complex PowerShell quoting, JSON shaping, and long command strings.
   - Move repeatable logic into Node, Bash, Python, or containerized scripts.

## Stop Signals

Pause and reconsider the tool choice when any of these appear:

- PowerShell interpolation around variables followed by punctuation.
- Multi-line quoted command strings.
- Docker pipe permission or `Access is denied`.
- Network calls that fail only inside the sandbox.
- A command works in GUI/VS Code but not in Codex shell.
- Repeating the same manual status check more than twice.
- Any command would read or export `.env`, secrets, raw memory, backups, or raw
  private transcripts.

## Default Pattern

For a new local-infrastructure request:

1. Check whether an MCP connector/tool exists.
2. Check whether a VS Code task already exists.
3. If GitHub/tooling advice would help, ask Copilot advisor with a safe prompt.
4. Use shell commands only for narrow, observable checks.
5. Write down the durable lesson in AutoMem or a session journal snapshot when
   the user asks to preserve it or when the same failure pattern repeats.

## Boundaries

- Do not expose secrets, `.env.local`, raw memory dumps, or backup archives.
- Do not claim hidden chain-of-thought can be exported.
- Do not move the primary agent runtime to WSL until WSL, proxy, VS Code Remote
  WSL, Docker, and backup paths are verified.
- Do not add heavy observability stacks when SQLite, JSONL, and a small viewer
  are enough.
