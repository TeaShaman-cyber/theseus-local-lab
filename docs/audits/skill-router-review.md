# Skill-router contract review

Date: 2026-08-02
Decision: `ACCEPT-EDIT`
Scope: main `theseus-skill-router` contract only

## Local baseline

The rollback baseline is private GitHub commit `ddc7ddf` on `main`. The active
working model remains one monolithic project: the global Codex skill is the
runtime surface, the project copy is kept aligned, and the tracked global copy
is the Git backup. No Grok snapshot was copied wholesale.

## Formal lens

Wolfram's natural-language searches returned no domain result, so they were not
treated as evidence. A bounded Wolfram Language model was evaluated instead.
It returned:

```text
bounded_case_invariant -> True
selection_is_not_execution -> True
execution_requires_verification -> True
phase_transition_reenters_router -> True
formal_scope -> model only; runtime conformance still required
```

This is a consistency check for the proposed state model, not proof that the
live Codex runtime follows it.

## Local corroboration

The local Conclave catalog selected the `formal-math` route: Wolfram primary,
local evidence corroborator. The repository checks passed:

- representative route contract: valid;
- route IDs: unique;
- every case: observable stop condition present;
- no-skill receipt: passes;
- memory-continuity receipt: passes;
- skill validation: passes;
- `git diff --check`: passes.

The route-packet executor also produced an allowed packet and kept verification
in `pending` until the selected test action returned output. This confirms that
policy approval is not being mistaken for execution success.

## Finding

The original global router described skill selection and listed executors, but
did not make the execution lifecycle explicit. The project copy already had a
useful route-packet lifecycle, so the smallest coherent change was to align all
three surfaces and add the missing lifecycle wording to the global contract.

The accepted contract is:

```text
select -> hand off -> execute -> verify -> stop
                                      \\-> re-enter router for a new phase
```

The following distinctions are now explicit:

- selected skill is not execution evidence;
- a tool call is not verification evidence;
- memory recall is not current runtime authority;
- repeated equivalent failure goes to `execution-guard`, not blind retry;
- the router remains a dispatcher, not a catalogue of procedures.

## Changed surfaces

The same reviewed content is now synchronized in:

- global runtime: `C:/Users/s.poklad/.codex/skills/theseus-skill-router/SKILL.md`;
- project copy: `.agents/skills/theseus-skill-router/SKILL.md`;
- Git backup: `backups/codex-skills/global/theseus-skill-router/SKILL.md`.

No separate project runtime, resolver, background synchronizer, or monitoring
subsystem was introduced.

## Remaining gap

The first two executor-backed paths are now proven:

- `theseus-shell-routing` selects the real VS Code task
  `Theseus: skill-router contract tests`; the task definition is valid and its
  45 focused tests pass;
- `execution-guard` emits `LOOP_DETECTED` for three equivalent failures,
  distinguishes different failure classes, and does not retry by itself.

The changed execution surfaces are [`.vscode/tasks.json`](../../.vscode/tasks.json),
`tools/execution_guard/loop_guard.mjs`, and its focused test. Most other skills
still need executor-backed representative cases. The next bounded slice is the
memory handoff with a read-only AutoMem receipt. Do not bulk-rewrite every skill
before that path is proven.
