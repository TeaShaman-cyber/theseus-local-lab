# Workshop Dashboard

Read-only status panel for the Theseus local lab. It gives a compact view of
the workshop instead of requiring separate manual checks for memory, hooks,
backups, Docker, observability, the observatory, and Git sync.

## Usage

```text
node tools/workshop_dashboard/dashboard.mjs
node tools/workshop_dashboard/dashboard.mjs --json
```

## Web UI

```text
docker compose -f tools/workshop_dashboard/docker-compose.yml up -d --build
```

Open:

```text
http://127.0.0.1:5180
```

The web UI is a local read-only view. It refreshes once per minute and exposes
the same data as:

```text
http://127.0.0.1:5180/api/dashboard
```

## Signals

- AutoMem API health
- AutoMem graph viewer port
- Infisical keychain port
- Docker TCP port
- Log lattice health
- Docker control fallback health
- AutoMem and backup containers from `docker ps`
- latest local backup archive
- latest cloud mirror archive, when the mirror folder is visible
- latest compact state packet
- research queue pending count
- session timeline freshness
- local observatory DB freshness
- Git sync and dirty-file state

The script does not start, stop, rebuild, or mutate services. It also does not
read `.env`, backup contents, raw memory dumps, or private transcripts.

When running inside Docker, the container reaches host services through
`host.docker.internal`. The compose file mounts the repository read-only and
optionally mounts the cloud-backup mirror read-only.
