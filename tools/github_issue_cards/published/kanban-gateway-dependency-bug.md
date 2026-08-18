---
status: APPROVED
operation: create
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "report bug: kanban plugin does not declare gateway as a hard dependency or warn about auto-dispatch at install time"
issue_type: bug_report
issue_number: 87283
verified_at: 2026-08-15
purpose: "Kanban plugin docs/installer does not disclose that gateway is a required dependency, or that the dispatcher auto-promotes and forks workers. User treats it as a passive task board, installs gateway later, and accidentally triggers a multi-agent orchestration system."
observed: "Installed native Kanban plugin thinking it was a simple task board. After installing gateway (for a separate cron job), the dispatcher auto-promoted triage tasks and spawned 30+ worker processes, freezing the laptop. Installer/docs do not warn about: (1) gateway as hard dependency, (2) auto-dispatch without explicit opt-in, (3) no global concurrency cap."
labels:
  - bug
---

# [Bug]: Kanban plugin does not declare gateway dependency or auto-dispatch behavior

## Bug Description

The Kanban plugin's installer and documentation do not disclose that gateway is a hard dependency, or that the dispatcher auto-promotes tasks and forks workers without explicit user opt-in. This led to an accidental multi-agent orchestration spawn.

## Steps to Reproduce

1. `hermes kanban init`
2. Create several backlog cards in `triage` (including a card titled "Remove orphan/artifact Docker containers")
3. Install and start `hermes gateway` (separately, for another job)
4. Dispatcher auto-promotes triage → ready → running, forks workers for each
5. Card "Remove orphan/artifact Docker containers" moved to `ready` **without user approval** — worker could have executed `docker rm` on running containers
6. System froze from 30+ concurrent worker processes before user could intervene

## Expected Behavior

Documentation at install time should warn: gateway is required, dispatch is automatic, and there is no global concurrency cap. Destructive operations (docker rm, file deletion) should require explicit user approval before execution.

## Actual Behavior

Silent auto-dispatch once gateway runs, spawning unlimited workers. A card describing container removal was promoted to `ready` without user confirmation — the worker could have executed destructive commands. User discovered the behavior only after the laptop froze, and only a hard reboot stopped the workers.

## Post-Crash Recovery Failure

After hard-reboot, I initially thought the database was lost. Investigation revealed it persisted at `AppData/Local/hermes/kanban.db` and was recoverable via Python `sqlite3` module. However:
- Worker logs in `<root>/kanban/logs/` were empty (workers had no time to write before freeze)
- No crash recovery mechanism exists: tasks that were `running` are neither reclaimed nor resumed after restart
- `hermes kanban init` may silently replace the DB if it cannot find the existing one
- **Result: without knowing the exact DB location, the incident history would appear lost**

This is a safety issue: without audit trail, a destructive action (docker rm, file deletion) could have occurred with no way to detect or revert it.

## Missing Approval Gate for Destructive Operations

From source code review: workers receive full `terminal` access. There is **no approval gate** for destructive commands (docker rm, file deletion, service stop). The only guard is `kanban_stop.py` (workers must end with `kanban_complete` or `kanban_block`). Any card titled "remove", "clean up", "delete" can execute destructive operations without user confirmation.

This means the system auto-dispatched a card titled "Remove orphan/artifact Docker containers" that could have run `docker rm -f` — and it would have succeeded without user sign-off.

## Post-Mortem from Kanban UI (verified from screenshot, card `t_010fa0d4`)

After reboot, examining the Kanban dashboard in Hermes Desktop revealed:
- **4 runs** of the same card — all failed: 2 `reclaimed` (manual intervention), 1 `crashed` (pid not alive), 1 `running` (hung)
- **WORKER LOG shows 0 tool calls** — the worker received the prompt but executed no commands before hanging
- **Good news**: `docker rm` was NOT executed — the worker never started actual work
- **Bad news**: the dispatcher kept retrying a failing worker (4 attempts), and the card was auto-promoted to `READY` without user approval

## Environment

- Hermes v0.20.1, Windows 11
- Model: meituan/longcat-2.0:free (free tier — financial damage on paid models)
