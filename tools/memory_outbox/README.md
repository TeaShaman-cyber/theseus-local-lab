# Memory outbox

The outbox is the local handoff boundary between Codex lifecycle hooks and the
memory providers. `memory_gate.mjs` decides whether a bounded event is safe and
durable; `append.mjs` writes accepted events to `outputs/memory_outbox/`.

Flush ownership is deliberately split:

- `flush.mjs` sends semantic projections to AutoMem `POST /memory`.
- `flush-mempalace.mjs` sends episodic projections to the configured MemPalace
  MCP endpoint through pinned `mcporter@0.13.7`.
- Hindsight retain is a separate router path and uses bank `codex`.

Runtime queue and processed-ID files are ignored by Git. A provider failure
does not delete an event; the next bounded flush can retry it. Processed IDs
make retries idempotent. The outbox never contains raw transcript content:
the gate extracts text-only message fields, applies redaction, and caps size.

Manual checks:

```text
node tools/memory_outbox/flush.mjs
node tools/memory_outbox/flush-mempalace.mjs
```

Both commands are safe when the queue is empty and report no duplicate writes.
