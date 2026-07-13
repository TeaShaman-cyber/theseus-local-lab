# Theseus Memory Hook

Compact-aware memory bridge for the Theseus local lab.

The hook is deliberately small. It writes observable event data to local files
and prepares a compact AutoMem card. The agent or a future MCP wrapper can then
store that card in AutoMem and, later, save the raw material to MemPalace.

## Modes

- `checkpoint` - lightweight progress checkpoint.
- `compact` - creates a state packet before context compaction.
- `handoff` - creates a briefing packet for another agent or model.

## Layers

- L1: active Codex context.
- L2: raw/episodic record in `outputs/memory_hook/*.jsonl` plus state packets.
- L3: compact semantic card in `outputs/memory_inbox/*.json`.

## Examples

```text
node tools/memory_hook/memory_hook.mjs --mode checkpoint --summary "Docker MCP works through TCP" --tag docker --tag mcp
```

```text
node tools/memory_hook/memory_hook.mjs --mode compact --summary "Memory hook prototype started" --goal "Build compact-aware dual-write hook" --open-loop "Wire MemPalace direct save"
```

The script never reads `.env`, backups, raw memory exports, or private logs by
itself. If `--stdin` is used, the input is redacted and capped before writing.
