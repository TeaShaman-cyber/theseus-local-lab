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
