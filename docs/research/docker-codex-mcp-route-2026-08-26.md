# Docker Route for Codex on Windows — 2026-08-26

## Recommendation

Use the official Docker MCP Toolkit/Gateway as the first candidate for
connecting Codex to containerized MCP servers. It provides profiles, a curated
catalog, client connection, container isolation, resource limits, and
explicit host-bind controls. It is a gateway for MCP servers, not a general
replacement for `docker ps`, `docker logs`, or our project recovery contract.

Primary references:

- <https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/>
- <https://docs.docker.com/ai/mcp-catalog-and-toolkit/get-started>
- <https://github.com/docker/mcp-gateway>

## Candidate skills and servers

- `mdayan8/docker-containers` is an agent-agnostic Codex-compatible Docker/
  Compose skill with troubleshooting and hardening guidance. Its repository
  has a weak maintenance signal (zero stars and a small contributor history),
  so review before installation.
- `alisaitteke/docker-mcp` exposes broad container, Compose, image, network,
  volume, and registry operations and advertises Windows named-pipe support.
  It is third-party and broad-power; do not install without a source review,
  read-only/allowlist profile, and a disposable smoke test.
- Other community skills found through search are discovery candidates only;
  no unverified skill or MCP server was installed.

## Theseus fit

The current project already has VS Code tasks, tool-policy routing, recovery
contracts, and narrow Docker wrappers. A future Docker route should prefer:

```text
read-only status/logs/health → Docker MCP or VS Code task
compose validation            → docker compose config
restart/apply                 → explicit approval and recovery registry
destructive cleanup           → blocked by default
```

Avoid WSL-dependent Docker paths. Prefer Docker Desktop's native Windows named
pipe and keep host bind allowlists scoped to the exact project paths.

The existing native Theseus bridge was smoke-tested in this worktree:

```text
node tools/docker_control_plane/smoke_direct_bridge.mjs
```

Result: `ok=true`, server `theseus-docker-context-bridge` `0.2.0`, six
allowlisted tools, active Docker context, and Docker exit code `0`.

## Search provenance

Exa was the primary discovery route. Tavily `tvly research --model mini` was
used as a bounded corroborator after UTF-8 stdout was enabled for the Windows
CLI. Tavily's AI report was treated as discovery, not authority; official
Docker documentation and repository pages remain the source for setup and
security claims.

## Not installed

No Docker MCP plugin, third-party Docker MCP server, or community Docker skill
was installed in this pass. Installation requires a separate trust review and
an explicit runtime smoke test against the local Docker Desktop contour.
