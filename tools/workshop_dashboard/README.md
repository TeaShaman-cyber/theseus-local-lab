# Workshop Dashboard

Read-only status panel for the Theseus local lab. It gives a compact view of
the workshop instead of requiring separate manual checks for memory, hooks,
backups, Docker, observability, the observatory, and Git sync.

## Usage

```text
node tools/workshop_dashboard/dashboard.mjs
node tools/workshop_dashboard/dashboard.mjs --json
node tools/workshop_dashboard/dashboard.mjs --rows model-runtime,usage-scout,lens-usage-trial,git-sync
```

Use `--rows` for agent-facing checks inside Codex. It keeps the human web
dashboard complete while avoiding large repeated table dumps in the model
context.

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

The `VS Code Tasks` tab maps `.vscode/tasks.json` into groups and task cards:

```text
http://127.0.0.1:5180/#tasks
http://127.0.0.1:5180/api/tasks
```

This task view is intentionally read-only. It helps choose the right VS Code
button without exposing a browser endpoint that can launch arbitrary local
commands.

The `Task Graph` tab exposes the same tasks as a weighted graph of groups,
capabilities, and tasks:

```text
http://127.0.0.1:5180/#graph
http://127.0.0.1:5180/api/task-graph?goal=backup
http://127.0.0.1:5180/api/task-route?goal=memory
http://127.0.0.1:5180/api/task-bundles
```

This is the local mathematical substrate for routing. It uses simple weighted
graph scoring now, and can later hand the same graph JSON to Wolfram, NetworkX,
or another math advisor.

The graph view also exposes preflight bundles for high-centrality subsystems:
Docker, memory, secrets, backup, VM/SSH, and Git. Bundles are read-only route
recommendations, not browser-executed commands.

The `Codex Issues` tab reads the cached OpenAI Codex GitHub issue field report:

```text
node tools/github_issue_watch/github_issue_watch.mjs --write
http://127.0.0.1:5180/#codex-issues
http://127.0.0.1:5180/api/codex-issues
```

The dashboard never polls GitHub directly on every refresh. It only displays
the latest local cache so the panel remains fast and rate-limit friendly.

The `Limits` tab reads the rollout-backed Codex usage cache:

```text
node tools/usage_scout/usage_scout.mjs
http://127.0.0.1:5180/#limits
http://127.0.0.1:5180/api/usage-scout
```

The main status view warns at 90 percent usage and fails at 100 percent. Token
activity remains separate from quota consumption and is not treated as a
billing formula.

The `Context pressure` row reads the local compaction guard:

```text
node tools/context_pressure_watch/context_pressure_watch.mjs
node tools/context_pressure_watch/context_pressure_watch.mjs --checkpoint
```

It never invokes Codex compaction. It only recommends a compact checkpoint, and
with `--checkpoint` it writes one through the memory hook when pressure is high
and the previous state packet is stale.

After rebuilding the web container, verify the live user-visible surface with:

```text
node tools/workshop_dashboard/smoke.mjs
```

The `Codex System` tab reads a cached local system report:

```text
node tools/codex_system_watch/codex_system_watch.mjs --write
http://127.0.0.1:5180/#codex-system
http://127.0.0.1:5180/api/codex-system
```

This report uses `codex --version`, `where.exe codex`, and read-only
`wevtutil` queries against the Windows Application log. It stores a compact
summary only, not raw Windows log archives.

The `System Scout` tab reads a cached lightweight process/network report:

```text
node tools/sysinternals_scout/sysinternals_scout.mjs --write
http://127.0.0.1:5180/#sysinternals-scout
http://127.0.0.1:5180/api/sysinternals-scout
```

This scout detects optional Sysinternals CLI tools, then falls back to
`tasklist` and `netstat` for a bounded machine-readable snapshot. It does not
launch Process Explorer, Process Monitor, dumps, or trace capture.

## Signals

- AutoMem API health
- AutoMem graph viewer port
- Infisical keychain port
- Docker TCP port
- Log lattice health
- Docker control fallback health
- Blameless route incidents from `outputs/tool_policy/*.jsonl`
- AutoMem and backup containers from `docker ps`
- latest local backup archive
- latest cloud mirror archive, when the mirror folder is visible
- latest compact state packet
- research queue pending count
- session timeline freshness
- local observatory DB freshness
- cached OpenAI Codex GitHub issue summary
- cached Codex local system/version/event summary
- cached lightweight process/network scout
- Git sync and dirty-file state

The script does not start, stop, rebuild, or mutate services. It also does not
read `.env`, backup contents, raw memory dumps, or private transcripts.

`Blameless route incidents` is a process alert, not a service outage. It turns
yellow when tool-policy records a blocked or warned route in the last 24 hours,
so repeated anti-patterns can be reviewed without blaming the agent or hiding
the signal in raw logs.

When running inside Docker, the container reaches host services through
`host.docker.internal`. The compose file mounts the repository read-only and
optionally mounts the cloud-backup mirror read-only.
