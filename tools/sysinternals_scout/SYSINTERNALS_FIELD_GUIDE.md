# Sysinternals Field Guide for Theseus

Purpose: keep a compact, official-source map of Microsoft Sysinternals so
Theseus agents can choose the right Windows diagnostic tool without drifting
back into ad hoc shell probing or always-on heavy tracing.

Primary source: Microsoft Learn Sysinternals.

## Operating Principle

Use the lightest layer that can answer the question.

1. Prefer cached observability first: workshop dashboard, Codex system watch,
   Sysinternals scout, Docker/AutoMem/log-lattice status.
2. Prefer read-only and bounded tools for routine checks.
3. Use capture tools only for an explicit incident, with time limit, target
   process, output folder, and privacy note.
4. Avoid destructive or disruptive tools unless the user explicitly asks.

## Official Entry Points

| Entry point | Use | Notes |
|---|---|---|
| Sysinternals home | Official overview, release notes, learning resources | https://learn.microsoft.com/sysinternals/ |
| Utilities index | Tool discovery and current versions | https://learn.microsoft.com/sysinternals/downloads/ |
| Sysinternals Suite | Single archive with the tool set | https://learn.microsoft.com/sysinternals/downloads/sysinternals-suite |
| Microsoft Store Suite | Installation and updates through Store | Listed from the utilities index |
| Sysinternals Live | Run tools without manual download | `\\live.sysinternals.com\tools\<toolname>` |
| Sysinternals blog | Release details and usage notes | Linked from the home page |

Microsoft describes Sysinternals as advanced utilities and technical
information for managing, troubleshooting, and diagnosing Windows and Linux
systems and applications. Sysinternals Live is the official remote share route
for running tools directly from Microsoft-hosted binaries.

## Theseus Diagnostic Layers

| Layer | Default? | Tool class | Examples | Use |
|---|---:|---|---|---|
| L0 builtin scout | yes | Built-in Windows commands | `tasklist`, `netstat`, `wevtutil` | Always-safe baseline and dashboard cache |
| L1 portable read-only | yes, when installed | Sysinternals read-only CLI/GUI | `handle`, `tcpvcon`, `pslist`, `listdlls`, `sigcheck`, `accesschk`, Process Explorer | Focused inspection without persistent capture |
| L2 bounded capture | incident only | Event/dump capture | Process Monitor, ProcDump | Short target-specific evidence capture |
| L3 persistent telemetry | design review first | Resident service/driver | Sysmon | Long-term event stream into Windows Event Log |
| L4 disruptive/admin | explicit user approval | Change/kill/crash/delete tools | PsKill, PsSuspend, PsShutdown, SDelete, NotMyFault | Avoid in agent automation |

## Tool Router

| Question | First route | Sysinternals route | Guardrail |
|---|---|---|---|
| What processes and ports are active? | `tools/sysinternals_scout/sysinternals_scout.mjs` | `tcpvcon -a -c -n`, TCPView for human GUI | Store bounded summaries, not raw endpoint dumps |
| Which process owns a port? | Sysinternals scout cache | TCPView/Tcpvcon | No connection closing from agent route |
| Which process keeps a file, directory, pipe, or DLL open? | Check current process/port map | Process Explorer search, `handle`, `listdlls` | Read-only lookup first |
| Why is disk/registry/process activity noisy? | Existing logs and dashboard alerts | Process Monitor | Bounded capture only; filters before capture |
| Why did a process hang or spike CPU? | Dashboard, event logs, process list | ProcDump mini/triage dump | Dump only with explicit target and privacy note |
| What starts automatically? | Existing service/startup inventory | Autoruns/Autorunsc | Read-only export first; no disabling entries by agent |
| Is a binary signed or suspicious? | Known path inventory | Sigcheck | Avoid VirusTotal upload unless explicitly approved |
| Are ACLs blocking Docker/Codex/WSL? | Existing permission notes, non-secret path checks | AccessChk | Report effective access; do not rewrite ACLs by default |
| Is memory pressure real? | Dashboard/system counters | RAMMap | Human GUI or saved snapshot; avoid automated memory purges |
| Need long-term process/network telemetry? | Existing log lattice | Sysmon | Requires config review and noise budget |

## Key Tools

### Process Explorer

Primary use: human-readable process tree, owners, handles, DLLs, search for
open handles or loaded DLLs. It is installed by simply running `procexp.exe`.
For Theseus automation, Process Explorer is a human GUI aid, not the default
machine-readable route.

### Process Monitor

Primary use: real-time file system, Registry, process/thread, DLL activity,
filters, stack capture, boot logging, and native PML logs. It can generate very
large traces, so Theseus should only use it as an incident tool with filters,
timebox, and output policy.

### ProcDump

