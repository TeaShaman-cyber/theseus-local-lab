# Sonar HTTP Transport Canary Design

## Goal

Add a parallel, localhost-only Streamable HTTP transport for the Docker-backed
Sonar MCP server so Codex Desktop can be tested without a Windows/WSL/Docker
stdio process chain. The existing stdio route remains available as the
baseline and is not removed or silently replaced.

## Context and authority boundary

The Docker-backed Sonar dependency route is independently healthy: the image
builds, the named DuckDB volume persists, AutoMem refresh has verified
read-back, and direct MCP stdio smoke exposes `sonar_status`, `sonar_refresh`,
and `sonar_preflight`. After a Codex restart, those tools are still absent from
the native Desktop tool surface. This is consistent with the project's
existing Windows Desktop/WSL stdio MCP reproduction, but does not prove that
stdio alone is the cause.

Runtime authority remains the live Docker/AutoMem/Git/test evidence. AutoMem is
the semantic source, DuckDB is a rebuildable cache, Sonar is read-only, and
neither memory nor the HTTP route overrides live operational verification.

## Selected architecture

The HTTP canary uses the existing Python FastMCP application and Docker image.
The container publishes only `127.0.0.1:8791` to the host and serves MCP at
`/mcp` using Streamable HTTP. The named `sonar_local_sonar-data` volume and
AutoMem refresh route are unchanged.

```text
AutoMem -> sonar_refresh -> DuckDB named volume
                              |
                              v
                    FastMCP Streamable HTTP :8000
                              |
                    Docker publish 127.0.0.1:8791
                              |
                    Codex project-scoped HTTP MCP
```

The existing stdio launcher remains `mcp`-capable through the Docker wrapper.
The HTTP profile gets a distinct name, `theseus_sonar_http`, so A/B results
cannot be confused with the current `theseus_sonar` profile.

## Components and contracts

### Docker service

- Add an HTTP command/profile without changing the default persistent stdio
  command.
- Bind host port `127.0.0.1:8791` to container port `8000`.
- Keep the existing named volume mounted at `/var/lib/sonar`.
- Do not expose the service on LAN interfaces.

### MCP server

- Keep the current tool set and read-only behavior.
- Add a transport entry point that runs FastMCP Streamable HTTP on port 8000.
- Do not add arbitrary shell, filesystem, or Docker-control tools.

### Launcher and project configuration

- Add a narrow Docker HTTP launcher/task for build and protocol checks.
- Add only project-scoped HTTP configuration after the direct canary passes.
- Do not edit the global `C:\Users\s.poklad\.codex\config.toml` in this
  canary.

## Testing and acceptance

TDD starts with a failing test for the HTTP transport command/config contract.
The implementation is accepted only if all of these are fresh and explicit:

1. Static config and launcher tests pass.
2. Docker image builds.
3. Container HTTP endpoint responds only through the localhost bind.
4. An MCP Streamable HTTP client completes `initialize`,
   `notifications/initialized`, and `tools/list`.
5. The tool list is exactly `sonar_status`, `sonar_refresh`, and
   `sonar_preflight`.
6. A read-only `sonar_status` call reads the same named-volume index.
7. A selective `sonar_preflight` call returns a bounded packet.
8. Only then is the project-scoped Codex HTTP profile registered and Desktop
   restarted for an actual tool-surface check.

## Failure and stop conditions

- If direct HTTP MCP handshake fails, stop and preserve the stdio baseline.
- If direct HTTP succeeds but Desktop exposes no HTTP tools, classify the
  result as Desktop MCP discovery/injection failure, not Sonar failure.
- If the HTTP server binds beyond localhost, stop and correct the compose
  binding before any Desktop registration.
- If the existing stdio baseline regresses, stop the canary and restore the
  last verified route without changing global configuration.

## Non-goals

- No removal of the stdio route.
- No WSL or Docker Desktop system-setting changes.
- No global Codex MCP configuration changes.
- No new database, gateway, authentication system, or retry framework.
- No claim that HTTP fixes Desktop until the native tool surface is observed.
