# Session Timeline

Purpose: append small timestamped events that make agent/session behavior
auditable without storing hidden reasoning, secrets, or raw transcripts.

This complements `tools/session_journal`:

- `session_journal` is a compact markdown snapshot.
- `session_timeline` is append-only JSONL for time-series reconstruction.

## Event Shape

Each event is written to:

```text
outputs/session_timeline/YYYY-MM-DD.jsonl
```

Fields:

- `created_at`: UTC ISO timestamp.
- `local_time`: local ISO timestamp with timezone offset.
- `source`: where the observation came from, for example `codex`,
  `user-ui`, `automem`, `vscode`, `docker`, `git`, or `manual`.
- `event`: short machine-readable event name.
- `note`: short human-readable observation.
- `context_percent`: optional visible context window percentage.
- `limit_percent_remaining`: optional visible usage percentage remaining.
- `artifacts`: optional file paths, commit ids, or memory ids.
- `tags`: optional small labels.
- `metrics`: optional key/value numbers or strings.

## Shared Writer

Use `tools/session_timeline/event_writer.mjs` from other local tools instead of
hand-writing JSONL or HTTP mirroring logic. It writes the local JSONL edge buffer
and mirrors to the Docker `log-lattice` sink by default:

```text
http://127.0.0.1:8768/events
```

Sink failures are fail-soft by default: the local JSONL event is still written
if Docker or `log-lattice` is asleep.

Environment controls:

- `THESEUS_TIMELINE_URL`: override the sink URL.
- `THESEUS_TIMELINE_DISABLE_SINK=1`: write only local JSONL.
- `THESEUS_TIMELINE_STRICT_SINK=1`: fail the caller when mirroring fails.

Current producers:

- `tools/session_timeline/timeline.mjs`: manual events.
- `tools/memory_hook/memory_hook.mjs`: checkpoint, compact, and handoff events.
- `tools/tool_policy/tool_policy.mjs --log`: route critic decisions.
- `tools/harness_errors/harness_errors.mjs`: scan summaries and signature counts.

## VS Code

Run:

```text
Theseus Timeline: add manual event
```

## Terminal

```text
node tools/session_timeline/timeline.mjs add --source user-ui --event limit-note --limit-percent-remaining 42 --note "No warning after long session"
node tools/session_timeline/timeline.mjs list --limit 20
```
