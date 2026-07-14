# Codex Windows Map

Bounded read-only snapshot for mapping how Codex Desktop / ChatGPT Work is
currently visible from the Windows host.

It is not a live tracer. It does not run ProcMon, Sysmon, packet capture, dumps,
or continuous monitoring. It samples:

- focused Windows processes;
- focused network rows;
- bounded DLL/module samples;
- bounded file-handle samples;
- Codex version and local Windows event cache;
- public `openai/codex` GitHub issue and repo context;
- provider scout cache.

## Tasks

```text
Theseus: Codex Windows map snapshot
Theseus: Codex Windows map compare
```

## Direct Use

```text
node tools/codex_windows_map/codex_windows_map.mjs snapshot --write
node tools/codex_windows_map/codex_windows_map.mjs compare --write
```

Outputs are written under `outputs/codex_windows_map/` and intentionally ignored
by Git.
