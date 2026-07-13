# Theseus Local Lab Agent Guide

This file is the short entry map for agents working in this repository. Keep it
small. Put procedures in scripts, detailed references in docs, and durable
lessons in AutoMem/MemPalace.

## Route First

Before non-trivial work, use the smallest matching project skill:

- `.agents/skills/theseus-skill-router/SKILL.md` for route choice and skill
  priority conflicts.
- `.agents/skills/theseus-memory-stack/SKILL.md` for prior context, handoff,
  memory, decisions, or continuity.
- `.agents/skills/theseus-shell-routing/SKILL.md` before shell, Docker, WSL,
  JSON/text processing, or quoting-sensitive work.
- `.agents/skills/theseus-copilot-advisor/SKILL.md` for narrow GitHub, VS Code,
  GitHub Actions, Wiki, Issues, Projects, or Copilot tooling advice.
- `C:/Users/s.poklad/.codex/skills/local-agent-hygiene/SKILL.md` for local
  infrastructure, VS Code tasks, Docker Desktop, and repeated checks.
- `C:/Users/s.poklad/.codex/skills/theseus-git-hygiene/SKILL.md` for Git,
  GitHub sync, commits, pushes, and secret-sensitive staging.

If two routes are plausible, prefer the one with lower user friction, stronger
verification, and less context load.

Think of project skills and task runners as two halves of one harness:

- skills choose when and why to use a route;
- VS Code tasks, scripts, and MCP tools execute the route;
- AutoMem/MemPalace preserve why the route changed;
- `session_timeline` and `log-lattice` preserve what happened.

## Memory

AutoMem is the primary durable memory. MemPalace is the episodic/verbatim layer
when available. Local files are evidence and fallback, not the first memory
system.

Store only durable decisions, reusable patterns, root causes, and explicit user
preferences. Never store secrets, API keys, raw transcripts, raw memory dumps,
or backup archives.

## Shell And Services

Prefer VS Code tasks, MCP tools, WSL, Node scripts, or small checked-in helpers
over long PowerShell commands. Treat Codex shell, normal Windows user, Docker
Desktop, WSL, VS Code, and VMs as separate contexts until runtime proof says
otherwise.

Docker and observability work should favor the existing narrow tools:

- `tools/tool_policy`
- `tools/session_timeline`
- `tools/harness_errors`
- `tools/memory_hook`
- `tools/copilot_advisor`
- `log-lattice`
- `backup-lattice`

## Documentation

Do not turn this file into the project manual. For documentation work, start
with `docs/plans/documentation_audit.md` and produce a map before rewriting
large sections.

Use a Diataxis-style split:

- tutorials: first successful path for a newcomer;
- how-to guides: concrete operational tasks;
- reference: commands, services, schemas, ports, configuration;
- explanation: architecture, decisions, tradeoffs, research context.

## Git Safety

Stage explicit paths. Before committing, run the repository secret/staging
scanner:

```text
node tools/git_safety/scan_staged.mjs
```

Stop before committing if staged files include secrets, `.env`, `.env.local`,
private keys, raw transcripts, raw memory, or backup archives.
