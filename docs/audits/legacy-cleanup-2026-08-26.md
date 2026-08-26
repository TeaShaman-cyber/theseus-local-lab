# Legacy Cleanup Audit — 2026-08-26

## Removed

The following tracked artifacts belonged only to the abandoned Windows-to-WSL
Codex task rebind attempt:

```text
tools/codex_thread_relink/README.md
tools/codex_thread_relink/relink_thread_workspace.mjs
tools/codex_thread_relink/relink_thread_workspace.test.mjs
outputs/lab_journals/wsl_migration_conclave_2026-07-18.docx
outputs/wsl_migration_preflight/latest.json
```

The relink tool depended on a WSL `/mnt/c` path and an implicit `sqlite3`
binary, while the active Codex contour is Windows-native. The migration output
was stale evidence rather than a current source of truth.

The Copilot advisor legacy surface was also removed:

```text
.agents/skills/theseus-copilot-advisor/SKILL.md
tools/copilot_advisor/README.md
tools/copilot_advisor/copilot_advisor.mjs
tools/copilot_advisor/copilot_advisor.test.mjs
```

Its proxy/task bridge was not a required runtime dependency and introduced a
flaky Windows shell timeout path. GitHub, CI, and repository work remain
available through local evidence, Git tooling, and the approved GitHub route.

## Retained deliberately

`tools/wsl_migration_preflight/` remains for now because it is still referenced
by the workshop dashboard, service-status route, tool policy, and historical
WSL portability documentation. Removing it safely requires one separate
cross-cutting retirement change that removes or replaces those references.

`stateful-agent-net/` also remains for now. It is disabled and excluded from
recovery, but backup, dashboard, and restore code still reference its state
shape. It must not be deleted without first replacing those consumers.

## Verification

- Exact removal targets were resolved under the isolated worktree before
  deletion.
- `rg` finds no remaining code reference to `codex_thread_relink` or its
  deleted output paths.
- The remaining WSL preflight references are intentional and listed above.
- No active VS Code task, skill-observatory trigger, conclave oracle, or GTD
  item points to the retired Copilot advisor.
- The repository-wide `node --test` run after the cleanup completed with
  `166 passed, 0 failed`; the former Copilot advisor timeout test is no longer
  part of the suite.
- No global Codex config, trigger-tree hook, memory provider, or secret file was
  changed.

## Follow-up

- Decide whether WSL portability checking remains a supported capability. If it
  is retired, remove the preflight tool and update all consumers in one
  reviewed change.
- The `workshop_recovery` test was reconciled with the current seven-stack
  manifest in this same branch; its live Docker availability remains a separate
  runtime concern.
