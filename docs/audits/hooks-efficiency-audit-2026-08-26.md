# Hooks Efficiency Audit — 2026-08-26

## Baseline

- The hook router had one integration test for `UserPromptSubmit`.
- `hooks/codex-hooks.json` and `.codex/hooks.json` were identical, but no
  read-only parity check existed.
- The global Codex trust state included project hooks and trigger-tree plugin
  observers for overlapping lifecycle events.
- Research queueing was implicit for every `UserPromptSubmit` and routed
  `PostToolUse` event.
- `PostToolUse` was supported by the router but was not registered in the
  project manifest.

## Decision

- Research queueing is now explicit opt-in through
  `THESEUS_HOOK_RESEARCH=1` for all routed events.
- `hooks/hook-policy.mjs` owns the pure queue policy.
- `tools/hook_config/check_hooks.mjs` compares the tracked manifest with the
  generated runtime copy without writing either file.
- The tracked and runtime manifests remain separate by ownership; the runtime
  copy remains ignored and is refreshed with `apply_hooks.mjs`.
- Trigger-tree, global Codex configuration, memory provider semantics, and
  secret material are unchanged.
- Lifecycle behavior remains fail-soft.

## Evidence

Commands run in the isolated `codex/hooks-efficiency` worktree:

```text
node --check hooks/hook-policy.mjs
node --check hooks/hook-router.mjs
node --check tools/hook_config/check_hooks.mjs
node tools/hook_config/apply_hooks.mjs
node tools/hook_config/check_hooks.mjs
node --test hooks/hook-router.test.mjs
node -e "import('./hooks/hook-policy.mjs').then(({shouldQueueResearch}) => { if (shouldQueueResearch('UserPromptSubmit', {})) process.exit(1); if (!shouldQueueResearch('UserPromptSubmit', {THESEUS_HOOK_RESEARCH:'1'})) process.exit(1); console.log('POLICY_OK'); })"
git diff --check
```

Observed result:

```text
3 tests passed, 0 failed
```

The parity test reported `HOOKS_MATCH`. The policy test covers ordinary,
disabled, empty, missing, and explicit opt-in values.

Before the legacy cleanup and recovery-test reconciliation, the repository-wide
`node --test` run reported `165 passed, 3 failed`: two
`codex_thread_relink` cases required a temporary SQLite state, and the
`workshop_recovery` contract expected a stale eight-stack/keychain shape. The
relink tests and migration outputs were removed; the recovery test now derives
its expected IDs from the current seven-stack manifest.

After the cleanup and recovery-test reconciliation, the repository-wide
`node --test` run completed with `166 passed, 0 failed`.

The hook-efficiency portion of the change is limited to:

```text
HOOKS_PIPELINE.md
hooks/hook-policy.mjs
hooks/hook-router.mjs
hooks/hook-router.test.mjs
tools/hook_config/check_hooks.mjs
docs/audits/hooks-efficiency-audit-2026-08-26.md
```

The separate migration legacy cleanup is recorded in
`docs/audits/legacy-cleanup-2026-08-26.md`.

The generated `.codex/hooks.json` runtime copy is ignored and was refreshed
locally for the parity check; it is not part of the tracked change.

Final verification commands are documented in `HOOKS_PIPELINE.md` and include
syntax checks, parity, tests, `git diff --check`, and a scoped status review.

## Rollback

To roll back this change, restore the previous implicit queue condition in
`hooks/hook-router.mjs`, remove `hooks/hook-policy.mjs` and its policy tests,
remove the parity checker/test, and revert the corresponding documentation and
audit note. Do not change global Codex configuration or trigger-tree plugin
state as part of rollback.

## Follow-up

- Measure duplicate `UserPromptSubmit` and `Stop` execution across project and
  trigger-tree observers using runtime telemetry.
- Decide separately whether a narrow `PostToolUse` matcher is worth registering.
