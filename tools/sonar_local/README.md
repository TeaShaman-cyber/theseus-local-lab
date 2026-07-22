# Local Sonar Preflight

Local, read-only adaptation of the Sonar semantic-echolocation protocol.

It does not introduce another memory authority:

- AutoMem remains the durable local semantic graph and vector memory;
- MemPalace remains the episodic/verbatim layer;
- Graphify remains an on-demand corpus lens;
- DuckDB stores a disposable search index, typed authority bridges, and probe
  receipts;
- live Git, Docker, files, tests, and service state remain operational truth.

Basic Memory Cloud is not required by the local runtime. It can supply reviewed
DIFFs or portable federation contracts, but a cloud retrieval miss or outage
must not block local work.

## Bootstrap

```text
node tools/sonar_local/run_wsl.mjs bootstrap
```

## Refresh And Query

```text
node tools/sonar_local/run_wsl.mjs refresh
node tools/sonar_local/run_wsl.mjs preflight --query "why avoid PowerShell for Docker work"
node tools/sonar_local/run_wsl.mjs status
```

## Persistent MCP Route

The Codex integration runs one WSL process for the MCP session instead of
starting WSL for every query. It exposes three read-only tools:

- `sonar_status`: index health, age, and authority boundaries;
- `sonar_refresh`: explicit AutoMem-to-DuckDB refresh;
- `sonar_preflight`: compact evidence, bridge, conflict, drift, and gap packet.

Run the protocol smoke test before registering or after changing the server:

```text
node tools/sonar_local/run_wsl.mjs mcp-smoke --windows-launcher
```

Codex launches the persistent server through
`tools/sonar_local/launch_mcp_wsl.mjs`. After adding or changing its MCP entry,
restart Codex once so the host reloads the server configuration.

```toml
[mcp_servers.theseus_sonar]
command = "node"
args = [
  'C:\Users\s.poklad\Documents\Codex\2026-07-08\life-science-research-plugin-life-science-4\tools\sonar_local\launch_mcp_wsl.mjs',
]
startup_timeout_sec = 30.0
tool_timeout_sec = 90.0
```

Sonar is selective. Invoke it after compact/model switch, for cross-project or
authority ambiguity, before infrastructure mutation, after repeated failures,
or when recalled memories conflict or evolved. Do not invoke it for greetings,
simple facts, formatting, or a task already constrained by one clear memory and
fresh runtime evidence.

The refresh reads AutoMem through its authenticated HTTP graph API and never
opens the FalkorDB volume directly. The DuckDB index lives on WSL ext4 at
`~/.cache/theseus-sonar/sonar.duckdb`; keeping its small writes off `/mnt/c`
avoids the Windows-mount penalty. Generated receipts stay under
`outputs/sonar_local/`. Both are rebuildable.

## Output Contract

Each preflight reports:

- `current_view`: fused results from controlled probe formulations;
- `required_bridges`: authority relations relevant to the detected domains;
- `conflicts`: explicit AutoMem contradiction/invalidation edges;
- `temporal_drift`: evolution and temporal edges in the selected slice;
- `gaps`: missing live verification or evidence limitations;
- `observations`: neutral facts such as no conflict in the selected slice;
- `raw_references`: exact probes and per-probe ranks.

Do not treat recurrence across probes as independent corroboration. A memory
result constrains routing but never overrides fresh operational evidence.
