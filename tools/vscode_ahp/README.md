# VS Code Agent Host Probe

Purpose: explore VS Code's Agent Host Protocol (AHP) integration without making
it a hard dependency for the Theseus lab.

VS Code 1.128 exposes:

- `code agent host`
- `code agent ps --json`
- `code agent logs <session>`

Microsoft documents AHP as an active-development protocol. Treat this probe as
experimental and keep the file-queue bridge and ordinary VS Code tasks as
fallbacks.

## Commands

```bash
node tools/vscode_ahp/ahp_probe.mjs status
node tools/vscode_ahp/ahp_probe.mjs ps
node tools/vscode_ahp/ahp_probe.mjs ws-smoke
node tools/vscode_ahp/ahp_probe.mjs rpc-smoke
node tools/vscode_ahp/ahp_probe.mjs host
node tools/vscode_ahp/ahp_probe.mjs host-replace
node tools/vscode_ahp/ahp_probe.mjs logs <session-uri>
```

## Safety

- `status` and `ps` are read-only.
- `ws-smoke` checks only WebSocket reachability.
- `rpc-smoke` sends minimal JSON-RPC `initialize` and `listSessions` probes.
- `host` starts a local VS Code agent host bound to `127.0.0.1`.
- `host-replace` restarts the local host when the supervisor/token is stale.
- `host` creates a connection token in ignored `work/vscode_ahp/token.txt`.
- `host` writes its runtime output to ignored `work/vscode_ahp/host.log`.
  VS Code includes the WebSocket token in that log. Do not commit or paste it.
- Do not use `--without-connection-token`.
- Do not expose the host on `0.0.0.0` unless there is a separate authenticated
  network boundary.
- Running VS Code CLI from the Codex sandbox can fail with `EPERM` on
  `AppData/Roaming/Code`. That is a context-boundary signal. Prefer running the
  VS Code tasks from the real VS Code/user context for this probe.

## Current Role

AHP is the candidate direct bridge for Codex-to-VS-Code-agent coordination.
MCP remains the tool layer exposed to VS Code/Copilot Agent through
`.vscode/mcp.json`.
