---
name: theseus-hindsight-manual
description: Use when the Hermes Hindsight memory provider is disabled or swapped (e.g. while testing Cognee), or when a bank read/write must bypass the provider plugin — manual recall, retain, health checks and rollback.
---

# Hindsight Manual Access

## Core Rule

The plugin and the server are two different things.

- **Plugin** (`~/.hermes/plugins/hindsight`) — auto-recall before a turn, per-turn writes, our retain noise filter, session-end extraction. Exists only while `memory.provider: hindsight`.
- **Server** (`hindsight-api` container, `http://127.0.0.1:8888`) — the bank itself. Keeps answering no matter which provider Hermes has selected.

Manual access goes through the server, not through the plugin.

## When This Applies

1. Another provider is active (Cognee/Mem0/Supermemory experiment) and the bank is still needed.
2. The built-in `hindsight_recall` / `hindsight_retain` / `hindsight_reflect` tools are gone because the provider changed.
3. A single read or write must be done deliberately, outside the agent's automatic memory path.

## Commands

```bash
# server alive?
python tools/hindsight_api.py health

# search the bank
python tools/hindsight_api.py recall --query "формат ответа агента"
python tools/hindsight_api.py recall --query "..." --types world,experience --json

# write a fact — always dry-run first
python tools/hindsight_api.py retain --text "..." --context "manual note" --dry-run
python tools/hindsight_api.py retain --text "..." --context "manual note" --tag habit:tools
```

Environment: `HINDSIGHT_BASE_URL` (default `http://127.0.0.1:8888`), `HINDSIGHT_BANK` (default `hermes`), `HINDSIGHT_API_KEY` (optional).

Exit codes: `0` ok, `2` bad arguments, `3` server error or unreachable.

## Rules

- **Bank names are separate.** `hermes` is ours; `codex` belongs to Codex. Never read or write the other bank by habit.
- **`retain` is a mutation.** Dry-run first; write one fact, not a batch, unless the batch is the point.
- **The noise filter is plugin-only.** With the provider off, nothing strips "фоновый процесс proc_… завершился нормально" style lines — do not retain them manually either.
- **Production is `127.0.0.1:8888`.** Experiments (model, provider, corpus) belong on the isolated stand, PVE CT103 `10.10.10.13`, usually through tunnel `127.0.0.1:8890`.
- **Recall defaults** that match the tuned setup: `types=world,experience`, `budget=low`. Observations are excluded from ordinary recall by decision in #115; asking for them is a deliberate experiment.
- **Health is not a memory test.** `{"status":"healthy","database":"connected"}` proves the process and DB, not that a query returns something. Verify with one real recall.

## Switching the Provider Safely

Before turning Hindsight off, prove the patches survive:

```bash
sha256sum ~/.hermes/plugins/hindsight/{__init__.py,plugin.yaml,settings.py}
cp -a ~/.hermes/plugins/hindsight ~/.hermes/cache/scratch/hindsight-patch-backup/
```

Reference hashes (2026-10-29, v1.2.3): `__init__.py` `9ac15b58db991147`, `plugin.yaml` `f46da374c184400e`, `settings.py` `cc922b593c99e974`.

`hermes plugins update hindsight` overwrites `__init__.py` and deletes the noise-filter patch — never run it while the patched copy matters.

Switch and roll back:

```bash
hermes config set memory.provider cognee     # provider is read at session start
hermes config set memory.provider hindsight  # rollback
hermes memory status                         # expect "hindsight ← active"
```

## Pitfalls

1. Provider changes apply on the next session start, not mid-session.
2. Only one external memory provider is active at a time; built-in `MEMORY.md`/`USER.md` stay on regardless.
3. `recall` returns an empty list without error when nothing matches — that is a result, not a failure; distinguish it from `exit 3`.
4. The JSON shape differs between endpoints (`results` vs `memories`); the script already accepts both.

## Links

- `tools/hindsight_api.py` — the manual client.
- Issue #136 — Cognee experiment and the patch-preservation contract.
- Issue #134 — what may contaminate measurement, and what was disproved.
