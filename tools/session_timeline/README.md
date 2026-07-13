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

