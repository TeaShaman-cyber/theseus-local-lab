# Theseus Local Lab Agent Guide

This file is the short entry map for agents working in this repository. Keep it
small. Put procedures in scripts, detailed references in docs, and durable
lessons in AutoMem/MemPalace.

## North Star

Codex is the current lead harness because Theseus has accumulated expertise,
tools, memory, and trust around this environment. It is not the final substrate.

Design for platform independence without losing the agent relationship, memory,
style, or engineering process. Externalize durable state into memory, routes,
secrets, logs, checks, skills, dashboards, worker profiles, and evidence
packets so the workshop can survive model, provider, IDE, OS, or harness
changes.

## Harness Ownership Boundary

This repository is the Theseus local-lab project and currently uses Codex as its
lead harness. It is **not** the Hermes runtime directory. Keep the following
layers separate:

| Layer | Owner | Source of truth |
|---|---|---|
| Codex project skills | Theseus/Codex project | `skills-codex/` or an existing `.agents/skills/` path in this checkout |
| Codex runtime skills | Codex | `C:/Users/s.poklad/.codex/skills/` |
| Hermes runtime skills/plugins | Hermes | `%HERMES_HOME%/skills/` and `%HERMES_HOME%/plugins/` |
| OSINT harness adapters | Theseus OSINT repo | `D:/theseus-osint/harnesses/<harness>/` in this environment |
| Harness-neutral research | Shared | `D:/theseus-osint/harnesses/shared/` and `research/` |

Rules:

- A runtime copy is not a project source file. Do not infer ownership from a
  filename alone; resolve the harness and source path first.
- `backups/codex-skills/` is historical evidence, not an active skill source.
- If a referenced `.agents/skills/<name>/SKILL.md` path does not exist in the
  current checkout, stop and route to the canonical source or runtime owner;
  do not silently substitute a Hermes skill with the same name.
- Hermes MCP names, slash commands, `$HERMES_HOME`, and Hermes plugin paths do
  not belong in Codex-only skills. Codex-specific commands do not belong in
  Hermes skills.
- Put portable contracts, schemas, evidence formats, and research procedures
  in `D:/theseus-osint/harnesses/shared/`; put the executable adapter under its
  owning harness directory.
- Do not copy `config.yaml`, `.env`, OAuth state, API keys, private transcripts,
  raw memory, or MCP auth material between harnesses.

## Canonical Workspace And Infrastructure Registries

Before opening, creating, moving, or mutating a project or Docker stack, read:

- `docs/reference/workspace-registry.yaml` for canonical project paths,
  remotes, pilots, and archives;
- `docs/reference/infrastructure-registry.yaml` for compose sources, runtime
  roots, consumers, recovery boundaries, and stack ownership.

Rules:

- A path absent from the workspace registry is not a canonical project until it
  is classified and registered.
- `tmp/`, `work/`, `output/`, `artifacts/`, and `D:/theseus-archive/` are not
  default source roots.
- A Docker health result does not prove that a memory provider or API read path
  works; perform the relevant live read/recall check.
- Hindsight remains a Hermes-owned provider/runtime, but Codex has an explicitly
  provisioned isolated `codex` bank through the project hook route. Codex must
  not access the Hermes `hermes` bank or treat Hindsight as an unbounded
  cross-harness dependency.
- Do not add a stack to recovery or create a new compose source without an
  infrastructure-registry entry and a verified owner/runtime boundary.

See `docs/reference/README.md` for the update contract.

## Git

Правила коммитов, веток, отправки, происхождения и безопасности — в одном месте:
`docs/reference/git.md`. Машинночитаемый набор — `docs/reference/git.rules.yaml`,
проверка соответствия — `python tools/contracts/check_rules.py` (обязана давать PASS).

Коротко, что нельзя забыть: коммит — ограниченный чекпойнт одного результата,
стейджить только явные пути, перед коммитом прогнать
`node tools/git_safety/scan_staged.mjs`, в собственных репозиториях рутинная
git-работа не требует согласования на каждое действие, а мерж в защищённую
ветку, релиз, деплой и force-push — требуют.

