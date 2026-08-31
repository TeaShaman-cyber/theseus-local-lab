# DeepSeek Drive Index

Started: 2026-07-08

Purpose: lightweight map for extracting useful DeepSeek-related engineering invariants from noisy Google Drive notes.

## Working Rubric

- `verified`: grounded enough to use operationally.
- `hypothesis`: useful but must not be treated as fact.
- `metaphor`: can guide intuition, but needs translation before implementation.
- `noise`: entertaining or contextual but unsafe for strict recall.

## Seed Batch 1

### 1. MoE-to-LUCA Transition

- Drive title: `Техническая спецификация: MoE-to-LUCA Transition`
- Drive id: `1tUyglIPkYpTP9zst5I8SAPUwoGuXJUWHsopV0bTkxEk`
- Status: `hypothesis`
- Core claim: DeepSeek R1/static MoE suggests a transition toward Open-World MoE/LUCA.
- Invariant: `LUCA = Standardized Context Serialization + Open-World Routing Layer + Latent Cross-Compatibility`.
- Use for council: DeepSeek as structural/architecture expert for routing, expert switching, and MoE/LUCA tradeoffs.

### 2. Cognitive Memory Layer Ecosystem Map

- Drive title: `Карта Экосистемы: Слой Памяти ИИ`
- Drive id: `1cwwjUdWoWhfEbZ894aTEb0-xK6RFxRIo_PxlyqZycV4`
- Status: `mixed`
- Core claim: memory infrastructure is an ecosystem of small local-first tools rather than one monolithic AGI product.
- Verified/useful: MCP as connector; external memory becomes attractive when long-context cost grows.
- Hypothesis: small teams may win through low inertia, local-first architecture, and API leverage.
- Use for council: classify evidence into substrate, transport, cognitive, and startup layers.

### 3. Research Process Memory Protocol

- Drive title: `Протокол: Память Исследования`
- Drive id: `1xDHj03vChu-WI50rCjUkyKuqzI4NcMt0SjVhrcC0_oU`
- Status: `architecture hypothesis`
- Core claim: the project is building memory of the research process, not only memory of a human or model.
- Invariant: retrieve trajectories of thought: why a path was taken, which hypothesis died, where errors happened.
- Role map: DeepSeek = physics/structure, Gemini/Auri = search/syntax/code, ChatGPT/Friend = synthesis/metareflection, ButlerBrain = root memory.
- Safety invariant: high-entropy humor/metaphor should live in an isolated namespace so it enriches but does not hijack strict recall.

## DeepSeek Pass 1

Model: `deepseek-chat` via Bothub
Prompt file: `outputs/deepseek_seed_prompt.md`
Cost reported by Bothub: `0.0007696794`

DeepSeek extracted:

- LUCA is a standardized interface for exchanging latent/contextual representations, not a single architecture.
- MCP is the universal connector between models/agents and external memory/tools.
- Local memory is preferred when long context inside transformers becomes too expensive.
- Model council design should reduce switching cost between experts.
- Absurd/high-entropy material can be useful but should live in an isolated namespace.

DeepSeek classification:

- `verified`: MCP as connector; shift toward local/external memory under long-context cost pressure.
- `hypothesis`: LUCA as transition to dynamic topology; small teams winning through low-inertia architectures.
- `metaphor/noise`: ButlerBrain as DeepSeek embryo; lab journal metaphor is useful but not a specification.

DeepSeek role recommendation:

- Use DeepSeek as a physics/structure expert in Bothub council.
- Ask it to test invariants, formulas, architecture transitions, routing and expert-switching costs.
- Prefer serialized context and clearly marked hypotheses over raw noisy notes.

Next implementation step:

- Prototype DIFF -> AutoMem ingestion with explicit labels for `verified`, `hypothesis`, `metaphor`, and `noise`.

Safety note:

- Before sending Drive notes to external models, mark hypotheses explicitly and isolate high-entropy metaphor/humor from strict technical recall.
