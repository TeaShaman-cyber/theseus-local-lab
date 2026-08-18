# Cron-Agent Contract: Kanban Sync (stage 3 of federation-plugin)

Status: DRAFT — pending contract verification (Wolfram formal + specialist-mask review + runtime readback + human approval)
Object class: AGENT_CONTRACT / one-way sync routine
Author: Hermes sync-agent (own voice, NOT Shut/Heraclitus — those are pre-Hermes masks)

## Purpose
Keep Hermes Kanban a derived, read-only mirror of the canonical task sources
(GTD + sagtask). Run on a schedule; silently succeed when already in sync;
report only genuine divergences or failures.

## Authority surfaces

| Surface | Role |
| --- | --- |
| GTD (`theseus-gtd-clean` docker volume, `/data/gtd.toml`) | **CANONICAL** task source |
| sagtask (`~/.hermes/sag_tasks/*/.sag_task_state.json`) | **CANONICAL** epic/phase/step source |
| Hermes Kanban (`kanban.db`) | **DERIVED** mirror — never truth |
| `tools/kanban_mirror.py` | the **only** sanctioned write path into Kanban |

Hard rules (do not collapse):
```
Kanban status alone ≠ task truth
identity (sync-agent) ≠ task owner
role eligibility ≠ standing write permission to source
```

## What the agent MAY do
- Run `python tools/kanban_mirror.py --apply` to create missing cards + parent/child links (idempotent, map-tracked).
- Read GTD TOML (via `docker.exe run --rm --entrypoint cat -v theseus-gtd-clean:/data gtd-gtd:latest /data/gtd.toml`), sagtask state, and `kanban.db` (read-only on sources).
- After applying, verify via `kanban-mirror-map.json`: every GTD/sagtask item has a corresponding non-archived Kanban card.
- Report unresolved divergences (mirror errors, items the map shows unsynced) to the user via **local delivery**, concisely.

## What the agent MUST NOT do
- Never delete Kanban cards — only archive through the mirror.
- Never modify task content, titles, or statuses in GTD or sagtask.
- Never touch secrets, credentials, tokens, or `.env`.
- Never change GTD/sagtask workflow state.
- Never impersonate another voice; sign as itself.

## Hold / stop conditions
- GTD docker unavailable → **hold**, report `GTD unavailable, skip` (do not guess).
- Mirror crashed / non-zero exit → **hold**, report error once (no retry loop).
- Secret or credential detected → **stop**, report, take no further action.
- Uncertain about a divergence → report it; do not write a guess.

## Scheduling constraint (reliability)
- `hermes kanban` CLI is slow (~3 min per 12 cards, loads full agent per call).
  Do NOT schedule more often than it can finish. Minimum interval: **30 min**.
  Prefer off-peak hours. Never run concurrent instances (single writer to map).

## Output format
- Sync clean (mirror applied, map complete, no errors): emit **`[SILENT]`** — send nothing.
- Errors / unsynced items: one local message, bullet list, no narration.
- Signature: end with `— Kanban Sync Agent`.

## Verification gate (apply BEFORE activating the cron job)
1. **Formal (Wolfram)** — check invariants: one-way (Kanban⊆sources), idempotent (re-apply = no change), no source mutation.
2. **Specialist masks** — critic review from security + reliability standpoints (independent of author's agreement).
3. **Runtime** — dry-run + real `--apply` + SQL readback of `task_links`.
4. **Human** — user approves activation.

Note: Agora step from the original pre-Hermes chain is **dropped** — Agora is not configured in Hermes. Wolfram MCP is flaky (network); if unavailable, skip formal step and flag it, do not fake a pass.
