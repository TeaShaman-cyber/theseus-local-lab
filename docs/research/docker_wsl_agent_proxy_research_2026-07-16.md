# Docker WSL Agent Proxy Research 2026-07-16

Purpose: avoid inventing a fragile Docker bridge for WSL/Codex agents when
existing Docker API, socket proxy, and Web UI patterns already exist.

## Confirmed Sources

- Docker remote daemon access docs warn that remote API access can expose the
  host to unauthorized access and root-equivalent control if not secured.
  Source: <https://docs.docker.com/engine/daemon/remote-access/>
- Docker daemon socket protection docs recommend SSH or TLS for remote daemon
  access when a network API is needed.
  Source: <https://docs.docker.com/engine/security/protect-access/>
- Docker Desktop settings describe `tcp://localhost:2375` without TLS as a
  legacy integration feature and say to use it with caution.
  Source: <https://docs.docker.com/desktop/settings-and-maintenance/settings/>
- Docker Desktop hardened settings describe exposing port 2375 as an
  unauthenticated TCP socket recommended only for isolated/protected
  environments.
  Source:
  <https://docs.docker.com/enterprise/security/hardened-desktop/settings-management/settings-reference/>
- Docker Engine security docs describe the daemon attack surface and warn that
  exposing the REST API can enable privilege escalation.
  Source: <https://docs.docker.com/engine/security/>
- `tecnativa/docker-socket-proxy` is a HAProxy-based Docker socket proxy that
  blocks API sections by environment-variable allowlist and returns 403 for
  disallowed requests.
  Source: <https://github.com/Tecnativa/docker-socket-proxy>
- LinuxServer `socket-proxy` packages the same security-enhanced Docker socket
  proxy pattern for self-hosted stacks.
  Source: <https://docs.linuxserver.io/images/docker-socket-proxy/>
- Portainer CE supports Docker Standalone and WSL/Docker Desktop installation.
  It provides a Web UI and API-oriented operational plane over Docker.
  Sources:
  <https://docs.portainer.io/start/install-ce/server/docker/wsl>,
  <https://github.com/portainer/portainer>

## Local Finding

Windows side:

```text
http://127.0.0.1:2375/_ping -> OK
DOCKER_HOST=tcp://127.0.0.1:2375 docker version -> 29.6.1
```

WSL side:

```text
raw Docker API tcp://127.0.0.1:2375 -> not reachable
raw Docker API host.docker.internal:2375 -> timeout
raw Docker API WSL nameserver:2375 -> not reachable
socket proxy http://127.0.0.1:23760/_ping -> OK
socket proxy probe from WSL -> OK
```

Interpretation: Docker Desktop's raw exposed API is Windows-local, but a
container-published socket proxy on `127.0.0.1:23760` is reachable from WSL and
can act as the read-only agent diagnostic bridge.

## Candidate Routes

### Route A: Keep Theseus MCP Control Plane

Keep `tools/docker_control_plane/direct_bridge.mjs` as the first agent route.
It is already allowlisted and exposes a small tool surface instead of arbitrary
Docker API access.

Best for: Codex tasks and automation.

Risk: still depends on Windows `tcp://127.0.0.1:2375` while running in Windows.
Needs a WSL-aware transport before agent runtime moves fully into WSL.

### Route B: Add Docker Socket Proxy

Run a local Docker socket proxy such as `tecnativa/docker-socket-proxy` or
`lscr.io/linuxserver/socket-proxy`, with only required API sections enabled:

```text
CONTAINERS=1
INFO=1
NETWORKS=1
IMAGES=1
POST=0 by default
EXEC=0 by default
BUILD=0
VOLUMES=0 unless explicitly needed
```

Best for: read-heavy dashboards, status panels, agent diagnostics, and
container log/inspect operations.

Risk: any enabled write/exec API expands blast radius. Keep it bound to local
or WSL-only network, never public.

Local prototype: `D:\theseus-observatory\docker-proxy-lattice` runs
`tecnativa/docker-socket-proxy` on `127.0.0.1:23760`. Windows and WSL probes
passed; `POST /containers/create` returned `403`.

### Route C: Portainer CE

Deploy Portainer CE for a human-readable Docker UI, then optionally use its API
or web panel for operator visibility.

Best for: Semyon-facing container status, logs, restarts, stack overview.

Risk: Portainer itself needs privileged Docker access. Treat it as a trusted
admin UI, not as the narrow agent API.

### Route D: SSH/TLS Docker Context

Use official Docker contexts with SSH or TLS. This is the clean route for
remote Linux/VM Docker hosts.

Best for: future Ubuntu VM/Kuznitsa host.

Risk: more key/credential management; not the fastest local Windows fix.

## Recommendation

Do not make raw `2375` the agent contract.

Use three layers:

1. Human UI: Portainer CE, optional, local-only.
2. Agent read API: socket-proxy on `127.0.0.1:23760`.
3. Agent action API: Theseus MCP control plane with
   explicit allowlist.
4. Future WSL bridge: scoped local bridge from WSL to the agent API/proxy, not
   broad Docker daemon exposure.

## Follow-Up Tasks

- Add a `D:\theseus-observatory` status panel card for Docker API route:
  `windows-2375`, `wsl-proxy-reachable`, `proxy-write-blocked`,
  `portainer-reachable`.
- Keep `docker-proxy-lattice` in `D:\theseus-observatory` for now because its
  primary role is observability and WSL-agent diagnostics.
- Update `tools/docker_control_plane` docs to distinguish:
  raw Docker daemon, socket proxy, Portainer, and Theseus MCP control plane.
- Audit hooks/skills for hardcoded monolith paths before switching agent runtime
  to WSL.
