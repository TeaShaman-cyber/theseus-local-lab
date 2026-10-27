---
name: theseus-plugin-conclave
description: Use for fresh external evidence/oracle checks. Keep model councils explicit and separate.
---

# Theseus Plugin Conclave

Use plugins as bounded external lenses, never as a replacement for local
evidence, memory, or verification.

This is an **oracle route**, not a model council. A second oracle or a request
for a second opinion does not authorize `delegate_task`, mask fan-out, or a
multi-model vote. A model council requires explicit user opt-in and a hard
advisory runtime boundary.

Such a boundary exists now and should be the only sanctioned council runtime:
several text-only advisors answering in parallel, with no tool access, joined by
one aggregator. Subagents are **not** that boundary. A subagent inherits the
parent's full toolset, so a "council" built on `delegate_task` edits the real
workspace while advising - that is exactly what happened in August, when the
advisory roles wrote files into the repository. When a council is genuinely
wanted, use the agent's own text-only council route and keep the acting model as
the aggregator.

## Before Calling An Oracle

1. Read `tools/plugin_conclave/catalog.json` or run:

   ```text
   node tools/plugin_conclave/plugin_conclave.mjs --goal "<goal>"
   ```

2. Select one primary route. Add one independent corroborator only for a
   changing, consequential, disputed, or research-grade claim.
3. Keep prompts non-secret and task-scoped. State whether the result is a
   confirmed fact, source report, or hypothesis.
4. Treat write-capable apps as executors, not advisors. Do not mutate Drive,
   Notion, Deepnote, Todoist, Gmail, ButlerBrain, or external workspaces merely
   because their tools are available.

## Authority Order

1. Local tests, logs, service status, and reproducible artifacts.
2. Primary sources and official documentation.
3. A targeted oracle plus an independent corroborator when needed.
4. Community reports, reviews, and model suggestions.

`AutoMem` remains durable decision memory. `MemPalace` holds episodic or
verbatim evidence. Neither is displaced by ButlerBrain, Drive, Engram, or an
oracle result.

## Routes

| Need | Primary | Optional corroborator |
|---|---|---|
| Fresh, broad web evidence | Acumen | Exa or Parallel Search |
| Site map, crawl, or extraction | Tavily | Exa fetch |
| Deep cited investigation | Liner | Agora claim/evidence map |
| Peer-reviewed research | Consensus | Scholar Gateway or SciSpace |
| Code/runtime debugging | local logs and tests | Replay.io or Copilot advisor |
| AI models, datasets, evaluations | Hugging Face | AMD/local-model route |
| Formal model or computation | Wolfram | local test or explicit calculation |
| Knowledge graph view | Graphify/AutoMem/MemPalace | Ace Knowledge Graph |
| API/schema readiness | local validation | payload/date/API cleaners |

For the full current audit, roles, and exclusions, see
`docs/reference/plugin_conclave_catalog.md`.

## Stop Conditions

- Do not ask several search plugins the same question just to manufacture a
  vote.
- Do not make a plugin response the source of truth when direct evidence is
  available.
- Do not create a new persistent memory store for convenience. Engram is
  intentionally outside the Theseus memory write path.
- If a route is unavailable, mark it unavailable and fall back to the next
  catalogued route; do not silently invent an equivalence.