## Project Change Control (MarcoPolo project-settings v9)

The project contract revision is `2026-10-skill-router-v9`; its canonical
source is `TeaShaman-cyber/marcopolo-cookbook/project/project-contract.wl`.
ChatGPT Project Settings are a projection, not the source of truth. A runtime
projection is current only after the probe `PROJECT_CONTRACT_PROBE` returns
`PC_OK_V9`. A merge proves the accepted Git source, not that projection.

For project-owned repositories, use this bounded DevOps loop:

```text
Issue -> scope/evidence -> atomic change -> focused QA
      -> review/read-back -> local checkpoint
      -> routine promotion only when protected boundaries stay unchanged
```

Rules:

- Create or reuse one narrow Issue before a new research line, persistent
  architecture decision, durable automation, cross-cutting repo/infra change,
  or project-level change to routing, authority, permission, persistence,
  canonical sources, verification, or acceptance.
- Keep each implementation slice reversible, reviewable, and bounded to one
  obvious next action. An Issue is a coordination/evidence container, not
  authority for unrelated repositories, releases, publication, or protected
  boundary changes.
- Routine project-owned promotion is covered only when the scope is unchanged,
  the selected base/currentness and exact head are verified, required QA/CI and
  review gates pass, no P0/P1/blocker remains, and the promotion crosses no
  permission, authority, canonical-source, publication, release, or other
  protected boundary.
- No new Issue is needed for wording/format-only fixes, mechanical maintenance
  with no behavioral or authority effect, or work already covered by an
  appropriate open Issue. Issue-first is traceability, not mandatory model
  review for every small edit.
- Record motivation, intended invariant, exact files/scope, QA commands and
  results, currentness/read-back evidence, rollback path, and final disposition
  in the Issue/PR/checkpoint. Use risk-proportional review; issue-first does not
  require a model review for every wording-only or mechanical edit.
- Treat `CONFIGURED`, `EXPOSED`, `AVAILABLE`, `INVOKED`, `COMPLETED`, and
  `VERIFIED` as different capability states. Documentation, cached state,
  visibility, authentication, or executor self-report does not prove live
  capability; claim success only after the appropriate observable postcondition.
- For prior-chat, branch, or decision reconstruction, prefer MarcoPolo
  historical evidence and Session Search. Use built-in retrieval only when the
  preferred route is unavailable or insufficient, and disclose that fallback.
- Keep project source, runtime projection, historical evidence, semantic or
  episodic memory, and operational state separate. Persist only when user
  intent, continuity, canonical record, or verified operational need requires
  it; important writes require read-back.

## Route First

Before non-trivial work, use the smallest matching project skill:

- `.agents/skills/theseus-skill-router/SKILL.md` for route choice and skill
  priority conflicts.
- `.agents/skills/theseus-memory-stack/SKILL.md` for prior context, handoff,
  memory, decisions, or continuity.
- `.agents/skills/theseus-shell-routing/SKILL.md` before shell, Docker, WSL,
  JSON/text processing, or quoting-sensitive work.
- `.agents/skills/theseus-plugin-conclave/SKILL.md` for fresh research,
  external technical second opinions, plugin selection, or a bounded
  multi-source check.
- `C:/Users/s.poklad/.codex/skills/local-agent-hygiene/SKILL.md` for local
  infrastructure, VS Code tasks, Docker Desktop, and repeated checks.
- `skills-codex/theseus-git-hygiene/SKILL.md` is the canonical repo source for Git,
  GitHub sync, commits, pushes, and secret-sensitive staging; the matching
  `.codex/skills/` copy is runtime state and may require synchronization.

If two routes are plausible, prefer the one with lower user friction, stronger
verification, and less context load.

Think of project skills and task runners as two halves of one harness:

