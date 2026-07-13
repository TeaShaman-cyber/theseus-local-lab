# Log Lattice

Small Docker-backed structured log store for Theseus local lab.

It is intentionally smaller than ELK/Loki:

- Python stdlib HTTP API.
- SQLite database inside a Docker named volume.
- JSON events in, filtered JSON events out.
- Local JSONL files remain only as edge-buffer/fallback.

## Start

```text
docker compose -f log-lattice/docker-compose.yml up -d
```

In the Codex sandbox, use the project-local Docker CLI config to avoid the
Windows Docker credential helper boundary:

```text
DOCKER_HOST=tcp://127.0.0.1:2375
DOCKER_CONFIG=tools/docker_control_plane/docker-cli-config
```

Service URL:

```text
http://127.0.0.1:8768
```

## Smoke

```text
node tools/session_timeline/timeline.mjs add --source codex --event smoke --note "log lattice smoke" --tag smoke
```

Set this env var to mirror timeline events into the Docker log store:

```text
THESEUS_TIMELINE_URL=http://127.0.0.1:8768/events
```

Query recent events:

```text
curl "http://127.0.0.1:8768/events?limit=20"
```

## Data

SQLite lives in the Docker volume:

```text
theseus-log-lattice-data
```

The API never stores secrets intentionally. Events should stay short and
observable: timestamps, source, event name, metrics, artifact ids, and notes.
