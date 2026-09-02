# Pre-prompt standards for subagent councils (user principles, formalized)

User principles (2026-08-31), to be embedded in every council dispatch:

1. ASK-DONT-ASSUME: if critical context is missing, the agent must ask
   clarifying questions instead of silently filling gaps. For one-way
   subagent channels (no Q&A possible), the equivalent contract is:
   mark `MISSING: <what>` in REASONING and state how it would change
   the verdict — never silently assume.
2. FACTS vs ASSUMPTIONS: every claim is labeled FACT (follows from
   provided verified data) or ASSUMPTION (plausibly reconstructed).
   Anything load-bearing that is only ASSUMPTION must be confirmed
   before acting on it.
3. RESULT STANDARD: the request defines acceptance rules, not just
   the task — required format (VERDICT | CONFIDENCE | REASONING |
   WHAT WOULD CHANGE MY MIND), grounding in listed facts, word limits,
   and a closing self-critique (WEAKEST POINT).

## Deliverable, capability, and mutation contract

Every council brief must declare these fields before dispatch:

```yaml
packet_id: stable packet identifier
council_opt_in: true
opt_in_basis: exact user instruction or approved workflow reference
advisory_runtime: locked_down_process
tool_inventory_verified: true
task_mode: review | implementation_proposal | sandbox_implementation | verification
deliverable_type: concrete, named artifact required
mutation_scope: none | isolated_workspace | real_repo | external_system
capabilities:
  filesystem: none | isolated_worktree
  web: none | bounded_read
  network: none | internal_only | allowlist
  docker: none | ephemeral_compose_wrapper
  secrets: forbidden
  external_writes: forbidden
acceptance_artifact: exact files, fields, tests, and commands
promotion_gate: explicit user approval before real-repo or runtime mutation
```

A council is opt-in. Do not infer permission to fan out from task complexity,
architecture, security, a request for a second opinion, or a loaded skill. If
the user has not explicitly requested a council, use one model or one bounded
worker and keep the normal execution route.

For a practical engineering task, `review` is not a sufficient mode. Use
`implementation_proposal` when children must return concrete file paths,
interfaces, algorithm, schema, fixtures, tests, and patch/pseudocode without
writing files. Use `sandbox_implementation` only when writes are confined to
the named isolated workspace. A verdict without the declared deliverable is
an incomplete result, not a completed council.

Before fan-out, run a packet-integrity sentinel that echoes `packet_id`,
`task_mode`, and `mutation_scope`. A missing or truncated brief stops the
batch and is classified as delivery failure, never as model-quality evidence.

The repository preflight implementation is:

```bash
node tools/council_preflight/council_preflight.mjs --input <brief.json>
```

Exit `0` means the brief is admissible; exit `2` means the brief must not be
dispatched. The validator is intentionally narrow: it checks the contract and
side-effect boundary, while packet-specific acceptance tests remain the
responsibility of the parent workflow.

Council dispatch template gains a FORMAT ADDITION block with (1)-(3).
Precedent: deleg_a3862069 (helper-config lab design) — principles were
applied too late for steer (children had finished), so they apply to
interpretation of results and all future dispatches.
