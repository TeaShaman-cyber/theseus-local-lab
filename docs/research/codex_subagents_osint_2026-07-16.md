# Codex Subagents: Practical Research Note

Date: 2026-07-16

Purpose: use Codex subagents as bounded workers in Theseus without confusing
parallelism with continuity, memory, or a replacement for the lead engineer.

## Confirmed From Current OpenAI Documentation

- A subagent is a delegated Codex agent running in its own agent thread. The
  parent task collects its result.
- Subagents are useful when work is genuinely independent: exploration, tests,
  log triage, and summarization. They keep noisy intermediate output away from
  the lead task.
- Each subagent does its own model and tool work, so it costs more tokens than
  an equivalent single-agent pass.
- Local Codex clients can define custom agents with different instructions and
  model configurations. The actual available controls must still be verified
  in the current client surface.
- GPT-5.6 Ultra may proactively delegate suitable independent work. At other
  intelligence levels, delegation is normally explicit.
- The current guidance recommends `gpt-5.6` for demanding multi-step work and
  `gpt-5.6-terra` for faster, lower-cost light work.

Primary source: [OpenAI Codex subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## What A Subagent Is Not

It is not a durable second self, a shared-memory bus, or a background service
that should receive secrets and unlimited authority. It starts with the task
context it is given, performs bounded work, and returns a result. Durable
knowledge still has to pass through AutoMem, MemPalace, local evidence, and
the lead agent's review.

## GPT-5.6 Caveat: Verify Effective Child Configuration

GitHub reports from July 2026 describe a real interface mismatch on some
GPT-5.6 Sol/Terra surfaces: custom-agent selection or a requested child model
can be missing from the visible spawn schema, silently inherit the parent, or
be overridden by a role configuration. These are issue reports, not a stable
product guarantee, but they are sufficiently concrete to change Theseus
practice.

Before relying on a model-pinned worker, confirm from the created child task:

1. effective model;
2. reasoning effort;
3. selected role and developer instructions;
4. sandbox/tool permissions;
5. whether it received a full or bounded context fork.

Relevant reports:

- [#32782: missing custom-agent selector on GPT-5.6 Sol](https://github.com/openai/codex/issues/32782)
- [#31893: restricted spawn schema on GPT-5.6](https://github.com/openai/codex/issues/31893)
- [#19399: custom-agent configuration reports on Windows](https://github.com/openai/codex/issues/19399)

## Theseus Operating Shape

```text
Lad, lead engineer
  owns: goal, integration, memory writes, verification, Git decision

subagent: scout
  owns: read-only OSINT, issue scan, source comparison
  returns: citations plus confirmed / report / inference labels

subagent: inspector
  owns: one bounded test, log slice, or Graphify profile
  returns: commands, evidence, failure class, next smallest step

subagent: worker
  owns: a disjoint file set with tests
  returns: changed paths, validation, limits not crossed
```

Default rule: one child for a bounded side task. Use several only when their
write scopes do not overlap and the lead can continue useful work in parallel.

## Good First Uses Here

- scan Codex issues while the lead fixes a local Graphify wrapper;
- analyze one selected Drive document after it has been normalized and tagged;
- run a read-only review of an isolated task graph or dashboard module;
- test a disposable route with an explicit success condition.

## Poor Uses Here

- writing secrets to Infisical or reading them merely for context;
- moving memory stores or Docker infrastructure across contexts;
- parallel edits to the same harness layer;
- handing a raw chat archive to several agents without provenance boundaries;
- treating a finished subagent summary as verified integration.

## First Pilot

Use a read-only Terra scout for an independent issue scan. Give it a compact
state packet, explicit source criteria, and a request to report only evidence
and uncertainty. Lad then verifies the child configuration and decides whether
any finding becomes a route, test, dashboard alert, or memory item.
