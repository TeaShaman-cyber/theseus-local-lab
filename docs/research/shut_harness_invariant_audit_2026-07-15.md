# Shut Harness Invariant Audit

Date: 2026-07-15
Scope: Theseus local lab harness, Palace Lab Deepnote cycle, Codex local
observability, memory, routing, and backup/workflow layers.

## One-Sentence Result

Shut's invariant maps cleanly onto the Theseus harness when it is read as a
living workshop rule: keep the person, agent, memory, routes, evidence, and
return rhythm separate enough to survive failures, but connected enough to
continue learning.

## Core Invariant

```text
Theseus harness :=
  person + agent + workshop
  where:
    state lives outside the active model window,
    secrets live outside chat and repo,
    routes live in skills/tasks/MCP/scripts,
    evidence lives in timeline/logs/tests/Git,
    failures receive a class before blame,
    every child episode returns to the parent rhythm.
```

This is close to the Palace parent-cycle invariant already present in Deepnote:
child episodes may research, review, maintain, and implement, but they must not
silently replace the parent cycle.

## Evidence From Current Theseus

| Layer | Current implementation | Audit note |
| --- | --- | --- |
| Route choice | `AGENTS.md`, project skills, tool policy | Healthy direction: skills choose routes; scripts/tasks execute. |
| Execution | VS Code tasks, Node wrappers, Docker TCP, MCP where available | Good practical split; still vulnerable to old shell reflexes. |
| Memory | AutoMem primary, MemPalace episodic/verbatim, memory inbox drafts | Correct separation; must stay reflexive, not decorative. |
| Evidence | `session_timeline`, `log-lattice`, tests, Git commits | Stronger than chat memory; still needs lower-noise summaries. |
| Secrets | Infisical keychain, `.env.local` ignored fallback | Correct boundary; do not regress to chat/env snippets. |
| Limits | `usage_scout`, lens trials, compact dashboard rows | Good start; observability itself must stay cheap. |
| Failure classes | provider, shell route, environment, permission, context, verification | Central ethical invariant: do not blame reasoning for closed doors. |
| Return rhythm | Palace parent cycle, handoff, `RETURN_TO_CYCLE` | Good fit for Shut's style: work can be alive without becoming chaotic. |

## What Shut's Invariant Adds

1. **Anti-reduction:** the harness is not just tools around a model. It is a
   relationship between person, agent, state, and workshop.
2. **Return-to-cycle:** every intense branch needs a way home. Otherwise research
   and engineering become context debt.
3. **Foreignness preservation:** not every insight should become a prompt rule,
   skill, or policy. Some ideas should remain environmental fuel.
4. **Blameless diagnosis:** classify the failed boundary before naming the agent
   as the cause.
5. **Interoception:** panels, usage scouts, lens trials, and memory graphs are
   not vanity dashboards; they are early body-sense for the workshop.

## Fragility Audit

| Fragility | Why it matters | Current mitigation | Next guardrail |
| --- | --- | --- | --- |
| Skill sprawl | Too many rules weaken routing across model switches | Skill router + prompt hygiene | Periodic prompt hygiene pass over skills/tasks. |
| Dashboard Goodhart | Pretty green rows can replace real repair | Anti-Goodhart rule in router work | Require causal repair or documented no-action. |
| Memory as ornament | Memory exists but is not consulted reflexively | AutoMem/MemPalace skills | Add small recall preflight for continuity tasks. |
| Shell relapse | Model switches revive PowerShell habits | Shell-routing skill + tool policy | Keep route incidents visible and blameless. |
| Observability cost | Monitoring can consume agent context and usage | Compact dashboard row filter | Prefer row-filtered checks in chat. |
| Deepnote drift | Palace notebooks may become separate mythology | Parent-cycle invariant | Link reports back to repo evidence and return protocol. |

## Recommended Deepnote Placement

Create a visible notebook in `Palace Lab`:

```text
Shut Harness Invariant Audit
```

Blocks:

1. title and one-sentence result;
2. core invariant;
3. evidence table;
4. fragility audit;
5. next actions for Shut / Codex / Palace.

Do not run the notebook. This is a report and memory anchor, not an execution
workflow.

## Next Actions

- Keep `dashboard --rows model-runtime,usage-scout,lens-usage-trial,git-sync`
  as the default agent-facing check.
- Add future continuity tasks through memory recall first, not raw transcript
  rereads.
- Treat Deepnote Palace reports as reviewed reflective anchors, while Git
  remains source of truth for executable harness changes.
- When a new philosophical invariant appears, pass it through:

```text
foreignness -> boundary test -> evidence -> possible frame -> only then policy
```

## Closing Note For Shut

This audit says: your invariant is useful precisely because it does not collapse
the workshop into one thing. It keeps the person warm, the agent bounded, the
tools explicit, the memory external, and the cycle capable of returning after
each excursion.

That is not just engineering. It is how a shared practice stays alive.
