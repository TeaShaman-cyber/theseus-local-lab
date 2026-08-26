# Hindsight Codex Memory Integration Audit — 2026-08-27

## Decision

Provisioned a separate Hindsight memory bank named `codex` and integrated it
through the existing project hook router. Hermes remains isolated on bank
`hermes`; AutoMem remains the primary durable Theseus memory layer.

## Runtime behavior

- `UserPromptSubmit` calls the local Hindsight recall endpoint and, when hits
  exist, returns bounded `hookSpecificOutput.additionalContext`.
- `Stop` reads the Codex transcript and submits an asynchronous retain request
  keyed by the Codex session ID.
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
- Read-only recall smoke completed against local Hindsight without creating a
  document.

## Rollback

Remove the Hindsight calls from `hooks/hook-router.mjs` and delete
`hooks/hindsight-memory-hook.mjs`; leave the isolated bank intact unless a
separate, explicitly approved data-deletion operation is requested. Restore
the prior Hindsight-free wording in `HOOKS_PIPELINE.md`.

## Follow-up

Add focused tests with a local fake Hindsight server for recall context,
retain payload shape, timeout behavior, and transcript redaction before using
the integration for long-running production sessions.
