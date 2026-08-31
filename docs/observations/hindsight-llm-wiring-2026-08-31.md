# Verified fact — Hindsight LLM wiring (docker inspect, 2026-08-31)

Hindsight v0.8.6 (ghcr.io/vectorize-io/hindsight:0.8.6), compose file
D:\hindsight\docker-compose.yml. LLM wiring from container env:

- General LLM (retain/consolidation facts): round-robin weights [3,1]
  - LLM 1: openai provider, base https://openai.bothub.chat/v1,
    model nemotron-3-super-120b-a12b:free (weight 3)
  - LLM 2: openai provider, base https://openrouter.ai/api/v1,
    model nvidia/nemotron-3-super-120b-a12b:free (weight 1)
  - HINDSIGHT_API_LLM_TIMEOUT=120, MAX_CONCURRENT=2, REASONING_EFFORT=none
- Reflect LLM: openai provider, base https://openai.bothub.chat/v1,
  model mistral-small-3.2-24b-instruct, timeout 300, MAX_CONCURRENT=1,
  REASONING_EFFORT=none
- API keys [REDACTED] in container env.

Implication for the lab: the reflect contract research (issue card
ISSUE-20260829-001, published as vectorize-io/hindsight#3870) matches the
runtime wiring — mistral-small-3.2-24b-instruct IS the live reflect model.
The round-robin [3,1] bothub/openrouter for general LLM explains why a
bothub-side model change silently alters compression/fact quality.
