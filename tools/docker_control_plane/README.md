# Theseus Docker Control Plane

Small Docker control bridge for the Windows split-context problem.

Codex often runs as `SPOKLAD\CodexSandboxOffline`, while Docker Desktop is
authorized in the normal `s.poklad` user session. Direct `docker.exe` MCP
servers inherit the sandbox identity and fail on Docker Desktop state such as
`C:\Users\s.poklad\.docker\config.json` or `npipe:////./pipe/docker_engine`.

On Windows, the preferred route is to leave `DOCKER_HOST` unset and let the
bridge use the active native Docker Desktop context. In WSL, the same bridge
uses the native Docker Unix socket. This avoids coupling the agent to WSL paths
or an unauthenticated TCP daemon.

Treat `tcp://127.0.0.1:2375` as a Windows-local legacy diagnostic fallback only.
Docker's own documentation warns that unauthenticated TCP daemon access can
become root-equivalent host access if exposed outside an isolated local
boundary. Do not use it as the durable Codex agent contract.

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

If Codex needs a project-local MCP entry, use the native active context:

```toml
[mcp_servers.theseus_docker]
command = 'node'
args = ['<repo>\\tools\\docker_control_plane\\direct_bridge.mjs']
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 90

[mcp_servers.theseus_docker.env]
THESEUS_PROJECT_ROOT = '<repo>'
```

Do not add `DOCKER_HOST` to this native profile. Set it only for a separately
approved legacy-TCP diagnostic and remove it afterward.

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

- `docker_tcp_health` (compatibility alias; checks the active Docker context)
- `docker_ps`
- `docker_logs`
- `docker_compose_ps`
- `docker_compose_logs`
- `docker_compose_up_service`

The bridge is intentionally allowlisted. It does not expose arbitrary shell
execution, secret reads, volume dumps, or destructive Docker operations.

`node tools/docker_control_plane/smoke_direct_bridge.mjs` verifies the active
Docker context. Add `--legacy-tcp` only when diagnosing the explicit fallback.
