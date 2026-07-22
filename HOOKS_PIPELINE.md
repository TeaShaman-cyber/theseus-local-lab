# Hooks Pipeline

This is a small local bridge from Codex/ChatGPT Work lifecycle hooks to
Theseus memory, timeline, and connector-backed research workflows.

Hooks should not call external research connectors directly. They should capture
small, redacted, observable local events. Codex can then process queued research
items with Exa, Tavily AI, Parallel Search, Acumen by Talarion, or browser
integrations when the user asks or when a planned research pass starts.

## Flow

```text
hook event
  -> hooks/hook-router.mjs
    -> PreCompact: tools/memory_hook/memory_hook.mjs --mode compact
    -> PostCompact: tools/memory_hook/memory_hook.mjs --mode checkpoint
       + tools/context_pressure_watch/context_pressure_watch.mjs
    -> UserPromptSubmit: tools/model_switch_guard/model_switch_guard.mjs
       injects a preflight only after model/effort changes
    -> PostToolUse or THESEUS_HOOK_RESEARCH=1:
       hooks/research-queue-hook.mjs
    -> Stop: tools/usage_scout/usage_scout.mjs refreshes local usage state
       + tools/context_pressure_watch/context_pressure_watch.mjs
       + checkpoint when THESEUS_HOOK_STOP_CHECKPOINT=1
  -> local outputs first
  -> Codex processes memory drafts / research queue / timeline later
```

## Manual Enqueue

```text
node tools/research_queue/enqueue.mjs --topic "Check Codex hooks docs" --why "Need official hook schema before wiring config" --connectors "exa,parallel,tavily,acumen"
```

## List Queue

```text
node tools/research_queue/list.mjs --limit 10
```

## Hook Command

Use this command from a Codex/ChatGPT Work hook:

```text
node hooks/hook-router.mjs --event PreCompact
```

Codex can load hooks from user-level or project-level config layers:

- `~/.codex/hooks.json`
- `~/.codex/config.toml`
- `<repo>/.codex/hooks.json`

The tracked source of truth is `hooks/codex-hooks.json`. Install or refresh the
ignored runtime copy without embedding a machine-specific project path:

```bash
node tools/hook_config/apply_hooks.mjs
```
- `<repo>/.codex/config.toml`

For this repo, prefer a project-local `.codex/config.toml` once the project
layer is trusted. Inline TOML shape:

```toml
[[hooks.Stop]]
matcher = ""

[[hooks.Stop.hooks]]
type = "command"
command = "node hooks/hook-router.mjs --event Stop"
timeout = 10
statusMessage = "Routing Stop hook"
```

Useful events for this project:

- `UserPromptSubmit`: run the model-switch guard before the next agent turn.
- `PostToolUse`: queue connector/browser follow-up when routed through
  `hook-router` or when `THESEUS_HOOK_RESEARCH=1` is set.
- `PreCompact`: write a compact state packet through `tools/memory_hook`.
- `PostCompact`: write a recovery checkpoint and refresh context-pressure
  status after compaction.
- `Stop`: refresh the rollout-backed usage snapshot; set
  `THESEUS_HOOK_STOP_CHECKPOINT=1` when an additional memory checkpoint is
  needed.

Keep lifecycle hooks fail-soft and non-blocking. Add blocking hooks only after a
route proves useful, quiet, and safe under real Codex restarts.

## Smoke Tests

```text
node --check hooks/hook-router.mjs
node hooks/hook-router.mjs --event Stop
node hooks/hook-router.mjs --event PreCompact
```

Optional environment variables:

- `THESEUS_HOOK_TOPIC`
- `THESEUS_HOOK_WHY`
- `THESEUS_HOOK_CONNECTORS`
- `THESEUS_HOOK_PRIVACY`
- `THESEUS_HOOK_TAGS`
- `THESEUS_HOOK_RESEARCH=1`
- `THESEUS_HOOK_STOP_CHECKPOINT=1`

## Privacy Rules

- Do not send `.env`, API keys, raw memory dumps, backup archives, or private
  transcripts to search connectors.
- Queue files are local working data and ignored by Git.
- The hook script redacts common token/key patterns and truncates raw hook input.
- Browser fallback is for visual/logged-in UI state, not for bypassing connector
  authorization.

## First Use Cases

- Capture research questions that appear during long sessions.
- Save a compact checkpoint before context compaction.
- Queue public-source verification for claims from model conclaves.
- Record when a browser/UI page needs later inspection.

## Source Notes

Official Codex docs describe hooks as deterministic lifecycle scripts and list
common locations, event names, trust review, and inline TOML structure:

- [Codex hooks](https://developers.openai.com/codex/hooks)
- [Advanced Codex configuration](https://developers.openai.com/codex/config-advanced)
