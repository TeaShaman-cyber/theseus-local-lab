# Hindsight Codex Memory Integration Audit — 2026-08-27

## Decision

Provisioned a separate Hindsight memory bank named `codex` and integrated it
through the existing project hook router. Hermes remains isolated on bank
`hermes`; AutoMem remains the primary durable Theseus memory layer.

## Runtime behavior

- `UserPromptSubmit` calls the local Hindsight recall endpoint and, when hits
  exist, returns bounded `hookSpecificOutput.additionalContext`.
- `Stop` reads the Codex transcript, projects only textual message content, and
  submits an asynchronous retain request keyed by the Codex session ID.
- The shared text-safety module extracts only textual message content from JSONL
  transcripts; record envelopes and metadata are not retained.
- Credential-bearing transcript projections are rejected fail-closed. Local
  paths, URLs, email addresses, and other supported private values are redacted
  before a safe projection can be retained.
- Both the Hindsight projection and memory-gate content are bounded to 4000
  characters.
- Accepted events are flushed to AutoMem and MemPalace through separate
  projections, each tracked by the same stable event ID.
- AutoMem and MemPalace provider success is not inferred from transport exit
  status alone: AutoMem requires receipt plus matching fetch; MemPalace requires
  checkpoint drawer receipt plus `mempalace_get_drawer` read-back matching the
  drawer ID, wing, room, and exact content.
- The adapter is fail-soft: network, parse, transcript, and endpoint errors are
  written to stderr and exit successfully so the Codex turn is not blocked.
- No second Hindsight manifest is installed; the project router is the sole
  Codex owner for these events.

## Evidence

- Hindsight bank `codex` created and read back from `/profile` and `/config`.
- Bank missions restrict retention to durable engineering knowledge and exclude
  secrets, credentials, raw transcripts, and transient output.
- `node --check hooks/hindsight-memory-hook.mjs` passed.
- `node --check hooks/hook-router.mjs` passed.
- `node --test hooks/hook-router.test.mjs` passed (3/3).
- `node --test hooks/hindsight-memory-hook.test.mjs` passed (2/2).
- `node --test tools/memory_gate/text_safety.test.mjs tools/memory_gate/memory_gate.test.mjs` passed (6/6).
- Read-only recall smoke completed against local Hindsight without creating a
  document.
- Live bounded `Stop` smoke wrote one event, then AutoMem recall and MemPalace
  semantic search both returned the expected event/checkpoint.
- Isolated MemPalace receipt tests passed (2/2): mismatched read-back remains
  pending, while matching drawer read-back permits processing. The tests use a
  fake mcporter process and do not write to the live MemPalace service.

## Rollback

Remove the Hindsight calls from `hooks/hook-router.mjs` and delete
`hooks/hindsight-memory-hook.mjs`; leave the isolated bank intact unless a
separate, explicitly approved data-deletion operation is requested. Restore
the prior Hindsight-free wording in `HOOKS_PIPELINE.md`.

## Follow-up

The focused fake-Hindsight retain tests now cover payload projection, bounded
content, credential rejection, and redaction. Router child execution and
provider AutoMem/MemPalace calls now have bounded 5000 ms default timeouts, and
router-level provider error aggregation considers both child exit status and
provider JSON `pending`. Focused tests use isolated fake processes and do not
call the real Hindsight or MemPalace endpoints.
