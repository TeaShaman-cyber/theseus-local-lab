# Codex Thread Relink

Small repair tool for rebinding an existing Codex Desktop task from an old
Windows project path to the WSL project clone.

It exists because Codex Desktop currently has no reliable UI action for
repointing an existing long task to another workspace root. The tool updates
only local Codex metadata:

- `state_5.sqlite`: the selected thread `cwd`
- `.codex-global-state.json`: workspace/project hints used by the desktop UI

It does not rewrite raw transcript history by default.

## Current Theseus Rebind

Target thread:

```text
019f4194-f804-7d70-bf1f-c74e74f7781f
```

Target WSL runtime root:

```text
/home/poklad/theseus-local-lab
```

Target desktop workspace root:

```text
\\wsl.localhost\Ubuntu-24.04\home\poklad\theseus-local-lab
```

## Safe Runbook

First inspect the planned changes while Codex may still be open:

```bash
cd /home/poklad/theseus-local-lab
node tools/codex_thread_relink/relink_thread_workspace.mjs --dry-run
```

If the dry run shows only the intended thread and paths:

1. Close Codex Desktop completely.
2. Run:

```bash
cd /home/poklad/theseus-local-lab
node tools/codex_thread_relink/relink_thread_workspace.mjs --apply --codex-closed
```

3. Start Codex Desktop again.
4. Ask the task to verify its `pwd`, git root, memory health, and Docker bridge.

The tool creates backups in:

```text
/mnt/c/Users/s.poklad/.codex/relink-backups/<timestamp>
```

## Clone Test

Run the local test before touching the live Codex state:

```bash
cd /home/poklad/theseus-local-lab
node --test tools/codex_thread_relink/relink_thread_workspace.test.mjs
```

The test copies `.codex` state files into `/tmp`, applies the rebind to that
copy, and verifies the expected fields.

## Notes

- Do not use `--apply` while Codex Desktop is open. The app may overwrite the
  state on shutdown or keep stale state in memory.
- Use `--update-rollout-meta` only if we deliberately decide to rewrite
  structured `cwd` fields in rollout JSONL metadata. Raw conversation text
  should remain evidence, not a mutable project config.
