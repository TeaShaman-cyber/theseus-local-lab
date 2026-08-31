## Follow-up: disabling the Desktop plugin does not disable gateway dispatch, and gateway shutdown leaves orphaned workers

I reproduced a more serious runtime variant on Hermes Agent v0.20.1 / Windows 11.

### Reproduction

1. Disable the Kanban plugin in Hermes Desktop.
2. Leave `kanban` absent from `config.yaml` (the normal state when no dispatcher settings were configured).
3. Start `hermes gateway run` manually for an unrelated gateway use.
4. The gateway still starts the embedded Kanban dispatcher because `kanban.dispatch_in_gateway` defaults to `true` independently of the Desktop plugin state.
5. Stop the gateway normally.

### Observed runtime evidence

The gateway log recorded:

```text
kanban dispatcher: holding singleton dispatcher lock (.../.dispatcher.lock)
kanban dispatcher: embedded in gateway (interval=60.0s)
spawned=12, reclaimed=1, crashed=29, promoted=11, auto_blocked=29
```

The gateway then exited cleanly, but seven Kanban worker process trees remained alive as orphans (21 OS process entries including wrappers/children). Eleven task rows and eleven run rows remained `running` after their workers had exited or were terminated.

This was not only resource usage. Before intervention, one worker executed a global Hermes mutation:

```text
hermes mcp remove gtd
```

Other workers wrote files in their isolated worktrees. No destructive container command ran in this reproduction, but the workers had normal tool authority and continued operating after the gateway that spawned them had stopped.

Recovery required:

- terminating the orphaned worker trees manually;
- reclaiming 11 stale tasks/runs through the official `reclaim_task()` path;
- deleting the stale dispatcher lock after confirming no dispatcher remained;
- explicitly setting `kanban.dispatch_in_gateway=false`.

Database integrity remained `ok`; the failure was lifecycle/authority cleanup, not SQLite corruption.

### Gap in #87313

PR #87313 adds an important warning before gateway startup, but this reproduction shows two runtime defects that disclosure alone does not address:

1. **Authority mismatch:** disabling Kanban in Desktop does not gate the gateway dispatcher. The gateway silently treats an absent `kanban` section as dispatch enabled.
2. **Lifecycle leak:** normal gateway shutdown does not terminate/reclaim all worker children, so workers can outlive the dispatcher and continue tool execution.

### Requested runtime safeguards

Please consider either extending #87313 or tracking follow-up fixes for:

- a visible, shared source of truth for Kanban dispatch enablement across Desktop and gateway;
- fail-closed behavior when the plugin is disabled or dispatch intent is not explicit;
- gateway shutdown that terminates and reclaims every worker it spawned;
- startup/shutdown regression tests covering orphan prevention and stale-run cleanup;
- a bounded default for concurrent workers, independent of per-tick spawn limits.

The local mitigation `kanban.dispatch_in_gateway=false` is effective, but users should not need to discover this hidden independent switch after an accidental fan-out.

---

Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
