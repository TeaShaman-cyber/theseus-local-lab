# Memory outbox

The outbox is the local handoff boundary between Codex lifecycle hooks and the
memory providers. `memory_gate.mjs` decides whether a bounded event is safe and
durable; `append.mjs` writes accepted events to `outputs/memory_outbox/`.

Flush ownership is deliberately split:

- `flush.mjs` sends semantic projections to AutoMem `POST /memory`, then reads
  back `GET /memory/{memory_id}` and marks an event processed only when the
  receipt, `event_id`, and content all match.
- `flush-mempalace.mjs` sends episodic projections to the configured MemPalace
  MCP endpoint through pinned `mcporter@0.13.7`, then reads each returned drawer
  back with `mempalace_get_drawer`. It marks an event processed only when the
  drawer ID, wing, room, and exact content match; checkpoint errors and failed
  read-backs leave events pending for retry.
- Hindsight retain is a separate router path and uses bank `codex`.

Runtime queue and processed-ID files are ignored by Git. A provider failure
does not delete an event; the next bounded flush can retry it. Processed IDs
make retries idempotent. The outbox is intended to contain only bounded text fields, not raw transcript
records. `tools/memory_gate/text_safety.mjs` extracts textual message fields,
rejects credential-bearing material, redacts supported private values, and caps
the resulting content. This is a bounded safety filter, not a guarantee against
every form of sensitive information.

Safe smoke check:

```text
node tools/memory_outbox/runtime_smoke.mjs
```

The runtime smoke is deliberately gate-only: it creates a temporary transcript,
invokes `memory_gate.mjs`, and reports the decision. It does not invoke the
hook router, append to the project outbox, call Hindsight, AutoMem, or
MemPalace, and performs no provider writes.

Provider flushes are write-capable integration commands and are **not** smoke
tests:

```text
node tools/memory_outbox/flush.mjs
node tools/memory_outbox/flush-mempalace.mjs
```

Run provider flushes only with an explicitly bounded test environment and a
separate read-back plan. A non-empty queue can produce durable external writes.
The AutoMem and MemPalace writers are not allowed to treat transport success
alone as durable storage. A missing receipt or failed/mismatched read-back
leaves the event pending for retry.
