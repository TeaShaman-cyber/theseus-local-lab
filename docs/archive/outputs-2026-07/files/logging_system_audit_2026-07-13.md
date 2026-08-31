# Theseus Logging System Audit - 2026-07-13

Purpose: map the current local logging/observability stack before adding any
new agent event journal, so future work extends the existing layers instead of
duplicating them.

## Current Layers

| Layer | Path | Format | Writer | Role | Current state |
|---|---|---|---|---|---|
| Session journal | `tools/session_journal`, `outputs/session_journal/` | Markdown | manual / VS Code task | Compact human-readable lab snapshot | Exists, 6 files, last written 2026-07-11 |
| Session timeline | `tools/session_timeline`, `outputs/session_timeline/` | JSONL | manual / VS Code task / script | Append-only event stream for time reconstruction | Exists, 1 file, 3 events on 2026-07-13 |
| Log lattice | `log-lattice/` | SQLite over local HTTP | Docker service | Central lightweight structured log store | Running on `127.0.0.1:8768`, 2 mirrored events |
| Memory hook | `tools/memory_hook`, `outputs/memory_hook/`, `outputs/memory_inbox/`, `outputs/state_packets/` | JSONL, JSON, Markdown | manual / hook / VS Code task | Compact, handoff, and pre-compaction state packets | Exists, mature enough for checkpoint/handoff packets |
| Research queue | `hooks/research-queue-hook.mjs`, `tools/research_queue`, `outputs/research_queue/` | JSONL | hooks / manual | Queue public research follow-up for connectors | Exists, hook config present for `Stop` and `PreCompact` |
| Harness error scanner | `tools/harness_errors`, `outputs/harness_errors/` | JSON, Markdown | manual / VS Code task | Classify known Codex/UI/network failure signatures | Exists, currently finds network/proxy and socket failures |
| Tool policy | `tools/tool_policy`, `outputs/tool_policy/` | JSONL | manual / VS Code task | Pre-action route critic and safety/reward signal | Exists, sparse data: one raw-Docker block event |
| Learning loop | `tools/learning_loop`, `outputs/learning_loop/` | Markdown | manual / VS Code task | Review tool-policy events and propose behavior changes | Exists, currently only sees the one tool-policy event |
| Backup lattice | `backup-lattice/`, `tools/backup_lattice/` | archives + reports | Docker service / script | Protect AutoMem/state packets/observatory artifacts | Exists, not an observability log source by itself |

## What Already Covers The Proposed Agent Event Journal

The proposed journal should not create a separate database. The closest existing
fit is:

```text
agent event
  -> tools/session_timeline/timeline.mjs
  -> outputs/session_timeline/YYYY-MM-DD.jsonl
  -> optional mirror to log-lattice /events
  -> later summaries into AutoMem / MemPalace
```

`session_timeline` already supports the right primitive fields:

- `source`
- `event`
- `note`
- `context_percent`
- `limit_percent_remaining`
- `artifacts`
- `tags`
- `metrics`

`log-lattice` already stores the same event shape plus `raw_json`, with indexes
on `created_at`, `source`, and `event`.

## Gaps

1. Tool failures are not automatically mirrored into `session_timeline`.
   Current failures may appear in chat, tool output, state packets, or the
   harness error report, but there is no single event for each failed action.

2. `memory_hook` writes its own raw JSONL and state packets but does not mirror
   a compact event into `session_timeline` or `log-lattice`.

3. `tool_policy` writes JSONL decisions, but only when called with `--log`.
   The learning loop sees only logged policy checks, not all real routes.

4. `harness_errors` scans after the fact. It classifies known signatures but
   does not create normalized timeline events for each match.

5. `research_queue` is a queue of follow-up work, not a session trace. It should
   remain separate from agent telemetry.

6. `log-lattice` is running, but only has two mirrored events. The service is
   ready; the sources are not wired consistently.

7. There is no canonical event taxonomy yet for model/tool/sandbox/permission/
   network/context/usage/postcondition failures.

## Recommendation

Do not add a new "agent_event_journal" store.

Instead, extend the current `session_timeline` event schema and use `log-lattice`
as the central durable sink:

```text
local JSONL edge buffer
  -> log-lattice SQLite
  -> daily learning-loop / harness-error summaries
  -> accepted durable lessons in AutoMem
  -> exact episodic notes in MemPalace when needed
```

## Proposed Minimal Event Taxonomy

| Event | Source | Meaning |
|---|---|---|
| `agent-goal-set` | `codex` / `user-ui` | Goal or working objective changed |
| `agent-mode-snapshot` | `codex` | Model, speed tier, effort, context, or limit observation |
| `tool-route-selected` | `tool-policy` | Candidate route chosen before action |
| `tool-call-start` | `codex` / `vscode` / `docker` | A local/MCP/tool action began |
| `tool-call-result` | same as start | Action completed with code/status |
| `tool-call-failure` | same as start | Action failed; include failure class |
| `permission-boundary` | `codex` / `windows` / `docker` | Approval, sandbox, ACL, or profile boundary hit |
| `context-compaction` | `codex` / `memory-hook` | Compaction or pre-compaction packet happened |
| `postcondition-check` | `codex` | Verification outcome after a change |
| `memory-write` | `automem` / `mempalace` | Durable memory write/checkpoint happened |
| `research-queued` | `research-queue` | Public research follow-up queued |

## Near-Term Implementation Shape

1. Add a tiny shared helper for writing timeline events, so `memory_hook`,
   `tool_policy`, and `harness_errors` can mirror events without duplicating
   HTTP/JSONL code.

2. Keep `outputs/session_timeline/*.jsonl` ignored as the edge buffer.

3. Keep `log-lattice` as the Docker-backed query store.

4. Add only normalized, redacted, short events. No secrets, no raw `.env`, no raw
   hidden reasoning, no private transcripts.

5. Treat AutoMem and MemPalace as summary/episodic memory layers, not as the raw
   event log.

## Immediate Conclusion

The current system is not missing a database. It is missing consistent producers
and a small taxonomy. The next change should therefore be a shared event writer
and integrations into existing tools, not a parallel observability stack.
