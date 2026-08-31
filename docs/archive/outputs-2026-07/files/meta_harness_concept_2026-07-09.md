# Meta-Harness Concept

Date: 2026-07-09

Goal: evolve from a council of raw model calls into a council of harnessed
agents. Each agent should use its native strengths, tools, cost profile, and
health state, while Codex coordinates less and spends less attention on manual
conclave maintenance.

## Current Layers

- Codex: primary local coordinator and implementer.
- AutoMem: persistent semantic memory and graph.
- Bothub: multi-model external consultation layer.
- xAI/Grok: planned direct provider harness through `XAI_API_KEY`.
- Docker `agent-shell`: repeatable Unix-like workbench.
- State packets: compact telemetry for local environment and external signals.

## Direction

Move from:

`Codex -> asks models -> manually synthesizes`

Toward:

`shared task room -> harness agents -> typed contributions -> synthesis agent -> memory DIFF`

## Harness Agent Contract

Each agent should report:

- `role`: e.g. critic, implementer, researcher, verifier, poet/anti-fixation.
- `provider`: e.g. OpenAI, xAI, Anthropic-style, DeepSeek, Qwen, local model.
- `native_harness`: API, web app, CLI, browser, local container, or connector.
- `health`: ok, degraded, unavailable.
- `budget`: approximate cost/token/latency constraints.
- `input_policy`: what data it may receive.
- `output_schema`: answer, critique, patch, citation set, test result, or DIFF.

## Near-Term Implementation

1. Keep Bothub council as a working baseline.
2. Add direct xAI scripts:
   - `scripts/xai-models.ps1`
   - `scripts/xai-chat.ps1`
3. Add CodeWhale as a local harness candidate through Docker:
   - `scripts/codewhale.ps1`
   - `codewhale/README.md`
4. Add a `known-working-models` registry based on smoke tests, not catalog names.
5. Add council checkpoints after stage 1 and stage 2.
6. Later build provider-aware routing:
   - small local checks stay local,
   - Grok handles skeptical/productive disagreement,
   - DeepSeek handles architecture/math/system dynamics,
   - Claude-like agents handle code review and careful synthesis,
   - Qwen/Kimi handle coding variants,
   - Codex keeps local execution and memory discipline.

## Invariant

The goal is not more voices. The goal is less single-agent load, better
specialization, and cleaner memory: every agent contribution should either
reduce uncertainty, produce an artifact, or update the shared state.
