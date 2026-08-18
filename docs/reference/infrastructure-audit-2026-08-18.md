# Infrastructure and memory audit — 2026-08-18

Read-only audit of the Docker/runtime ownership registry.

## AutoMem

- Docker labels confirm the active compose project is `automem` and the source
  working directory is the nested `work/automem` clone.
- Active containers: `automem-flask-api-1`, `automem-falkordb-1`,
  `automem-qdrant-1`.
- Direct authenticated `GET /recall` against `http://127.0.0.1:8001` returned
  HTTP 200 and one result for a bounded `Theseus` query. This proves a live
  read path, not write health or Hermes MCP integration.
- `hermes mcp test automem` returned `Connection closed`. Hermes direct MCP
  exposure is therefore not verified in this session.
- The current Hermes memory provider is Hindsight, not AutoMem. Codex remains
  AutoMem-first according to the harness boundary; provider claims must be
  verified per harness.

## Hindsight

- Compose source: `D:/hindsight/docker-compose.yml`.
- Container: `hindsight-api`, image `ghcr.io/vectorize-io/hindsight:latest`.
- Compose labels point back to `D:/hindsight`; ports are 8888 (API) and 9999
  (control plane); pg0 is mounted from `D:/hindsight/pg0`.
- Runtime restart policy observed from Docker: `unless-stopped`.
- Hermes reports the provider as available, but a direct bounded Hindsight
  `/memories/recall` request timed out. Health/configuration is not treated as
  proof of a working recall path.
- Hindsight remains Hermes-only in the current registry. A future Codex bank or
  namespace is a separate planned integration, not current capability.

## Recovery reconciliation

The recovery contract IDs now match the infrastructure registry for active
recovery-managed stacks:

```text
automem, mempalace, graph-viewer, dashboard, log-lattice,
backup, docker-read-proxy
```

Intentional registry-only entries:

```text
hindsight             — Hermes-only, excluded from workshop recovery pending verification
stateful-agent-net    — disabled, excluded from recovery
```

No Docker stack was started, stopped, restarted, or reconfigured during this
audit.
