# Codex Memory Automation Research

Date: 2026-07-12

Purpose: summarize what official docs, project docs, and community/security
signals imply for making AutoMem + MemPalace usage natural for Codex without
turning every answer into manual memory plumbing.

## Sources Checked

- OpenAI Codex skills docs: https://developers.openai.com/codex/skills
- OpenAI Codex customization docs: https://developers.openai.com/codex/concepts/customization
- OpenAI skills examples repository: https://github.com/openai/skills
- AutoMem repository: https://github.com/verygoodplugins/automem
- MCP AutoMem repository and installation docs: https://github.com/verygoodplugins/mcp-automem
- MemPalace MCP integration: https://mempalaceofficial.com/guide/mcp-integration.html
- MemPalace hooks: https://mempalaceofficial.com/guide/hooks.html
- MemPalace searching: https://mempalaceofficial.com/guide/searching.html
- MemPalace mining: https://mempalaceofficial.com/guide/mining.html
- MemPalace changelog: https://github.com/MemPalace/mempalace/blob/main/CHANGELOG.md
- Security/community signal: "Under the Hood of SKILL.md" (arXiv 2605.11418),
  about skill-selection and supply-chain risks.

## What Codex Skills Actually Guarantee

Codex skills are directories with a `SKILL.md` file plus optional scripts,
references, assets, and `agents/openai.yaml`. A skill can be triggered
explicitly by name or implicitly through its description.

Important limitation: implicit skill activation is a routing hint, not a hard
runtime guarantee. If the description is vague, too broad, or competes with many
other skills, Codex can fail to select it. Good skills are narrow, imperative,
and have trigger words near the front of the description.

Repo-scoped skills are documented under `.agents/skills`; user skills live under
the user's agents/skills location; admin skills can live under `/etc/codex/skills`.
Codex usually detects skill changes, but a restart is recommended when changes
do not appear.

## What `agents/openai.yaml` Adds

`agents/openai.yaml` can add UI metadata, invocation policy, and dependency
declarations. The relevant part for Theseus is MCP tool dependencies:

```yaml
dependencies:
  tools:
    - type: "mcp"
      value: "memory"
      description: "AutoMem graph-vector memory."
    - type: "mcp"
      value: "mempalace"
      description: "MemPalace verbatim recall."
```

This does not force the model to call the tools every turn, but it gives Codex a
clean local association: this skill expects these MCP servers.

## AutoMem Role

AutoMem is best treated as durable graph-vector memory:

- reusable decisions
- user preferences
- recurring bug roots
- project patterns
- links between related decisions

AutoMem's own docs emphasize scaling and cross-client memory. It is not the
best place for raw transcript recall or exact wording. Its useful invariant for
Theseus is: store distilled facts and relationships, then verify with recall.

## MemPalace Role

MemPalace is best treated as verbatim and spatial recall:

- exact wording from prior sessions
- session diary and wake-up context
- scoped search with wing/room filters
- curated drawers, not bulk dumping everything

MemPalace docs say MCP lets the AI call `mempalace_search` behind the scenes.
They also recommend a protocol: check status, search before answering about a
person/project/past event, and write session diaries/checkpoints after work.

Important practical note: MemPalace is fast when curated and scoped. Bulk mining
old transcripts, backups, or pilot dumps can make it noisy and slow. For this
lab, clean permanent palace data should stay separate from old experiments.

## Hooks

MemPalace documents Codex hooks for automatic saves, especially:

- `Stop`: periodic session save
- `PreCompact`: save before compaction

Hooks can reduce manual memory work, but they are not magic memory. They run
commands and can ask the AI/session to file a checkpoint. The AI still decides
what matters. On Windows, copied shell snippets are fragile; for Theseus, Node
wrappers or MCP-native flows are safer than bash-oriented examples.

Good hook proof is behavioral: a new queue item, drawer, diary, or AutoMem item
appears. Config presence alone is not enough.

## Security and Fragility

Community research around `SKILL.md` warns that skills are operational code and
prompt surface, not harmless documentation. A malicious or sloppy skill can
influence tool selection, governance, or command behavior.

Rules for this lab:

- review third-party `SKILL.md`, scripts, and dependencies before installing
- keep local skills small and auditable
- do not embed secrets in skills, examples, hooks, or logs
- prefer deterministic scripts for repeated external actions
- keep memory writes curated and verifiable

## Natural Automation Ladder For Theseus

1. MCP servers are configured and health-checked.
2. `theseus-memory-stack` skill has trigger words for prior context, memory,
   AutoMem, MemPalace, decisions, debugging history, and handoff.
3. `agents/openai.yaml` declares MCP dependencies for `memory` and `mempalace`.
4. Repo or user-level `AGENTS.md` contains one short memory reflex, not a large
   policy essay.
5. Hooks capture session checkpoints at `Stop` and `PreCompact`.
6. Smoke tests prove the behavior: a fresh task recalls a known decision through
   AutoMem and finds exact wording through MemPalace.

## Limits We Should Accept

- Codex cannot be forced by a skill to call MCP every turn.
- Implicit skill selection can miss; explicit `$theseus-memory-stack` remains a
  useful repair handle.
- Hook examples are not always Windows-safe.
- Docker/stdio MCP transports can have cold-start or framing failures; MemPalace
  3.5.0 mentions HTTP MCP transport and daemon mode as future stability options.
- More automation can create more hidden failure modes. Every automatic memory
  path needs an observable proof artifact.

## Recommendation

Keep the stack layered and boring:

- AutoMem for distilled durable memory.
- MemPalace for exact scoped recall.
- `theseus-memory-stack` as the small coordination skill.
- `agents/openai.yaml` for MCP dependency metadata.
- hooks only for checkpoints and compaction safety.
- no bulk mining of old pilot data unless a dry run shows useful signal.

The goal is not to make memory fire on every message. The goal is to make it
reflexive at the moments where model-only recall is most likely to drift:
session start, prior-context questions, debugging, handoff, decisions, and
before compaction.
