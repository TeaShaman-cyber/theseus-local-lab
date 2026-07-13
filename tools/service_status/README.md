# Service Status

Small Node helper for VS Code tasks that need service health checks without
PowerShell pipelines or long shell strings.

## Commands

```text
node tools/service_status/service_status.mjs automem
node tools/service_status/service_status.mjs observatory --tail 40
node tools/service_status/service_status.mjs backup --tail 40
node tools/service_status/service_status.mjs docker-control-health
node tools/service_status/service_status.mjs port --host 127.0.0.1 --port 8088
```

Docker commands use `DOCKER_HOST=tcp://127.0.0.1:2375` by default and reuse the
repository Docker CLI config when present.

## Scope

This helper is for read-only status checks. Keep starts, rebuilds, secret
operations, and destructive actions in explicit VS Code tasks, MCP tools, or
dedicated scripts.
