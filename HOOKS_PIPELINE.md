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
    -> UserPromptSubmit: memory preflight + model-switch guard
       + skill observatory; research queue only with THESEUS_HOOK_RESEARCH=1
    -> PostToolUse: router support exists, but the project manifest does not
       register this event; queue only with THESEUS_HOOK_RESEARCH=1
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

Codex can load hooks from user-level or project-level config layers. Matching
hooks from multiple layers are all executed; a higher-precedence layer does not
replace lower-precedence hooks.

- `~/.codex/hooks.json`
- `~/.codex/config.toml`
- `<repo>/.codex/hooks.json`

For this project the ownership split is:

- `hooks/codex-hooks.json` — tracked source of truth;
- `<repo>/.codex/hooks.json` — ignored generated runtime copy;
- `~/.codex/hooks.json` and `~/.codex/config.toml` — user/global layer;
- enabled plugin manifests, including trigger-tree — independent plugin-bundled
  observers;
- `[hooks.state]` in `~/.codex/config.toml` — trust/hash metadata, not hook
  definitions.

Install or refresh the ignored runtime copy without embedding a machine-specific
project path:

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
- `Stop`: refresh usage, pressure, and skill-observatory state.
- `PreCompact`: write a compact state packet through `tools/memory_hook`.
- `PostCompact`: write a recovery checkpoint and refresh context-pressure
  status after compaction.
- `PostToolUse` is supported by `hook-router`, but is intentionally not
  registered in the project manifest.

### Research queue policy

Research follow-up is explicit opt-in:

- an ordinary `UserPromptSubmit` does not enqueue research;
- `PostToolUse` does not enqueue research by default;
- `THESEUS_HOOK_RESEARCH=1` enables the queue for an event already routed by
  `hook-router`.

The topic, reason, connector list, privacy label, and tags continue to come
from the existing `THESEUS_HOOK_*` variables.

### Fail-soft semantics

- Optional observability or research failures do not block the main turn.
- `skill_observatory` exit code `2` on `Stop` is a review warning, not a hard
  lifecycle failure.
- Critical memory/checkpoint failures remain visible in the hook status message.
- Trigger-tree and the project router are treated as independent observers until
  runtime telemetry proves whether any event is duplicated.

Keep lifecycle hooks fail-soft and non-blocking. Add blocking hooks only after a
route proves useful, quiet, and safe under real Codex restarts.

## Smoke Tests

```text
node --check hooks/hook-policy.mjs
node --check hooks/hook-router.mjs
node --check tools/hook_config/check_hooks.mjs
node tools/hook_config/check_hooks.mjs
node --test hooks/hook-router.test.mjs
```

The same checks are available in VS Code tasks:

- `Theseus: AgentOps/GitOps contract check`
- `Theseus: Hooks and contract tests`

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
