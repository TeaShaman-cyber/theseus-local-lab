# Codex System Watch

Read-only local sensor for Codex runtime state on this Windows host.

It collects:

- `codex --version`;
- `where.exe codex`, including WindowsApps desktop package version when visible;
- recent warning/error events from the Windows `Application` log through
  `wevtutil`.

## Usage

```text
node tools/codex_system_watch/codex_system_watch.mjs
node tools/codex_system_watch/codex_system_watch.mjs --write
node tools/codex_system_watch/codex_system_watch.mjs --json --write
```

`--write` stores:

```text
outputs/codex_system_watch/codex-system.json
outputs/codex_system_watch/codex-system.md
```

The collector does not clear logs, export raw event archives, read the Security
log, or start a background service.

## Collector Strategy

Current path: small Node wrapper around Microsoft `wevtutil`.

Future service candidates:

- Fluent Bit `winevtlog` / `winlog` input for continuous Windows Event Log
  collection;
- Vector `windows_event_log` source for a more Unix-like observability pipeline.

Keep this wrapper even if a service is added later: it provides a simple smoke
check and a stable dashboard cache shape.

## References

- Microsoft `wevtutil`: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/wevtutil
- Fluent Bit Windows Event Log input: https://docs.fluentbit.io/manual/data-pipeline/inputs/windows-event-log
- Vector sources reference: https://vector.dev/docs/reference/configuration/sources/
