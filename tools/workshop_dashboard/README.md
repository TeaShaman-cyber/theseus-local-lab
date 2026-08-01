# Workshop Dashboard

Read-only status panel for the Theseus local lab. It gives a compact view of
the workshop instead of requiring separate manual checks for memory, hooks,
backups, Docker, observability, the observatory, and Git sync.

## Usage

```text
node tools/workshop_dashboard/dashboard.mjs
node tools/workshop_dashboard/dashboard.mjs --json
node tools/workshop_dashboard/dashboard.mjs --rows model-runtime,usage-scout,lens-usage-trial,git-sync
node tools/workshop_dashboard/dashboard.mjs --rows codex-hooks,context-pressure,usage-scout
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

The graph is meant to be automatic. The VS Code task
`Theseus: refresh task graph cache` runs on folder open and writes:

```text
outputs/task_graph/latest.json
```

Manual graph generation is only a diagnostic fallback:

```text
node tools/workshop_dashboard/tasks.mjs graph --write "current Theseus workshop route audit"
```

The graph includes WSL/portability markers such as raw Docker `2375`, hardcoded
Windows paths, legacy monolith paths, WSL bridges, PowerShell routes, and inline
shell strings. The main dashboard row `VS Code task graph` warns when the cache
is stale or when any task still carries portability markers.

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

The `Codex hooks config` row checks the local project hook layer:

```text
node tools/workshop_dashboard/dashboard.mjs --rows codex-hooks
```

It warns when hooks are defined in both `.codex/hooks.json` and
`.codex/config.toml`, when required lifecycle events are missing, or when the
project hook JSON cannot be parsed. It also detects a parent `.codex/hooks.json`
layer. The built-in Windows `codex-computer-use.exe` notify route may be
recreated by Codex after restart; its presence is informational, while actual
failures are reported by the runtime audit. Keep the project `.codex/hooks.json`
as the canonical hook layer and reserve `.codex/config.toml` for non-hook
project settings.

The `Codex runtime attachment` row reads the current Codex process events from
`$CODEX_HOME/logs_2.sqlite`. It reports MCP servers whose startup completed but
whose tools were not attached, hook runtime errors, and malformed joins between
the app resources directory and a Windows workspace path. Run the underlying
audit directly with:

```bash
node tools/codex_runtime_audit/codex_runtime_audit.mjs --write
```

Configuration health and runtime health are intentionally separate. After a
broken hook is removed from configuration, its warning remains attached to the
current Codex process until the app restarts; the dashboard should stay red in
that interval instead of hiding the incident.

The dashboard uses the fast mode. Add `--deep` for a manual inspection of the
latest rollout `turn_context`; that check reads the tail of a potentially large
session file and is intentionally excluded from routine dashboard refreshes.

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

The `Memory recall reflex` row reads the local memory reflex marker:

```text
node tools/memory_reflex/memory_reflex.mjs status
node tools/memory_reflex/memory_reflex.mjs mark --query "current task"
```

`UserPromptSubmit` writes a preflight expectation. Agents should mark the row
after they actually call MCP AutoMem recall outside the local preflight. The
preflight itself also attempts a small read-only AutoMem `/recall` by HTTP and
stores the short result locally. This does not replace AutoMem; it makes
forgetting or failing to use AutoMem visible.

After rebuilding the web container, verify the live user-visible surface with:

```text
node tools/workshop_dashboard/smoke.mjs
```

The `Skill/tool observatory` row is event-driven. `UserPromptSubmit` stores only
the expected skill identifiers for non-trivial work; route packets provide the
selected skill/tool/policy evidence; `Stop` aggregates both into a local cache.
It never stores prompt text or hidden reasoning. A review warning means either
a skill was expected at least three times without a route packet, or the same
tool-policy incident repeated at least three times.

Reviews use a small Pareto queue: at most three high-impact recurring causes
per cycle. This is a prioritization heuristic, not causal proof. Its `0.80`
threshold is a tunable baseline for comparing the changing incident
distribution, not a system constant. The report also computes a separate
`1/phi` concentration diagnostic. It is a mathematical comparison point,
never a causal or automatic decision rule. The queue defers lower-impact items
until the current focus has a causal hypothesis, a small reversible change, and
a verification result; that is the stop condition for avoiding
diminishing-return complexity.

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
- Docker route and optional legacy TCP bridge
- Log lattice health
- Docker control fallback health
- Blameless route incidents from `outputs/tool_policy/*.jsonl`
- AutoMem and backup containers from `docker ps`
- latest local backup archive
- latest cloud mirror archive, when the mirror folder is visible
- latest compact state packet
- research queue pending count
- session timeline freshness
- memory recall reflex freshness
- local observatory DB freshness
- cached OpenAI Codex GitHub issue summary
- cached Codex local system/version/event summary
- cached lightweight process/network scout
- cached VS Code task graph and WSL/portability markers
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
