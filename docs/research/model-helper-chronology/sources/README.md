# Sources — extraction recipes and verified pools

Recipes only, no raw log copies. Every recipe must be reproducible and
every probe dump must carry its date.

## Recipe: model-switch chronology (logs)

Source: `%LOCALAPPDATA%/hermes/logs/agent.log` (rotated .1-.3)

```python
# lines look like: 2026-08-28 23:19:21 ... conversation turn ... model=gpt-5.6-luna-900k
import re, pathlib
pat = re.compile(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?(switch_model|conversation turn|Model switched).*?(?:model|to)[= :]+([\w./:-]+)')
# KNOWN DISCREPANCY (flagged by council 2026-08-31): naive count gives 219 hits,
# stricter pattern gave 43 — dedupe repeated lines per turn and treat
# consecutive identical model lines as ONE period, not multiple switches.
```

## Recipe: compression-helper usage (sqlite, read-only)

Source: `%LOCALAPPDATA%/hermes/state.db`

```sql
SELECT model, COUNT(*), SUM(input_tokens), SUM(output_tokens)
FROM session_model_usage WHERE task='compression'
GROUP BY model ORDER BY 2 DESC;
```

2026-08-31 result: hy3:free 12 (1.5M in / 635k out), nemotron-ultra 3,
solar-pro4 3, luna 4, terra 3, sol 3, longcat 1, glm 1. Total ~25 calls —
low-volume, sporadic dependency (council skeptic's YAGNI anchor).

## Recipe: Hindsight LLM wiring (docker, read-only)

```bash
docker inspect hindsight-api --format '{{json .Config.Env}}'
```
Verified 2026-08-31: general LLM round-robin [3,1] bothub+openrouter,
both nemotron-3-super-120b-a12b:free; reflect = mistral-small-3.2-24b-instruct
@ bothub. Full dump: docs/observations/hindsight-llm-wiring-2026-08-31.md

## Verified pool: free helper candidates (2026-08-31 22:20)

Full probe dump with per-model status: `free-helper-pool-2026-08-31.md`
(also preserved in this directory). Summary:
- ALIVE (10): nemotron-3-ultra-550b:free, minimax-m3:free, minimax-m2.7:free,
  nemotron-3.5-lightning:free, ling-3.0-flash-fin:free, dots-3-note-preview:free,
  laguna-xs-2.1:free, north-mini-code:free, lfm-2.5-2.6b:free,
  nemotron-3.5-content-safety:free
- 429-transient (re-probe later): glm-5.2:free, gemma-4-26b:free, gemma-4-31b:free, laguna-s-2.1:free
- 403-gated (permanent for us): inkling, inkling-small
- groq: 403 provider-side (user reproduced in browser) — excluded until recovery
- nous: hy3:free DEAD (free period ended)

## Historical predecessor (do not duplicate)

tools/github_issue_cards/pending/reflect-model-selection-guidance-20260829.md
— full model matrix (2026-08-28/29) for the Hindsight reflect contract incl.
route-vs-model failure separation. Published as vectorize-io/hindsight#3870.
This chronology treats it as the founding research; new reflect-route events
continue HERE, not in the card.
