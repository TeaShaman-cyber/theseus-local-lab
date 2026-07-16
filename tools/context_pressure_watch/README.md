# Context Pressure Watch

Small read-only guard for context compaction hygiene.

It does not trigger Codex compaction. It watches local signals and makes the
need for a compact checkpoint visible:

- latest `usage_scout` snapshot;
- latest compact state packet age;
- latest session timeline freshness;
- estimated active turn token pressure when `model_context_window` is visible.

When run with `--checkpoint`, it writes a compact state packet through
`tools/memory_hook` only if pressure is warning/failing and the latest packet is
older than the configured minimum age. This avoids checkpoint spam.

```text
node tools/context_pressure_watch/context_pressure_watch.mjs
node tools/context_pressure_watch/context_pressure_watch.mjs --checkpoint
node tools/context_pressure_watch/context_pressure_watch.mjs --no-refresh-usage
```

By default the watcher refreshes `usage_scout` before reading
`outputs/usage_scout/latest.json`. This avoids stale quota warnings after
weekly reset events or app restarts. Use `--no-refresh-usage` only for a
strictly read-only cache check.

Outputs:

```text
outputs/context_pressure/latest.json
outputs/context_pressure/YYYY-MM-DD.jsonl
```
