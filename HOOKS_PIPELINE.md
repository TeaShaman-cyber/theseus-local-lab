# Hooks Research Pipeline

This is a small local bridge from Codex/ChatGPT Work lifecycle hooks to a
connector-backed research workflow.

Hooks should not call external research connectors directly. They should capture
small, redacted, observable queue items. Codex can then process those items with
Exa, Tavily AI, Parallel Search, Acumen by Talarion, or browser integrations
when the user asks or when a planned research pass starts.

## Flow

```text
hook event
  -> hooks/research-queue-hook.mjs
  -> tools/research_queue/enqueue.mjs
  -> outputs/research_queue/YYYY-MM-DD.jsonl
  -> Codex processes queue with connectors/browser
  -> session journal / AutoMem / observatory notes
```

## Manual Enqueue

```powershell
node tools/research_queue/enqueue.mjs --topic "Check Codex hooks docs" --why "Need official hook schema before wiring config" --connectors "exa,parallel,tavily,acumen"
```

## List Queue

```powershell
node tools/research_queue/list.mjs --limit 10
```

## Hook Command

Use this command from a Codex/ChatGPT Work hook:

```powershell
node hooks/research-queue-hook.mjs
```

Codex can load hooks from user-level or project-level config layers:

- `~/.codex/hooks.json`
- `~/.codex/config.toml`
- `<repo>/.codex/hooks.json`
- `<repo>/.codex/config.toml`

For this repo, prefer a project-local `.codex/config.toml` once the project
layer is trusted. Inline TOML shape:

```toml
[[hooks.Stop]]
matcher = ""

[[hooks.Stop.hooks]]
type = "command"
command = "node hooks/research-queue-hook.mjs"
timeout = 10
statusMessage = "Queueing research follow-up"
```

Useful events for this project:

- `UserPromptSubmit`: queue public research questions when a prompt asks for
  external verification.
- `PostToolUse`: log connector/browser follow-up when a search or browser task
  returns incomplete evidence.
- `PreCompact`: capture a session checkpoint before context compaction.
- `Stop`: queue end-of-turn follow-up items.

Start with audit-only hooks that write queue items. Add blocking hooks only
after the queue proves useful and quiet.

Optional environment variables:

- `THESEUS_HOOK_TOPIC`
- `THESEUS_HOOK_WHY`
- `THESEUS_HOOK_CONNECTORS`
- `THESEUS_HOOK_PRIVACY`
- `THESEUS_HOOK_TAGS`

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

- https://developers.openai.com/codex/hooks
- https://developers.openai.com/codex/config-advanced
