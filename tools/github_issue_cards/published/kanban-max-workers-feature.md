---
status: APPROVED
operation: create
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "feature request: add global max_concurrent_workers + explicit dispatch opt-in for Kanban"
issue_type: feature_request
issue_number: 87284
verified_at: 2026-08-15
purpose: "Add a global max_concurrent_workers config (default: 2-3) and require explicit opt-in before dispatcher auto-promotes tasks. Prevents parallel worker floods from a single batch of ready tasks."
observed: "After installing gateway, all 14 triage tasks were promoted and spawned workers in parallel, freezing the system. Current failure_limit (default 2) is a per-task circuit breaker, not a global concurrency cap."
labels:
  - enhancement
---

# [Feature]: Kanban: global max_concurrent_workers + explicit dispatch opt-in

## Problem or Use Case

After installing gateway, the dispatcher auto-promoted all 14 triage tasks and forked workers in parallel. The system froze from 30+ concurrent processes. `kanban.failure_limit` (default 2) is a per-task circuit breaker, not a global concurrency limit.

## Proposed Solution

- Add `kanban.max_concurrent_workers` config (default: 2-3)
- Require explicit opt-in (`hermes kanban dispatch --enable` or similar) before dispatcher auto-promotes tasks
- Without opt-in, tasks stay in `ready` until user explicitly promotes them

## Alternatives Considered

- Lower `failure_limit` globally — doesn't help, it's per-task
- Manual `promote` per card — works but doesn't prevent future floods if user forgets

## Additional Context

User was on free model (longcat). On paid models, this would burn significant token budget silently.
