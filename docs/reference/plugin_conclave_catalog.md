# Plugin Conclave Catalog

Audit date: 2026-07-18. The current Codex runtime advertises 38 connected apps
with 355 app tools, alongside local Theseus skills and MCP servers.

This is not a vote machine. The purpose is to route the right outside lens into
an already evidence-led workflow while keeping the memory and verification
layers local.

## Default Conclave

| Question | Primary oracle | Use a second view when | Do not confuse it with |
|---|---|---|---|
| What changed recently? | Acumen | Time-sensitive or disputed result: Exa/Parallel Search | direct source verification |
| What does this site contain? | Tavily | Extraction affects a decision: Exa fetch | a durable archive |
| What does research support? | Consensus | Important or cross-disciplinary claim: Scholar Gateway/SciSpace | a meta-analysis |
| How do claims relate? | Agora | Causality needs formal model: Wolfram | causal proof |
| How should this GitHub/VS Code path work? | local evidence | Existing tooling may exist: HAPI MCP Registry | unverified advisor opinion |
| Which model/dataset/eval is relevant? | Hugging Face | Local feasibility matters: AMD local-AI route | hardware proof |
| Why did a recorded app execution fail? | local trace/log/test | Recording exists: Replay.io | a general Windows monitor |
| Does a proposed contract hold mathematically? | Wolfram | Implementation matters: local conformance test | runtime proof |

## Roles

- **Memory primary:** AutoMem decisions and MemPalace episodes. No external
  memory plugin is in the automatic write path.
- **Oracle:** produces a bounded external view. Its output must retain source
  and uncertainty labels.
- **Source:** provides user-owned or external material but has no automatic
  authority.
- **Executor:** acts on a named external system or deterministic input only.
- **Visualizer:** renders a view; it does not own the underlying graph.

`tools/plugin_conclave/catalog.json` is the machine-readable source. Run
`node tools/plugin_conclave/plugin_conclave.mjs --goal "..."` before a new
plugin-heavy task. The local skill is
`.agents/skills/theseus-plugin-conclave/SKILL.md`.

## Audit Outcome

Keep the general-purpose conclave deliberately small: Acumen, Exa, Tavily,
Liner, Agora, Consensus, Scholar Gateway, Hugging Face, Replay.io, HAPI,
Wolfram, and the local memory stack. Domain-specific plugins remain
available through their own triggers. Write-capable personal systems are never
called automatically just because a tool exists.

This avoids two recurring failures: building a giant skill from copied plugin
documentation, and treating several correlated search results as independent
evidence.

## Connected Inventory

The following apps are available in this runtime. Tool count is an availability
snapshot, not a guarantee of permission or service health.

| Group | Connected apps | Conclave disposition |
|---|---|---|
| Fresh web and evidence | Acumen (2), Exa (2), Parallel Search (2), Tavily (5), Liner (5), Agora (10) | Core oracle pool, routed by question shape |
| Scholarly work | Consensus (2), Scholar Gateway (1), SciSpace (2), Sider Scholar (18) | Core evidence pool; fetch source records before claims |
| Engineering and AI | Replay.io (28), Hugging Face (9), Deepnote (19), HAPI MCP Registry (3), Error Log Parser (1), Requirements Extractor (1), Payload Completeness Checker (1), API Response Cleaner (1) | Replay/HF/HAPI are specialist advisors; the rest are bounded executors |
| Local skill layer | Superpowers, AMD Skills, OpenAI Developers, documents, PDF, presentations, spreadsheets, visualize, life-science research, NGS analysis | Load their smallest matching skill; local tests remain the implementation authority |
| Memory and user sources | AutoMem (6), MemPalace (36), ButlerBrain (10), Google Drive (46), Notion (20), MarcoPolo (4), Engram (6) | Local memory is primary; ButlerBrain/Drive/Notion are deliberate sources; Engram excluded from automatic writes |
| Graph, math, and rendering | Wolfram (3), Ace Knowledge Graph (3), Mermaid Chart (2), BioRender (2) | Wolfram is a formal oracle; graph/render tools are views, not truth stores |
| Domain routes | FindIp (10), smarts.bio (10), DataCamp (6), Midpage Legal Research (5), Metaplay SDK Docs (4) | Invoke only under their domain-specific task trigger |
| Personal/deployment/system | Gmail (21), Todoist (44), Sites/hosting, plugin management, local hotline | No automatic execution; explicit user intent only |
