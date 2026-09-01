# Model & Helper Chronology — INDEX

> Research line: model/helper configuration chronology for the Hermes lab.
> Goal: research resumes from DATA, not from chat archaeology.
> Location contract (per council consensus, 2026-08-31): this is a section of
> `theseus-local-lab`, NOT a separate repository. Durable lessons go to
> AutoMem/MemPalace; DATA and evidence live here.

## Current state (2026-09-01)

| Role | Provider/Model | Status |
|---|---|---|
| Main chat | glm-5.3-flash @ opencode-go | LIVE |
| Fallback | nous / tencent/hy3 | **DEAD** (hy3:free 404 "free period ended" 2026-08-31) — replacement pending user decision |
| Delegation pin | glm-5.3-flash @ opencode-go | LIVE (was hy3:free, died) |
| MoA aggregator | meituan/longcat-2.0:free @ nous | ALIVE (re-verified 2026-09-01) |
| Compression helper | **inherits main model** (config `auxiliary.compression: auto/''`) | root cause of incidents |
| Hindsight general LLM | round-robin [3,1,1]: BotHub Nemotron + OpenRouter Nemotron + Nous Solar via Docker hermes-proxy | Solar route historically verified; current internal probe blocked by Cloudflare 1010; Nemotron family intermittently degraded (502 Nvidia overload) |
| Hindsight reflect LLM | mistral-small-3.2-24b-instruct @ bothub | LIVE (timeout 300s) |

### Free-helper rotation pool (verified 2026-09-01, three independent routes)

| Route | Verified ALIVE :free | Notes |
|---|---|---|
| nous | solar-pro4:free, longcat-2.0:free, step-3.7-flash:free, ling-3.0-flash-fin:free | agent_key (auto-refresh) |
| groq | gpt-oss-120b, compound-mini, qwen3.8-27b (+11 more in catalog) | restored after CF-1010 mystery |
| openrouter | minimax-m3:free (+~9 more from 08-31 scan) | nemotron-ultra currently 502 Nvidia |

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