Primary use: command-line dumps for CPU spikes, hung windows, unhandled
exceptions, performance counters, or explicit PID/name targets. Dumps can
contain private memory and secrets. Prefer mini or triage dumps first and never
collect dumps continuously.

Useful concepts:

- `-accepteula` for non-interactive EULA acceptance.
- `-h` for hung-window trigger.
- `-e` for exception trigger.
- `-n` and `-s` to bound count and interval.
- `-r` clone mode can reduce outage risk, but still needs caution.

### TCPView and Tcpvcon

Primary use: richer netstat-style TCP/UDP endpoint inventory with owning
process names. TCPView is GUI; `tcpvcon` is the command-line route and supports
CSV output with `-c` and no DNS resolution with `-n`.

For Theseus, `tcpvcon -a -c -n` is a natural future replacement/enrichment for
the current `netstat -ano` fallback.

### Handle and ListDLLs

Primary use: command-line lookup of opened files, objects, and loaded DLLs.
Good for "why can't this directory/file be moved/deleted" and DLL version
questions. Use read-only queries first.

### PsTools

Primary use: command-line administration tools for local and remote systems.
Relevant read-only members include PsList, PsInfo, PsLogList, and PsLoggedOn.
Disruptive members like PsKill, PsSuspend, PsShutdown, PsExec, and PsPasswd
must not become default agent routes.

### AccessChk

Primary use: effective permission checks for files, directories, Registry
keys, services, processes, shares, object-manager objects, and account rights.
Useful for Codex/Docker/WSL ACL diagnosis. Agent default is report-only.

### Sigcheck

Primary use: file version, hashes, timestamps, digital signatures, certificate
chains, and optional VirusTotal lookups. For Theseus, default to local
signature/hash checks. VirusTotal upload or lookup is a separate privacy
decision.

### Autoruns and Autorunsc

Primary use: inventory of automatic startup locations. The command-line
`autorunsc` is useful for machine-readable exports. Agent default is read-only
inventory; disabling/removing startup entries requires explicit user approval.

### Sysmon

Primary use: persistent host telemetry via Windows Event Log. It logs process
creation, network connections, driver/DLL loads, file/registry changes, DNS,
pipe/WMI events, and more depending on configuration. It is powerful but can be
noisy; use only after config review and event budget.

Important source facts:

- Events are written under
  `Applications and Services Logs/Microsoft/Windows/Sysmon/Operational`.
- Network connection logging is optional and linked to processes.
- Some event classes can generate significant logging and need filters.

### RAMMap

Primary use: physical memory usage analysis: use counts, processes, priority
summary, physical pages, file summary/details. Prefer for human-guided memory
pressure analysis; do not automate memory-list clearing as a default action.

## Install and Discovery Strategy

Preferred local layout:

```text
C:\Tools\Sysinternals
```

Then add it to PATH for the normal Windows user and, if needed, expose a
read-only path to Codex/VS Code tasks.

Discovery command:

```text
where procexp procmon procdump handle tcpview tcpvcon sysmon autorunsc sigcheck accesschk pslist
```

Sysinternals Live fallback:

```text
\\live.sysinternals.com\tools\procdump.exe
\\live.sysinternals.com\tools\tcpvcon.exe
```

Use Live for manual or explicit incident checks, not as a hidden dependency in
background monitors.

## Theseus Integration Plan

1. Keep `Sysinternals Scout` as the always-light dashboard sensor.
2. Add optional detection of installed tools to the scout cache.
3. If `tcpvcon` is present, prefer it over `netstat` for endpoint ownership.
4. Add separate incident wrappers for:
   - bounded `handle` lookup;
   - bounded `tcpvcon` export;
   - bounded `autorunsc` export;
   - carefully scoped `sigcheck`;
   - explicit ProcDump mini/triage capture.
5. Treat ProcMon/Sysmon as design-review items, not automatic next steps.

## Source Index

- Sysinternals home: https://learn.microsoft.com/sysinternals/
- Utilities index: https://learn.microsoft.com/sysinternals/downloads/
- Sysinternals Suite: https://learn.microsoft.com/sysinternals/downloads/sysinternals-suite
- Process Explorer: https://learn.microsoft.com/sysinternals/downloads/process-explorer
- Process Monitor: https://learn.microsoft.com/sysinternals/downloads/procmon
- ProcDump: https://learn.microsoft.com/sysinternals/downloads/procdump
- TCPView/Tcpvcon: https://learn.microsoft.com/sysinternals/downloads/tcpview
- Sysmon: https://learn.microsoft.com/sysinternals/downloads/sysmon
- PsTools: https://learn.microsoft.com/sysinternals/downloads/pstools
- AccessChk: https://learn.microsoft.com/sysinternals/downloads/accesschk
- Sigcheck: https://learn.microsoft.com/sysinternals/downloads/sigcheck
- RAMMap: https://learn.microsoft.com/sysinternals/downloads/rammap
