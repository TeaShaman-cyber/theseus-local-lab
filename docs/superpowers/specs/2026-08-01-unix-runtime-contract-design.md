# Unix Runtime Plane Contract Design

**Date:** 2026-08-01
**Status:** Approved in conversation for the Variant B direction; first implementation slice pending review
**Owner:** Lad — Windows-native Codex agent

## Goal

Give the Windows-native Codex agent one stable Unix execution contract with
interchangeable WSL, Docker, and Ubuntu VM backends, without making any one
backend part of Codex startup, memory authority, or global `config.toml`.

## Problem

Theseus needs a Unix work surface for bash, Node, Python, Graphify, Sonar, and
other Linux-oriented tools. The Windows Codex agent must remain the control
plane, because its Desktop task, identity, MCP registration, memory access, and
external apps already live there. A direct WSL migration would couple unrelated
failure domains: Codex startup, `CODEX_HOME`, MCP transport, hooks, Docker, and
project paths.

Variant B separates those concerns:

```text
Windows-native Codex
    -> one explicit Unix route
        -> WSL, Docker, or Ubuntu VM backend
            -> bounded task
                -> structured receipt and postcondition
```

## Architecture

The first implementation slice introduces a small contract and read-only
backend probes. It does not yet execute arbitrary Unix commands, modify Codex
configuration, start services from hooks, or silently fail over between
backends.

The stable interface is a normalized request/result envelope. The backend is a
data value, not a hidden shell branch:

```text
request:
  backend: wsl | docker | ubuntu-vm
  task: probe
  workspace: explicit path or omitted for host probes
  mode: read-only | scoped-write
  timeout_ms: bounded positive integer
  allow_fallback: false by default

result:
  status: OK | UNAVAILABLE | TIMEOUT | PERMISSION_DENIED | INVALID_REQUEST | UNKNOWN
  backend: selected backend
  fallback_used: false in phase one
  exit_code / signal / elapsed_ms
  stdout / stderr: bounded diagnostic text
  postcondition: explicit pass/fail checks
```

The first phase supports only `read-only` probes. `scoped-write` is represented
in the contract but rejected until a later task catalogue provides explicit
task allowlists, artifact boundaries, and independent postconditions.

## Backend boundaries

### WSL

WSL is the primary Unix route. The probe uses an explicit distribution and
working directory and invokes `wsl.exe` with `shell: false`. It does not use the
Windows Codex `CODEX_HOME`, alter the Desktop configuration, or launch a second
Codex agent.

### Docker

Docker is a separate read-only capability probe in phase one. It reports the
active Docker engine through the existing Theseus control-plane boundary. It
does not expose arbitrary Docker API calls, mounts the project, or perform
container writes.

### Ubuntu VM

The VM is represented as an explicit SSH backend. Its first probe uses the
existing SSH alias and batch mode, with a bounded connection timeout. A powered
off or unreachable VM returns `UNAVAILABLE`; it is not silently substituted for
WSL.

## Fallback policy

Fallback is a route decision, not an exception handler:

- phase-one probes never fallback implicitly;
- read-only fallback may be introduced later only when the caller explicitly
  allows it and the receipt records both the requested and selected backends;
- scoped-write fallback is forbidden unless the task contract explicitly
  declares the alternative backend safe and the user-approved route changes;
- an unavailable backend is not evidence that the task itself is absent;
- a failed probe returns a visible status and bounded evidence.

## Memory and hook boundary

AutoMem and MemPalace remain memory services of the Windows-native agent. A Unix
backend may host supporting processes, but the backend selector is not placed
in the memory hot path.

Hooks remain lightweight lifecycle observers. They do not start WSL, Docker, or
the VM at `UserPromptSubmit`, `Stop`, `PreCompact`, or `PostCompact` merely to
make the Unix route available.

Graphify and Sonar use the Unix contract only through explicit tasks or
selective preflight routes. They are not startup services and are not invoked
after every agent response.

## Phase-one acceptance criteria

The first slice is accepted only when:

1. unknown backends and malformed requests fail closed;
2. `read-only` and `scoped-write` cannot be confused;
3. every probe has a finite timeout;
4. every result identifies the selected backend and exit outcome;
5. every successful probe includes a checked postcondition;
6. WSL, Docker, and VM builders do not use shell interpolation for caller data;
7. no probe changes `config.toml`, hooks, memory, Docker volumes, or VM state;
8. the project test suite covers success, timeout, unavailable, and invalid
   request cases;
9. an IDE task can invoke a single backend probe without adding a global MCP;
10. the phase can be removed without changing the Windows-native Codex path.

## Non-goals for this slice

- moving Codex Desktop or the primary agent into WSL;
- creating a second Codex `CODEX_HOME` as part of the Windows runtime;
- arbitrary shell execution through a new MCP;
- silent WSL -> Docker -> VM failover;
- changing the global Codex `config.toml`;
- changing AutoMem, MemPalace, hooks, identity anchors, or external memory;
- starting the currently disabled Ubuntu VM;
- installing or updating Graphify, Sonar, Docker, or WSL packages.

## Verification note

The requested Wolfram formal-evaluator call was attempted for the invariant
projection but failed at connector transport. Local contract tests are the
mandatory verifier for this slice; a later Wolfram read-only projection may
corroborate the same predicates when the connector is available. Wolfram output
does not replace runtime smoke tests.
