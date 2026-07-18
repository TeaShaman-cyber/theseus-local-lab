# Theseus Docker Control Plane

Small Docker control bridge for the Windows split-context problem.

Codex often runs as `SPOKLAD\CodexSandboxOffline`, while Docker Desktop is
authorized in the normal `s.poklad` user session. Direct `docker.exe` MCP
servers inherit the sandbox identity and fail on Docker Desktop state such as
`C:\Users\s.poklad\.docker\config.json` or `npipe:////./pipe/docker_engine`.

For Windows, Docker Desktop can expose its daemon on `tcp://127.0.0.1:2375`,
and Codex can use a small allowlisted stdio MCP server with an explicit
`DOCKER_HOST`. In WSL, leave `DOCKER_HOST` unset: the same bridge then uses the
native Docker Unix socket.

Important: treat raw `2375` as a Windows-local legacy bridge, not the durable
agent contract. Docker's own documentation warns that unauthenticated TCP daemon
access can become root-equivalent host access if exposed outside an isolated
local boundary.

For WSL migration, prefer an allowlisted layer:

- read-heavy diagnostics through
  `D:\theseus-observatory\docker-proxy-lattice` on `http://127.0.0.1:23960`;
- privileged actions through this Theseus Docker MCP/control plane;
- Portainer CE as an optional human-facing Web UI, not the minimal agent
  permission layer.

Fallback path: if TCP exposure is disabled later, run `daemon.mjs` in the normal
user context and connect Codex through `bridge.mjs`.

## Files

- `direct_bridge.mjs` - preferred MCP stdio bridge; uses an explicit Docker
  host when configured, otherwise the native Docker context.
- `daemon.mjs` - fallback HTTP daemon; run from VS Code or a normal user terminal.
- `bridge.mjs` - fallback MCP stdio bridge for the daemon.

## Preferred Codex MCP config

Replace or add a Docker bridge server in `C:\Users\s.poklad\.codex\config.toml`:

```toml
[mcp_servers.theseus_docker]
command = 'node'
args = ['C:\Users\s.poklad\Documents\Codex\2026-07-08\life-science-research-plugin-life-science-4\tools\docker_control_plane\direct_bridge.mjs']
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 90

[mcp_servers.theseus_docker.env]
DOCKER_HOST = 'tcp://127.0.0.1:2375'
THESEUS_PROJECT_ROOT = 'C:\Users\s.poklad\Documents\Codex\2026-07-08\life-science-research-plugin-life-science-4'
```

## Fallback daemon

Run from the project root in VS Code or a normal user PowerShell where Docker
Desktop works:

```powershell
node tools/docker_control_plane/daemon.mjs
```

Or use the VS Code task:

```text
Theseus Docker Control: start daemon
```

Default URL:

```text
http://127.0.0.1:8767
```

Fallback Codex MCP config:

```toml
[mcp_servers.theseus_docker_fallback]
command = 'node'
args = ['C:\Users\s.poklad\Documents\Codex\2026-07-08\life-science-research-plugin-life-science-4\tools\docker_control_plane\bridge.mjs']
enabled = false
startup_timeout_sec = 30
tool_timeout_sec = 90

[mcp_servers.theseus_docker_fallback.env]
THESEUS_DOCKER_CONTROL_URL = 'http://127.0.0.1:8767'
```

Keep the old Docker Desktop MCP entry disabled or leave it as a fallback while
testing.

## Exposed tools

- `docker_tcp_health`
- `docker_ps`
- `docker_logs`
- `docker_compose_ps`
- `docker_compose_logs`
- `docker_compose_up_service`

The bridge is intentionally allowlisted. It does not expose arbitrary shell
execution, secret reads, volume dumps, or destructive Docker operations.
