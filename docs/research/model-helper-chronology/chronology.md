# Model & Helper Chronology

Append-only event log. One entry per event. Never rewrite or delete —
corrections are added as new entries referencing the old line.

Entry format:

```text
## YYYY-MM-DD HH:MM (TZ) — <short title>
- class: DEATH | OVERLOAD | GATE | PROBE | SWITCH | CONFIG | RESEARCH
- role: <main | fallback | delegation | compression | moa | hindsight_llm | hindsight_reflect | candidate>
- detail: <what happened, with error text if any>
- evidence: <file/log/commit/issue reference>
- disposition: <what changed as a result, if anything>
```

---

## 2026-08-28 → 2026-08-29 — Reflect model-contract research (published)
- class: RESEARCH
- role: hindsight_reflect
- detail: Model matrix probing across OpenRouter/Nous/BotHub for the Hindsight
  reflect contract. Key result: generic tool/JSON probes ≠ real bank-backed
  reflect (paid Gemma-4-26B and Mistral-Small-3.2-24B passed disposable 2/2,
  failed real reflect with HTTP 500 / no usable tool_calls). Failure
  classification separated: runner / provider-route / model / integration.
- evidence: tools/github_issue_cards/pending/reflect-model-selection-guidance-20260829.md
  (published as vectorize-io/hindsight#3870, read-back verified 2026-08-29T01:04)
- disposition: reflect route configured with mistral-small-3.2-24b-instruct @ bothub (live as of 2026-08-31)

## 2026-08-30 08:20 — Sol usage limit exhausted (plan plus)
- class: GATE
- role: main
- detail: Sol (openai-codex, plan plus) HTTP 429 "usage limit reached",
  resets_in_seconds ≈ 11485 (~3.2h). Fallback attempt opencode-free/hy3-free
  → HTTP 401 "Model hy3-free is not supported". Runtime switched main to
  tencent/hy3:free (nous) at 08:27:42.
- evidence: logs/agent.log 2026-08-30 08:20:42–08:29:59 (session logs)
- disposition: main on hy3:free until Sol window reset (~11:35)

## 2026-08-31 18:45 — Hindsight fact-extraction degraded (Nvidia overload)
- class: OVERLOAD
- role: hindsight_llm
- detail: retain + consolidation scope failing: HTTP 502 "Upstream error from
  Nvidia: Service temporarily overloaded" from nemotron-3-super-120b-a12b:free;
  4 retry attempts with timeouts per call. Container healthy (Up 4 days).
  Round-robin [3,1] bothub/openrouter both hit the same upstream (Nvidia).
- evidence: docker logs hindsight-api 18:45–18:55 UTC+2;
  docs/observations/hindsight-llm-wiring-2026-08-31.md
- disposition: transient — no config change; one retain succeeded in a gap window

## 2026-08-31 21:17 — hy3:free (nous) permanent death
- class: DEATH
- role: fallback + delegation (prior pin)
- detail: HTTP 404 "This model's free period has ended. Please select a
  different model to continue!" — all 5 delegation tasks of deleg_a3862069
  failed, 3 retries each. Not transient: free-tier period expired.
- evidence: delegation result deleg_a3862069 (2026-08-31 21:17:10 +02:00)
- disposition: delegation pin → glm-5.3-flash @ opencode-go (read-back verified);
  fallback_providers nous/hy3 now points at a dead model — replacement pending

## 2026-08-31 22:20 — Free-helper pool probe (OpenRouter full scan)
- class: PROBE
- role: candidate
- detail: All 18 OpenRouter :free models probed live (max_tokens 250).
  ALIVE 10: nemotron-3-ultra-550b:free, minimax-m3:free, minimax-m2.7:free,
  nemotron-3.5-lightning:free, ling-3.0-flash-fin:free, dots-3-note-preview:free,
  laguna-xs-2.1:free, north-mini-code:free, lfm-2.5-2.6b:free,
  nemotron-3.5-content-safety:free. 429-transient: glm-5.2:free, gemma-4-26b,
  gemma-4-31b, laguna-s-2.1. 403-gated: inkling, inkling-small (agentic
  harnesses only). Silent-empty: nemotron-3-super:free (same family as the
  degraded extractor). Probe lesson: reasoning models return content=None
  with max_tokens<200 — probes need max_tokens>=200.
- evidence: sources/free-helper-pool-2026-08-31.md (this repo)
- disposition: free-first helper policy confirmed viable; rotation candidates identified

## 2026-09-01 ~00:10 — VPN endpoint change → CF 403 mystery solved, free pool tripled
- class: PROBE
- role: candidate
- detail: User switched VPN endpoint; Groq and Nous "recovered". Experiment
  showed the 08-31 403s were Cloudflare bot-mitigation (error code 1010,
  TLS fingerprinting): same egress IP passes via curl/schannel, fails via
  python urllib. Nous: solar-pro4, longcat-2.0, step-3.7-flash,
  ling-3.0-flash-fin all :free ALIVE (agent_key from credential_pool, not
  static .env key). Groq: catalog 14 models, gpt-oss-120b/compound-mini/
  qwen3.8-27b ALIVE. hy3:free re-confirmed DEAD (404, permanent).
  OpenRouter lesson: nemotron-ultra probe returned HTTP 200 with embedded
  {"error":{code:502}} — body must be parsed, not just status.
- evidence: sources/vpn-endpoint-change-2026-09-01.md (full experiment)
- disposition: triage.md gains CF-1010 row + 200-wrapped-error rule;
  free pool now spans 3 independent routes (nous/groq/openrouter)

## 2026-09-01 21:34 (+02:00) — Docker-owned Hermes Subscription Proxy runtime verified
- class: CONFIG
- role: hindsight_llm
- detail: Official `nousresearch/hermes-agent` image runs as a Docker Compose
  sibling with a dedicated persistent OAuth volume and no host-published proxy
  port. Manual OAuth succeeded in the isolated volume. From `hindsight-api`,
  `/v1/models` returned HTTP 200 with `upstage/solar-pro4:free`; a Solar
  completion returned HTTP 200 before and after proxy fault recovery. Hindsight
  was recreated with internal `hermes-proxy:8645` and weights [3,1,1]. Its
  LLM trace contains successful Solar `retain_extract_facts` calls; API health
  and read-only recall returned HTTP 200.
- evidence: issue #2 and progress comment;
  docs/reference/infrastructure-registry.yaml;
  D:/hindsight/docker-compose.yml;
  Hindsight `/v1/default/banks/hermes/llm-requests` read-back
- disposition: proxy ownership promoted from planned-poc to
  active-runtime-verified-with-cold-boot-pending. Existing Nemotron backlog
  was preserved; the optional bank LLM-health endpoint stayed disabled; the
  no-persistence dry-run timeout was not retried.
