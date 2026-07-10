# Memory Context Bridge

Small, portable tools for giving worker harnesses such as CodeWhale a compact
read-only view of AutoMem context.

Design boundary:

- Export context packs from AutoMem into `outputs/context/`.
- Let workers write memory candidates into `outputs/memory_inbox/`.
- Review candidates before storing anything in long-term memory.
- Do not give workers direct access to FalkorDB, Qdrant, or admin endpoints.

Generated files under `outputs/context/*.md` and `outputs/memory_inbox/*.md` are
ignored by Git because they can contain private project context.

## Export Context

```bash
python3 tools/memory_context/export_context.py
```

The exporter reads `.env.local`, `.env`, and process environment variables.
Useful variables:

- `AUTOMEM_API_URL` defaults to `http://127.0.0.1:8001`
- `AUTOMEM_API_TOKEN` is sent as a bearer token when present

## Create Memory Inbox Draft

```bash
python3 tools/memory_context/memory_inbox.py new \
  --title "CodeWhale found a useful invariant" \
  --summary "Short durable claim to review before storing." \
  --tags codewhale automem invariant
```

List drafts:

```bash
python3 tools/memory_context/memory_inbox.py list
```
