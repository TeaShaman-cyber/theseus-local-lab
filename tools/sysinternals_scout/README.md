# Sysinternals Scout

Lightweight read-only Windows process and network scout for the Theseus
observatory.

This tool does not launch Process Explorer, Process Monitor, ProcDump, or any
GUI utility. It also does not create dumps, traces, or packet captures.

The current layer uses built-in Windows commands:

- `tasklist /v /fo csv /nh` for process inventory.
- `netstat -ano` for listener and connection inventory.
- `where.exe` to detect optional Sysinternals CLI tools.

Optional future deeper layers can use Sysinternals CLI tools such as `handle`,
`tcpvcon`, or `procdump`, but only as event-triggered diagnostics with explicit
scope. Continuous deep tracing would be too noisy and too expensive for the
local laptop.

## Usage

```text
node tools/sysinternals_scout/install_sysinternals.mjs
node tools/sysinternals_scout/sysinternals_scout.mjs --write
node tools/sysinternals_scout/sysinternals_scout.mjs --json
```

The installer downloads the official Microsoft Sysinternals Suite archive and
extracts it to:

```text
C:\Users\s.poklad\Tools\Sysinternals
```

It also writes:

```text
outputs/sysinternals_scout/install-manifest.json
outputs/sysinternals_scout/install-manifest.md
```

The writer creates:

```text
outputs/sysinternals_scout/sysinternals-scout.json
outputs/sysinternals_scout/sysinternals-scout.md
```

The local field guide and machine-readable source map are:

```text
tools/sysinternals_scout/SYSINTERNALS_FIELD_GUIDE.md
tools/sysinternals_scout/sysinternals_reference.json
```

The workshop dashboard reads the cached JSON:

```text
http://127.0.0.1:5180/#sysinternals-scout
http://127.0.0.1:5180/api/sysinternals-scout
```
