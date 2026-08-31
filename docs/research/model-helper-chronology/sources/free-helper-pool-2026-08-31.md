# Free-helper candidate pool (verified 2026-08-31 ~22:20 UTC+2)

Context: user budget is at its limit — helpers/subagents must be FREE
wherever possible; paid only where genuinely necessary.

## OpenRouter :free — live probe results (18 models scanned)

ALIVE (reply OK, cost 0):
- inclusionai/ling-3.0-flash-fin:free
- dots-studio/dots-3-note-preview:free
- liquid/lfm-2.5-2.6b:free (tiny)
- nvidia/nemotron-3.5-lightning:free
- poolside/laguna-xs-2.1:free
- cohere/north-mini-code:free
- nvidia/nemotron-3.5-content-safety:free (safety classifier, not general)
- nvidia/nemotron-3-ultra-550b-a55b:free (biggest, historically used for compression: 3 calls)
- minimax/minimax-m3:free
- minimax/minimax-m2.7:free

TEMPORARILY rate-limited (429, worth re-probing later):
- z-ai/glm-5.2:free
- google/gemma-4-26b-a4b-it:free
- google/gemma-4-31b-it:free
- poolside/laguna-s-2.1:free

DEAD-ish / restricted:
- thinkingmachines/inkling-small:free, thinkingmachines/inkling:free — 403 "only available on agentic harnesses"
- nvidia/nemotron-3-super-120b-a12b:free — silent failure (no content; same family as the choking Hindsight extractor)
- nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free — silent failure

## Other providers with keys present
- groq: GROQ_API_KEY present but /models → 403; user reproduced 403 from their
  own browser too — provider-side or VPN-route issue, NOT our key/config.
  Excluded from the free-helper pool until it recovers.
- nous: hy3:free DEAD (404 free period ended)
- bothub: hy4-preview/hy3/hy3-preview alive but PAID (micro-prices) —
  fallback only, per user budget policy (free first, paid where necessary)

## Failure-class taxonomy (founding lesson of the lab)
- 404 "free period has ended" → PERMANENT death (hy3:free)
- 502 upstream overloaded → TRANSIENT (nemotron extractor today)
- 429 temporarily rate-limited → TRANSIENT (glm-5.2:free, gemma:free now)
- 403 harness-gated → PERMANENT for our use (inkling)
- silent empty content → probe artifact (reasoning models need max_tokens>=200) OR model issue