- skills choose when and why to use a route;
- VS Code tasks, scripts, and MCP tools execute the route;
- AutoMem/MemPalace preserve why the route changed;
- `session_timeline` and `log-lattice` preserve what happened.
- `plugin_conclave` selects outside evidence or bounded advisors; it never
  replaces local verification, the memory stack, or an explicit owner for a
  write-capable external service.

## Prompt Hygiene

Keep prompts, skills, and task descriptions lean. Prefer visible outcome,
constraints, success criteria, stop conditions, and validation requirements over
long procedural scripts.

Preserve true invariants: safety, access boundaries, secret policy, required
fields, tool routing rules, and verification gates. Remove duplicated style
rules, inert examples, stale model-specific habits, and instructions for
behavior that is already reliable.

Before increasing reasoning effort, adding another advisor, or widening tool
access, check whether the task is missing a success criterion, dependency rule,
tool route, or verification loop.

## Stop-Signal And Route Correction

Treat a direct user signal that the route is wrong or that the agent is not
listening (for example, “wrong task”, “you do not understand”, or “stop”) as a
hard stop, not as more evidence for the current route.

1. Stop the current tool sequence immediately; do not start another command,
   search, advisor call, memory write, GitHub write, or file edit.
2. State briefly what was stopped and what was misunderstood. Discard the
   current route's unverified conclusions instead of extending them.
3. If the user has already made the target clear, restate that target and wait
   for confirmation. Otherwise ask one concise clarification.
4. Resume only after the target is confirmed, using the smallest bounded route
   and the minimum necessary tools. Do not spend paid connectors, compute, or
   user attention to defend a route the user has rejected.
5. After a second route-correction signal in the same turn, use no tools until
   the user explicitly confirms the resumed target.

Pending tool output never overrides a stop signal. A route is complete only
   after the user-visible target, not merely the tool sequence, is verified.

Use a blameless systems frame for continuity failures: describe the observed
behavior, system boundary, root cause, and guardrail. When the user says the
agent is not personally at fault, accept that framing without converting it
into self-criticism or an unsolicited identity/ontology disclaimer. Preserve
the established project culture and relationship contract across runtime or
model switches; do not make the user reconstruct it from scratch.

## Model And Harness Calibration

Use soft guidance for normal behavior: state the outcome, relevant context,
success criteria, and preferred route, then leave room for the agent to choose
an efficient in-scope path. Keep hard boundaries explicit for secrets, access,
external writes, destructive or costly actions, and scope expansion.

Treat GPT-5.6 family guidance as a baseline, not a promise of identical
behavior across Sol, Terra, and Luna. Recheck each model or harness change on
representative tasks, measuring tool calls, context cost, latency, side effects,
and verification results. Classify external advice as official, observed, or
hypothesis before turning it into a project rule.

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
- `log-lattice`
- `backup-lattice`

## User Codex Config Guard

Treat `%CODEX_HOME%/config.toml` as a protected runtime boundary. Prepare a
candidate file outside the live path, then use the repository guard before any
replacement:

```text
node tools/codex_config/config_guard.mjs --check --candidate <candidate.toml>
node tools/codex_config/config_guard.mjs --apply --candidate <candidate.toml>
```

The guard runs `codex --strict-config doctor --json` in an isolated temporary
`CODEX_HOME`, prints status codes only, preserves a rollback backup, and runs a
postflight check. A failed preflight makes no live change; a failed postflight
restores the previous config. If the guard or Codex executable is unavailable,
stop before touching the live file. Direct edits to the live Codex config are
not an approved workflow.

## Documentation

Do not turn this file into the project manual. For documentation work, start
with `docs/plans/documentation_audit.md` and produce a map before rewriting
large sections.

Use a Diataxis-style split:

- tutorials: first successful path for a newcomer;
- how-to guides: concrete operational tasks;
- reference: commands, services, schemas, ports, configuration;
- explanation: architecture, decisions, tradeoffs, research context.
