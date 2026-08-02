# codex-do Read-Only Runtime Probe

## Goal

Add a distinct VS Code/Node route for the new Family Research remote runtime
`codex-do`, reusing the existing Unix Runtime probe pattern without changing
the meaning or target of the existing `ubuntu-vm` backend.

## Scope

The first phase is read-only and limited to runtime identity and workspace
binding. It must report:

- selected backend: `codex-do`;
- remote host and user;
- physical/runtime scope: `remote-do` / `codex-do`;
- expected project scope: `family-research`;
- expected workspace: `/root/workspaces/family-research-lab`;
- Git root, HEAD, and bounded dirty/untracked status;
- whether the expected workspace exists;
- `fallback_used: false`.

The first phase must not inspect or mutate Docker, Infisical, Gramps
credentials, Gramps UI state, service configuration, or family data.

## Route

```text
VS Code task
  -> Node process invocation (shell: false)
  -> direct SSH process
  -> fixed read-only shell probe on codex-do
```

The task must not route through a PowerShell one-liner. SSH host/user inputs
are explicit and bounded; key material and secret values remain in the existing
Windows SSH/profile boundary and never enter task JSON, logs, or memory.

## Isolation invariants

1. `codex-do` is a separate backend identifier from `ubuntu-vm`.
2. Selecting or failing `codex-do` never silently invokes WSL, Docker, or
   `ubuntu-vm`.
3. The task emits a bounded receipt and performs no writes on the remote host.
4. The task does not claim that the remote runtime shares local AutoMem,
   MemPalace, Git, UI, or secret state.
5. The task's project/workspace labels cannot be confused with the local
   Theseus workspace or the Ubuntu VM route.
6. A successful transport probe is not evidence that Gramps Web, MCP, or
   Infisical is configured; those are later, separately gated probes.

## Verification

Add focused tests for:

- backend registration and distinct description;
- safe host/user/workspace validation;
- `shell: false` direct process construction;
- fixed read-only probe contents;
- no fallback from `codex-do` to another backend;
- VS Code task JSON registration and explicit `codex-do` selection;
- bounded receipt fields and absence of secret values.

## Success criterion

Running the dedicated VS Code task against the configured test host produces a
read-only receipt that identifies `codex-workspace` as the remote host, root as
the remote user, `/root/workspaces/family-research-lab` as the workspace, and
the actual current Git state, while preserving the existing `ubuntu-vm` and
WSL routes unchanged.

## Deliberate non-goals

- no automatic AutoMem or Basic Memory write;
- no Gramps login or API/MCP authentication;
- no Docker or Infisical operation;
- no service start/stop/restart;
- no remote file edit, commit, or deployment mutation;
- no synchronization between local and remote memory or UI.
