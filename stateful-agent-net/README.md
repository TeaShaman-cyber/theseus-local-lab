# Stateful Agent Net MVP

Purpose: a tiny local-first prototype for stateful agent support.

The first version collects lightweight signals into SQLite and emits a compact
state packet that Codex can read before heavier reasoning work.

## Signals

- NOAA/SWPC space-weather scales and alerts.
- OpenAI public status summary.
- Local AutoMem health through `host.docker.internal:8001`.

Raw time series stay in SQLite. AutoMem should store only decisions, DIFFs,
method notes, and compact conclusions.

## Run Once

From this folder:

```powershell
docker compose run --rm collector once
```

Outputs:

- `data/state.db`
- `../outputs/state_packets/*.md`

## Run In Background

The collector can run as a small Docker Desktop service. Default interval:
15 minutes.

```powershell
docker compose up -d collector
docker compose ps
docker compose logs --tail=80 collector
docker compose down
```

Override the interval:

```powershell
$env:OBSERVATORY_INTERVAL_SECONDS = "300"
docker compose up -d collector
```

## Next Steps

- Add more vendor status endpoints through config, not code changes.
- Add SIF ingestion only after choosing a public dataset and normalization
  strategy, because SIF data is large and seasonal.
