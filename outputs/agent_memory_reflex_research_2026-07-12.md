# Agent Memory Reflex Research

Date: 2026-07-12
Scope: why Codex stopped reflexively using AutoMem and MemPalace, and how to fix the instruction architecture without building an oversized skill.

## Current Runtime Check

AutoMem MCP is available in this session after tool discovery.

Health check:

- status: healthy
- backend: automem
- FalkorDB: connected
- Qdrant: connected
- memory_count: 119
- vector_count: 119
- sync_status: synced
- enrichment: running

MemPalace did not appear as a direct callable MCP/tool in this session. Current fallback is local/project evidence:

- `tools/junior_context/README.md`
- `tools/image_transfer/README.md`
- memory registry summaries under `C:\Users\s.poklad\.codex\memories`
- Docker/VM artifact notes for `theseus-mempalace:pilot`

## Recalled AutoMem Evidence

Relevant memories recalled read-only:

- `274127d1-f904-42c9-9aeb-dc41c817e23b`: Memory fallback rule for this Codex setup.
- `8e91a6a9-f5a5-4d82-babf-2393f5976e3e`: Plan for Stanford-style learning loop using session journal, AutoMem, and local skills.
- `26359c5d-159b-4fb6-83f2-d24cacfc8697`: Operational ritual for Palace/AutoMem work: `standup_in -> trace -> diff -> standup_out`.
- `7a205511-591f-4e06-9675-4baaa03ae8d7`: AutoMem recovered but Docker control remains split.
- `e08f99c9-a304-4ba6-b25b-b23de340b767`: Stanford AutoMem engineering status.

These memories prove the rule exists in long-term memory, but not that it is forcefully surfaced in every relevant task.

## Repo Instruction Evidence

### `AGILE.md`

States:

- AutoMem is the durable project memory for decisions, invariants, and fixes.
- Engineering work is done only when durable decisions are updated in AutoMem.
- Weekly review includes promoting durable decisions to AutoMem.

Gap:

- It describes project workflow, not an agent interrupt before complex actions.

### `CODEX_VSCODE.md`

States:

- Codex should store durable decisions in AutoMem.
- Codex and AutoMem are connected in the workflow diagram.

Gap:

- It does not say when to recall memory before acting.

### `tools/junior_context/README.md`

Strongest current protocol:

1. MemPalace for broad loci/themes/pointers.
2. AutoMem for durable decisions, lessons, patterns, and preferences.
3. Repo docs and source files for implementation details.
4. Main Codex summary as only one viewpoint.

Also states:

- Use MemPalace read-mostly.
- Prefer `search` over `mine`.
- Use AutoMem read-only recall first.
- Do not write/update/delete memories unless explicitly asked.
- Report memory IDs for important claims.

Gap:

- This is framed as a junior-agent protocol, not as the main Codex default reflex.

### `local-agent-hygiene`

States:

- Save durable lessons to session journal, SQLite log, or AutoMem.
- Use AutoMem/session journal when repeated failures appear.

Gap:

- It is triggered around local infrastructure/CLI work, not around all strategic/project-memory tasks.
- It emphasizes persistence after a lesson, not recall before decisions.

### `.codex/config.toml` and `.codex/hooks.json`

Current hooks:

- `Stop`: run `node hooks/research-queue-hook.mjs`
- `PreCompact`: run `node hooks/research-queue-hook.mjs`

Gap:

- Hooks queue research follow-ups, but do not force AutoMem recall, MemPalace search, or memory candidates.
- This is useful for continuity, but not a substitute for an agent memory reflex.

## Diagnosis

The memory reflex failed because the instruction is split across layers:

1. AutoMem knows the rule.
2. Repo docs mention the rule.
3. Junior-agent protocol states the best order clearly.
4. `local-agent-hygiene` stores lessons after repeated failures.
5. No small active skill currently says: "Before non-trivial Theseus decisions, do AutoMem recall; attempt MemPalace search or document fallback; then inspect repo docs."

This creates a priority problem:

- Main prompt/system memory guidance says to use memory when likely relevant.
- But local operational skills pull attention toward Git/VS Code/Docker/PowerShell.
- MemPalace has no direct callable tool in this session, so it silently drops out unless explicitly named.

## Recommended Fix

Do not make one giant skill.

Create or update one tiny active routing skill, for example:

`theseus-memory-reflex`

Description should front-load triggers:

> Use before non-trivial Theseus local-lab decisions, project planning, debugging, cross-session continuity, agent mentoring, Git/process changes, AutoMem/MemPalace questions, or when the user asks why Codex forgot or repeated an old mistake.

Body should be short:

1. If AutoMem tools are not visible, run tool discovery for memory.
2. Check AutoMem health when memory behavior is part of the task or recent failures suggest outage.
3. Recall 3-8 memories with focused query and active project path.
4. Attempt MemPalace search if a callable tool exists; otherwise report fallback and use local MemPalace docs/artifacts.
5. Read 1-3 relevant repo docs.
6. Separate recalled facts from inference.
7. Store only when explicitly asked, or when future policy grants write permission for durable operational lessons.

## Practical Trigger Matrix

Use AutoMem recall:

- At session start for Theseus work.
- Before changing skills, hooks, backup, Docker, Git, memory, observatory, or agent workflow.
- When debugging repeated mistakes.
- Before mentoring junior agents.
- Before summarizing project state after compaction/restart.
- Before deciding whether something is already known.

Use MemPalace:

- For broad conceptual map, loci/themes, source pointers, and junior-agent context packs.
- Prefer search/read-only.
- If direct MemPalace tool is absent, say so and use local project docs plus AutoMem.

Use session journal or memory inbox:

- For observable checkpoints, not hidden reasoning.
- For worker outputs before promotion to AutoMem.
- For pre-compact continuity.

Do not store:

- Secrets, `.env`, private keys.
- Raw AutoMem dumps.
- Raw private transcripts.
- Backup archives.
- Hidden chain-of-thought claims.

## Minimal Next Step

Add a small local skill `theseus-memory-reflex` and make `local-agent-hygiene` reference it as the first step for project-memory-sensitive work.

Then test it with prompts like:

- "Why did you repeat this old Windows/PowerShell mistake?"
- "Check whether we already decided how CodeWhale should use AutoMem."
- "Before editing Git workflow, recall relevant project memory."
- "What does MemPalace say about the Ubuntu VM pilot?"

Success criterion:

- The agent reports AutoMem health/recall IDs or explicitly says why memory is unavailable.
- The agent does not silently skip MemPalace; it either uses it or names the fallback.
- The agent keeps writes gated by explicit permission until policy changes.

