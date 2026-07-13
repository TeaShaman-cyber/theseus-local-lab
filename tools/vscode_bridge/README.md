# VS Code Bridge

Purpose: give Codex a narrow, observable way to request work from the normal
VS Code/user context without driving the UI by hand.

The bridge uses a file queue under ignored `work/vscode_bridge/`:

- Codex writes a JSON request into `inbox/`.
- A VS Code task runs `node tools/vscode_bridge/bridge.mjs worker`.
- The worker executes only allowlisted commands.
- Results are written into `outbox/`.

## Start Worker

In VS Code, run:

```text
Tasks: Run Task -> Theseus IDE Bridge: start worker
```

The task also has `runOn: folderOpen`; VS Code may ask once whether automatic
folder tasks are allowed.

## Request From Codex

```bash
node tools/vscode_bridge/bridge.mjs enqueue git_status --wait 30000
node tools/vscode_bridge/bridge.mjs enqueue commit_checkpoint_default --wait 120000
```

## Allowlist

- `git_status`
- `scan_staged`
- `commit_checkpoint_default`
- `commit_checkpoint`
- `docker_tcp_ps`

This is intentionally small. Add new commands only when the workflow repeats.
