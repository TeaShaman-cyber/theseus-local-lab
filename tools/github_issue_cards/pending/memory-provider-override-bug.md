status: READ_BACK_VERIFIED
operation: create
project: theseus-local-lab
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 85622
purpose: Bug report — external memory provider (AutoMem, mode both) suppresses built-in MEMORY.md/USER.md injection on new chat, contradicting the documented "additive, never replacing" contract; project AGENTS.md also not surfaced (CWD resolves to HERMES_HOME, not workspace root).
approval_scope: publish bug report to NousResearch/hermes-agent via gh issue create (one operation), then read-back.
observed: https://github.com/NousResearch/hermes-agent/issues/85622
verified_at: 2026-08-13T23:30:00+03:00

## Title
[Bug]: External memory provider (mode both) suppresses built-in MEMORY.md/USER.md injection on new chat — contradicts documented "additive, never replacing" contract

## Description
The documentation states the external memory provider is **additive**, not a replacement:

- memory-providers guide: *"The built-in memory (MEMORY.md / USER.md) continues to work exactly as before. The external provider is additive."* and *"External providers run alongside built-in memory (never replacing it)."*
- memory guide: built-in `MEMORY.md` / `USER.md` in `~/.hermes/memories/` are *"injected into the system prompt as a frozen snapshot at session start"* (Layer 5/6 in the prompt-assembly doc).

In practice, when an external provider is active (verified with AutoMem `mode both`), the new-chat system prompt contains the provider's ambient-recall block but **not** the built-in `MEMORY.md` / `USER.md` content. The built-in files still exist on disk and are not corrupted — they simply are not injected. The agent silently loses its durable notes on every new chat while a provider is on.

Observed on Hermes (Windows 11, 2026-08-13):
- `HERMES_HOME/memories/MEMORY.md` exists (written 2026-08-12, ~3 KB) but its content is absent from the new session's system prompt.
- Session opens with the AutoMem ambient-recall block (`memory.provider=automem`, `mode both`) instead of the built-in frozen snapshot.
- `hermes memory status` reports the provider active; no indication that built-in injection was skipped.
- Result: the agent cannot tell which memory source is active (file vs provider), and acts on incomplete context — exactly the "memory vs runtime" confusion the docs/prompt-assembly layering is supposed to prevent.

### Related observation (separate root cause, same symptom class)
The project's `AGENTS.md` is also not surfaced from the actual workspace. Per the prompt-assembly doc, context files (Layer 8) resolve by priority with `AGENTS.md` from **CWD only** (independent of memory layers). Here `hermes status` reports `Project: C:\Users\s.poklad\AppData\Local\hermes\hermes-agent` — i.e. the runtime treats `HERMES_HOME` as the project/CWD, not the user's open workspace (`Documents/Codex/2026-07-08/life-science-research-plugin-life-science-4`). So the workspace-root `AGENTS.md` (project guide) is never injected, and `HERMES_HOME/AGENTS.md` (an AutoMem rules block) stands in. This is a CWD/project-resolution issue, not strictly the provider override, and may warrant its own issue — noted here because both produce "agent has wrong/missing context at session start." Closely related existing issues (NOT duplicates — those cover provider *tools* injection, not built-in file suppression): #81427 (provider tools not injected in desktop sessions), #47119 (provider tools sometimes not injected), #74578 (provider "active" but never registers).

## Steps to Reproduce
1. Configure an external memory provider (e.g. AutoMem `mode both`) via `hermes --mode both` / `memory.provider=automem`.
2. Write durable notes into built-in `MEMORY.md` (`HERMES_HOME/memories/MEMORY.md`).
3. Start a NEW chat session.
4. Inspect the system prompt: provider ambient-recall block present, built-in `MEMORY.md` content absent.
5. (Related) Open a project whose workspace root has an `AGENTS.md` different from `HERMES_HOME/AGENTS.md`; run `hermes status` to see which directory is reported as Project/CWD.

## Expected Behavior
Per documentation: with a provider active, built-in `MEMORY.md`/`USER.md` are STILL injected (frozen snapshot, Layer 5/6) alongside the provider block, and a visible marker indicates which memory source is active. The workspace root of the open project is the resolved CWD for `AGENTS.md` injection.

## Actual Behavior
With the provider active, built-in `MEMORY.md`/`USER.md` are not injected at new-chat start; only the provider block appears. No error, no warning, no "source" marker. (Related: CWD resolves to `HERMES_HOME`, so project `AGENTS.md` is not surfaced.)

## Affected Component
- Agent Core (context injection, session start, memory)
- Memory (built-in files vs external provider layering)

## Environment
- OS: Windows 11 Pro
- Hermes Version: v0.20.0 (2026.8.3) · upstream 7113a692 · local ed5e17f4
- Python Version: 3.11.15
- Node Version: v24.18.0 (MCP stdio runtime)
- Memory provider: AutoMem (`mode both`, `memory.provider=automem`)

## Debug Report
Uploaded with user's explicit permission for this issue (chat transcript is the repro).
- Report: https://paste.rs/1LZHq
- agent.log: https://paste.rs/lcgy9
- gui.log: https://paste.rs/q038a
- desktop.log: https://paste.rs/lhEPk
(Pastes auto-delete in 6 hours; request `hermes debug delete <url>` to remove early.)
On-disk evidence: `HERMES_HOME/memories/MEMORY.md` present (written 2026-08-12) but absent from new-chat system prompt; `hermes status` reports Project = `HERMES_HOME/hermes-agent`.

## Hypothesis
The session context builder prioritizes the external provider's ambient-recall payload and does not merge/render the built-in frozen snapshot when a provider is active, violating the documented "additive" contract. Separately, project/CWD resolution defaults to `HERMES_HOME` rather than the open workspace, so `AGENTS.md` injection (CWD-only) never sees the project root. Both are symptoms of missing "source of truth" contracts — see also #84340 (memory-file placement contract) and #84772 (MCP dispatch desync).

## Proposed Fix
- When a provider is active, still inject built-in `MEMORY.md`/`USER.md` (additive, as documented) and mark which source each block came from.
- Add a visible "memory source: file | provider | both" marker to the system prompt.
- Resolve `AGENTS.md` CWD from the open workspace root, falling back to `HERMES_HOME` only when no project is open.

## Additional Logs / Traceback
Session system prompt opened with:
  MEMORY LAYER: AutoMem native provider (read) + MCP server (write) via `hermes --mode both`. memory.provider=automem; ...
  (provider context present; built-in MEMORY.md content absent)
`hermes status` reports Project: `C:\Users\s.poklad\AppData\Local\hermes\hermes-agent` — not the user's actual workspace, confirming AGENTS.md CWD resolution defaults to HERMES_HOME.

## Signature
Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner.
Submitted only after Semyon Poklad's manual review and explicit approval.
