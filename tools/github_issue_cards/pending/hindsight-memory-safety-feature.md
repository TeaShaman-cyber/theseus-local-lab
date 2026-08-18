---
status: READ_BACK_VERIFIED
operation: edit
issue_number: 3509
project: hindsight
repository: vectorize-io/hindsight
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "publish feature-request: per-fact delete / correction-expiry in Hindsight memory + agent-side guardrails (typo/transcription hygiene, date-from-clock not context)"
issue_type: feature_request
purpose: "Request Hindsight maintainers add per-fact delete / correction-expiry so agents can retract a wrongly-retained memory unit instead of only appending a correction that may be out-ranked by the original false item; also document complementary agent-side guardrails (typo/transcription hygiene, date-from-clock not context) that keep garbage out before retention."
observed: "Live issue #3509 (vectorize-io/hindsight) is OPEN and contains the original per-fact-delete feature request body. Card validated by issue_card_guard (validate -> ISSUE_CARD_VALID). This edit appends the 'Complementary agent-side guardrails' section (transcription/typo hygiene + date-from-clock-not-context) to the existing issue body."
verified_at: "2026-08-15 (session 20260815_111151_07daa2 continuation)"
labels:
  - enhancement
  - triage
---

# Feature Request: per-fact deletion and/or correction-expiry for retained memory units

## Use Case

I run a self-hosted Hindsight bank (`api_url=http://localhost:8888`, pg0 embedding store) as the
long-term memory for an AI agent (Hermes). The agent retains facts via the Python client
`client.retain(bank_id, content, context, timestamp)`. Over a session, an **unverified or
incorrect "fact"** can be retained and then surfaces as truth on later `recall`/`reflect` calls.

Concrete incident (2026-08-12 → 2026-08-16): five retained memory-items claimed
*"Gramps already works via KeePass"*. The user later confirmed KeePass is NOT installed and the
claim is false. I could only paper over it with a correcting `retain` — the original false items
remain in the bank and can still be returned by recall.

## Problem Statement

There is **no per-fact delete** in Hindsight:

- The Python client exposes `retain`, `recall`, `reflect`, `retain_files`, `documents`, `delete_bank`,
  but no `delete_memory_unit` / `invalidate_memory_unit` for an individual retained fact.
- `document delete <bank> <doc>` removes only **file-derived** documents, not memory-items created
  via `retain` (verified: retained items are not bound to a deletable document).
- The only correction path is **re-retain with an explicit CORRECTION context** — a workaround, not a
  guarantee. The false item still exists and can outrank the correction depending on retrieval.

This is the same class of memory-correctness gap the maintainers already track:
- #3475 — Knowledge Pages restate retired facts as current (superseded ≠ incorrect, so neither
  `state=invalidated` #1391/#2696 nor the #3248 supersession rule applies).
- #3470 — `invalidate_memory` broken on Hindsight Cloud (500 on `invalidated_memory_units`).
- #3476 — attribution vs content: pages present a discussed dependency as a project decision.

The missing capability is recognising a retained unit is **wrong or stale** and being able to
**remove or expire it** without leaving the original behind.

## How This Feature Would Help

- Agents could retract a fact they retained in error instead of only appending a correction that may
  be out-ranked by the original.
- Closes the "silent fact loss / false fact persists" risk class that #3475/#3470/#3476 describe from
  the *read/attribution* side — this request covers the *write/retract* side.
- Makes memory safety auditable: a `deleted`/`expired` state parallel to `invalidated`, with a reason
  and timestamp, visible via `recall` trace.

## Proposed Solution

Either (or both):

1. **Per-fact delete**: `client.delete_memory(bank_id, memory_id)` (and matching `DELETE /memories/{id}`
   on the native MCP server + REST API). Return 404 if already invalidated/deleted.
2. **Correction-expiry / confidence metadata**: allow `retain` to carry `confidence` (verified |
   unverified | user-confirmed | correction) and an optional `expires_at` / `supersedes` pointer, so a
   correction can explicitly retract the earlier unit instead of coexisting with it.

Mirror the existing `state=invalidated` machinery (#1391/#2696) but extend it to "retracted as
incorrect OR expired as stale", distinguishable from "invalidated as wrong".

## Alternatives Considered

- **Re-retain with CORRECTION context** (current workaround): works for ranking but leaves the false
  item in the bank; not a guarantee.
- **`document delete`**: only affects file-derived docs, not `retain` items — insufficient.
- **Rebuild the bank from a cleaned export**: heavy, loses provenance, not viable for live agents.

## Environment

| | |
|---|---|
| hindsight-embed / hindsight-api | self-hosted, pg0 embedded store, port 8888 (Docker) |
| Client | `vectorize-io/hindsight-client` Python, `Hindsight(base_url=...)` |
| Harness | Hermes agent (memory.provider=hindsight, local_external) |
| Bank | single bank `hermes` |
| LLM provider | OpenAI-compatible via local proxy (tencent/hy3:free through Nous) |

## Related

- #3475 (retired facts restated), #3470 (invalidate_memory broken), #3476 (attribution vs content),
  #3248 (observations_mission supersession rule), #1391 / #2696 (state=invalidated)
