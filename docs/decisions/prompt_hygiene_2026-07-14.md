# Prompt Hygiene For The Theseus Harness

Date: 2026-07-14

Source: https://pimenov.ai/knowledge/rekomendatsii-promptingu-gpt-5-6-sol/

Status: accepted as a local hygiene checklist. The source presents itself as a
Russian translation of OpenAI recommendations for GPT-5.6 Sol; verify official
OpenAI documentation before treating model-specific details as canonical API
guidance.

## Decision

Use prompt hygiene as a maintenance pass for Theseus skills, `AGENTS.md`, VS
Code task descriptions, advisor prompts, and documentation plans. Do not turn
this into a large prompt migration or a Sol-only policy.

## Principles

- Start from prompts, skills, and task routes that already work.
- Remove one group of instructions, examples, or tool descriptions at a time.
- Validate changes on representative local tasks before generalizing.
- Keep outcome, constraints, success criteria, stop conditions, validation,
  safety boundaries, access boundaries, secret policy, and route rules.
- Remove duplicated style rules, duplicated process rules, inert examples,
  stale model-specific habits, irrelevant tools, and repeated reminders for
  behavior that is already reliable.
- Prefer outcome-oriented instructions over step-by-step procedural scripts
  unless the procedure is a true invariant or safety gate.
- Define autonomy and approval boundaries in one place; do not repeat the same
  approval rule across every skill.
- Keep skills as route selectors. Put execution in VS Code tasks, scripts, or
  MCP tools. Put durable rationale in AutoMem/MemPalace. Put observable evidence
  in `session_timeline` and `log-lattice`.
- Before increasing reasoning effort or adding another advisor, check whether
  the failure is actually a missing success criterion, dependency rule, tool
  route, or verification loop.
- Compact after milestones, not after every small action, and ensure the
  compacted state preserves the next action, constraints, and proof needed to
  resume.

## Documentation Impact

Documentation audits should include a prompt hygiene pass over agent-facing
instructions. The goal is not shorter documentation everywhere; the goal is to
separate compact routing instructions from detailed references, executable
helpers, memory records, and logs.
