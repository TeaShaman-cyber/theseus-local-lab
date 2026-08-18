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

## AutoMem MCP repair

- `hermes mcp test automem` initially returned `Connection closed` because the
  Hermes config pointed to the project `work/mcp-automem-bridge` path after that
  scaffold had been archived.
- The local bridge was restored under the Hermes runtime-owned path
  `C:/Users/s.poklad/AppData/Local/hermes/mcp/automem-bridge`, the package
  metadata was pinned to `@verygoodplugins/mcp-automem@0.15.0`, and the config
  was updated through the package's official Hermes config helper.
- Post-repair `hermes mcp test automem` connected in 4.3 seconds and discovered
  six tools; the config keeps five selected tools and excludes deletion.
- A fresh Hermes process/session is required after this configuration change;
  the user restarted Hermes and the current tool registry now exports the
  repaired AutoMem tools.
- `mcp__automem__recall_memory` returned three ranked records, and
  `mcp__automem__check_database_health` returned healthy with FalkorDB/Qdrant
  connected and synchronized counts.

## Hindsight

- Compose source: `D:/hindsight/docker-compose.yml`.
- Container: `hindsight-api`, image `ghcr.io/vectorize-io/hindsight:latest`.
- Compose labels point back to `D:/hindsight`; ports are 8888 (API) and 9999
  (control plane); pg0 is mounted from `D:/hindsight/pg0`.
- Runtime restart policy observed from Docker: `unless-stopped`.
- Before the direct-route switch, a bounded Hindsight `/memories/recall`
  request timed out. Fresh logs showed successful LLM calls taking 17–69
  seconds and consolidation taking 93–109 seconds; the request was logged as
  `RECALL CANCELLED` after the client disconnected.
- Bank stats before the switch reported `failed_operations: 150` and
  `failed_consolidation: 29`, with no pending operations. A bounded failed-
  operation listing returned `Fact extraction failed ... APIConnectionError`.
- The previous proxy path had an intermittent upstream 403 probe, but this was
  not treated as a confirmed static auth failure: aiohttp with the same key
  reached `/v1/models` successfully and the Solar model was present.
- The initial post-cleanup route was direct Nous API:
  `https://inference-api.nousresearch.com/v1`, model `upstage/solar-pro4:free`.
  The Nous key is stored in `D:/hindsight/.env`; its value is not in Git or
  this audit.
- Post-switch bounded recall returned HTTP 200 in 65.23 seconds with four
  results. Health/ready remained healthy and pending operations/consolidation
  remained zero. The remaining issue is latency and historical failures, not
  current direct API reachability.
- A technical manifest was saved at
  `D:/theseus-archive/hindsight/operation-cleanup-20260818.json`, then all 150
  terminal failed operation records were deleted through the official delete
  endpoint. No memories or documents were deleted; document count remained 20.
- After cleanup, the failed-operation endpoint returned zero records. The
  `failed_consolidation: 29` value remains as a historical counter, not a
  pending queue.
- At `2026-08-18T22:10:01Z`, the Hindsight route was changed through the native
  multi-LLM configuration, without a custom proxy:
  `BotHub Nemotron Super → OpenRouter Nemotron Super → Nous Solar Pro4`.
  The production strategy is weighted round-robin with weights `[3, 1, 1]`;
  each member also remains available for automatic fallthrough on transient
  errors. Provider keys remain in `D:/hindsight/.env` and are not recorded here.
- Disposable native-router preflight passed. Five round-robin retains produced
  successful traces on all three configured models. A separate failover test
  with an intentionally unreachable primary produced an error trace for the
  primary and a successful OpenRouter Nemotron trace; the disposable bank and
  pg0 data were deleted afterward.
- Production startup verified all three provider connections. A production
  `dry-run-extract` returned HTTP 200 in 5.72 seconds and stored nothing.
  `health/ready` returned HTTP 200 after restart. The route monitor now records
  recent provider/model counts, status counts, and p50/p95 latency from
  `/v1/default/banks/hermes/llm-requests`; it never prints request bodies or
  credentials.
- The route monitor observed a temporary `pending_consolidation: 24` backlog
  after restart; it drained to zero with `failed_operations: 0`. The historical
  `failed_consolidation: 29` counter remains unchanged.
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

During the original read-only audit, no Docker stack was started, stopped, restarted, or reconfigured. The later native-router migration is documented in the Hindsight section above.
