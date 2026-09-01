# Hindsight deployment source

This directory is the **canonical Git source** for the local Hindsight Compose
stack used by Theseus. The runtime remains local and private, but its desired
configuration is versioned with the main `theseus-local-lab` repository.

Tracked here:

- `docker-compose.yml` — Hindsight API plus the Docker-owned Hermes Subscription
  Proxy;
- `.env.example` — non-secret path variables only;
- this ownership and recovery contract.

## Runtime boundary

The following stay outside Git:

| Runtime artifact | Canonical location/owner | Why |
|---|---|---|
| Provider keys | `D:/hindsight/.env` | secret material |
| Hindsight embedded pg0 | `D:/hindsight/pg0` | mutable memory/database state |
| Hermes OAuth state | Docker volume `theseus-hermes-proxy-data` | refresh credentials |
| Logs, generated OpenAPI, probes, backups | local runtime/archive paths | generated or historical state |

Do not copy `auth.json`, `.env`, `env_file`, pg0 files, or Docker volumes into
this directory.

## Commands on the current Windows host

Run from the repository root. The explicit env-file argument supplies provider
keys to Compose without putting them in Git:

```bash
docker compose --project-name hindsight-cloud \
  --env-file D:/hindsight/.env \
  -f deploy/hindsight/docker-compose.yml config --quiet

docker compose --project-name hindsight-cloud \
  --env-file D:/hindsight/.env \
  -f deploy/hindsight/docker-compose.yml up -d

docker compose --project-name hindsight-cloud \
  --env-file D:/hindsight/.env \
  -f deploy/hindsight/docker-compose.yml ps
```

The Compose project name is retained as `hindsight-cloud` so the Git-owned
source manages the existing runtime project instead of creating a parallel
network. Hindsight reaches Solar through the internal service name
`hermes-proxy:8645`; the proxy has no host-published port and is independent of
Hermes Desktop.

## Verification contract

After a source or image change, verify all of these separately:

1. `docker compose ... config --quiet` succeeds;
2. both services are `running`, and `hermes-proxy` is `healthy`;
3. `/v1/models` and a bounded Solar completion succeed from `hindsight-api`;
4. Hindsight API read and `llm-requests` trace read back successfully;
5. no memory/document/operation records were deleted unexpectedly;
6. the registry and the relevant research issue record the actual result.

A Docker health result alone is not evidence that the Hindsight data plane or
Solar route works. See issue #3 for the source-consolidation research contract
and issue #2 for proxy lifecycle evidence.

## Migration rule

`D:/hindsight` is now a runtime/data root, not the canonical Compose source.
After the Git-owned Compose file has been read back against the live project,
the old `D:/hindsight/docker-compose.yml` must be removed or explicitly
archived so two competing source files do not survive.
