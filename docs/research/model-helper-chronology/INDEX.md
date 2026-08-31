# Model & Helper Chronology — INDEX

> Research line: model/helper configuration chronology for the Hermes lab.
> Goal: research resumes from DATA, not from chat archaeology.
> Location contract (per council consensus, 2026-08-31): this is a section of
> `theseus-local-lab`, NOT a separate repository. Durable lessons go to
> AutoMem/MemPalace; DATA and evidence live here.

## Current state (2026-08-31)

| Role | Provider/Model | Status |
|---|---|---|
| Main chat | glm-5.3-flash @ opencode-go | LIVE |
| Fallback | nous / tencent/hy3 | **DEAD** (hy3:free 404 "free period ended" 2026-08-31) |
| Delegation pin | glm-5.3-flash @ opencode-go | LIVE (was hy3:free, died) |
| MoA aggregator | meituan/longcat-2.0:free @ nous | unverified today |
| Compression helper | **inherits main model** (config has no dedicated key) | root cause of incidents |
| Hindsight general LLM | round-robin [3,1]: bothub nemotron-3-super:free + openrouter nemotron-3-super:free | degraded 2026-08-31 (502 Nvidia overload, transient) |
| Hindsight reflect LLM | mistral-small-3.2-24b-instruct @ bothub | LIVE (timeout 300s) |

## Reading order for newcomers

1. `chronology.md` — append-only event log (the single source of history)
2. `triage.md` — wait-vs-switch playbook for failing helpers
3. `sources/` — extraction recipes and verified pools

## Charter: what lives where

- `chronology.md` — append-only, day-keyed events; never rewrite history
- `sources/` — VERIFIED extraction recipes + probe dumps; no raw log copies
- transient states (prices, free-period windows, "alive today") belong in
  dated probe dumps under `sources/`, never asserted as permanent facts
- SYNTHESIS (analyses) is regenerable and must cite event lines or packet rows
- LIVING (INDEX current-state table) is the only mutable-status file
