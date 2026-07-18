# Memory Palace Junior Guide

MemPalace is a pilot memory palace. It is here to help junior agents retrieve
context without forcing the main Codex thread to reload long histories.

## Boundaries

- Primary memory: AutoMem.
- Pilot memory: MemPalace Docker volume `theseus-mempalace-data`.
- Safe seed corpus: `work/mempalace-pilot/corpus` and project `outputs`.
- Do not mine secrets, `.env`, private keys, backup archives, raw memory dumps,
  or full private chat exports.

## Persistent Service

The palace runs as the persistent `theseus-mempalace` container. Its remote MCP
endpoint is available only on this computer at `http://127.0.0.1:18765/mcp`.
The `/healthz` liveness endpoint is collected by the workshop dashboard and
recovery contract.

```powershell
docker compose -f work\mempalace-pilot\docker-compose.yml build
docker compose -f work\mempalace-pilot\docker-compose.yml up -d
```

The permanent service uses the clean `theseus-mempalace-clean` volume. The old
pilot corpus mounts are intentionally not attached to the long-lived server.

## First Ingest

```text
Use an explicit one-off maintenance command or VS Code task to mine a curated
source. Do not attach arbitrary corpora to the persistent service.
```

## Check Status

```text
GET http://127.0.0.1:18765/healthz
```

For detailed maintenance status:

```powershell
docker compose -f work\mempalace-pilot\docker-compose.yml run --rm --no-deps mempalace status
```

## Search

```powershell
docker compose -f work\mempalace-pilot\docker-compose.yml run --rm --no-deps mempalace search "DeepSeek KV cache MLA"
docker compose -f work\mempalace-pilot\docker-compose.yml run --rm --no-deps mempalace search "symbols loci token prefix"
```

## Wake-Up Context

```powershell
docker compose -f work\mempalace-pilot\docker-compose.yml run --rm mempalace wake-up
docker compose -f work\mempalace-pilot\docker-compose.yml run --rm mempalace wake-up --wing strazh-index
```

## Teaching Pattern

When a junior agent starts:

1. Run `status`.
2. Run one search for the current task.
3. Use `wake-up` only if the task needs broad project context.
4. Report which memory snippets were used.
5. Ask before mining new directories.
