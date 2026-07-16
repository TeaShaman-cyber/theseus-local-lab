# Hermes Agent Lessons For Theseus

Date: 2026-07-16

Purpose: extract reusable design ideas from Hermes Agent, OpenClaw-style
single-domain agents, and GBrain for the Theseus local lab / NII direction.

## Sources Checked

- Hermes Agent GitHub README:
  https://github.com/NousResearch/hermes-agent
- Hermes quickstart:
  https://hermes-agent.nousresearch.com/docs/getting-started/quickstart
- Hermes skills docs:
  https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- Hermes memory docs:
  https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
- GBrain README:
  https://github.com/garrytan/gbrain

## Confirmed Signals

Hermes presents itself as a self-improving agent with a built-in learning loop:
skill creation from experience, skill improvement during use, memory nudges,
past-session search, user modeling, cron, delegation, and multiple terminal
backends.

Hermes explicitly supports a provider-independent stance: hosted providers,
custom OpenAI-compatible endpoints, local/self-hosted models, and model
switching through `hermes model`.

Its quickstart recommends a staged route: get one clean chat working first,
then add gateway, cron, skills, voice, routing, and fallback. This matches the
Theseus preference for runtime proof before widening capability.

Hermes memory is split into small always-in-context files and larger on-demand
session search. It treats memory as curated, bounded, and visible enough for the
agent to manage capacity. Background review can save memory or update skills,
with approval gates available.

Hermes skills are on-demand knowledge documents with progressive disclosure.
The `/learn` flow can turn a local directory, URL, workflow, or pasted procedure
into a reusable skill. Skill writes can be gated and reviewed.

GBrain adds a useful adjacent pattern: a brain is more than retrieval. It
distinguishes raw search from synthesized answers with citations and gap
analysis, supports capture from files/stdin/webhooks, has schema packs, graph
links, cron enrichment, durable subagents, and skill optimization.

## Theseus Mapping

The OpenClaw pattern in the user's note strongly supports splitting the current
monolith into domain agents/projects:

- observatory agent: public telemetry, Codex/provider incidents, local health;
- NII agent: model councils, Hermes/CodeWhale/Bothub/local LLM experiments;
- knowledge-base agent: Drive/chat/PDF ingestion, Graphify, OCR/source lenses;
- backup/safety agent: Google Drive/rclone/git snapshots and restore drills;
- workshop steward: dashboard, hooks, skills, task graph, migration checks.

The important design point is not "many agents" for its own sake. It is
narrower working memory, clearer permission boundaries, smaller skills, and
easier evaluation. A single Codex/Lad lead can remain the trusted engineer while
domain agents become bounded workers.

Hermes also validates a pattern we have been building manually:

```text
event / correction / completed task
  -> background review
  -> memory candidate or skill candidate
  -> approval / test / diff
  -> durable memory or skill update
  -> future route changes
```

Theseus should keep the Goodhart guardrail: a skill or route update counts as
learning only when it changes observable behavior and passes a test or has a
clear no-change rationale.

## Practical Ideas To Steal

1. Add a Theseus `learning-review` background task that runs after meaningful
   sessions and proposes memory updates, skill edits, dashboard alerts, or
   no-action rationales.

2. Treat skill writes like code changes: staged diff, short gist, explicit test,
   and Git commit. This mirrors Hermes' approval gates and protects against
   accidental prompt bloat.

3. Build a "domain agent registry" for D: projects. Each agent should declare:
   domain, allowed tools, memory wing/tags, schedule, inputs, outputs,
   evaluation checks, and escalation route back to Lad.

4. Keep memory two-speed:
   - small always-loaded anchors: identity, north star, current domain contract;
   - larger on-demand recall: AutoMem, MemPalace, Graphify/GBrain-like search.

5. Add gap analysis to knowledge queries. The answer should say what evidence
   was found, which claims are stale/uncited/contradictory, and what source is
   missing.

6. Consider GBrain as a candidate for the future knowledge-base project, not as
   an immediate replacement for AutoMem/MemPalace. Its schema packs and
   `search` vs `think` distinction are especially relevant to Drive/chat
   corpus ingestion.

## Risks

- Hermes-style autonomous skill editing can become prompt drift if it lacks
  tests, diffs, and approval gates.
- Single-domain agents reduce context load, but too many agents create
  orchestration tax unless their contracts are small and machine-readable.
- Always-in-context memory is powerful but expensive; use it only for tiny
  anchors. Large facts belong in recall layers.
- Installing Hermes/GBrain inside the current Windows workshop should not
  happen until D: project split, backups, and WSL/Ubuntu route are stable enough
  to keep the experiment isolated.

## Recommended Next Step

Do not install Hermes yet. First create a small `domain-agent-contract.md`
template in the NII project and use it to describe one bounded future agent:
for example `nii-hermes-scout` or `knowledge-base-ingest-scout`. Then compare
that contract with existing Theseus skills, tasks, hooks, and memory wings.

Distinctive recall phrase: `Hermes single-domain learning loop`.
