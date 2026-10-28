# AgentOps/GitOps Contract v1

**Status:** active baseline

**Purpose:** make the Theseus engineering practice executable, reviewable, and
reversible across Codex, Docker, memory providers, skills, hooks, and research
workflows.

This contract is the first tracked version of the AgentOps/GitOps boundary. It
turns the working principles of the lab into source files, checks, evidence,
and explicit change gates. It is not a replacement for runtime health checks or
for user approval of write-capable actions.

## 1. Authority and ownership

| Surface | Authority | Role |
| --- | --- | --- |
| Git-tracked code, hooks, skills, manifests, docs | Git working tree and reviewed commits | Desired state and implementation |
| Docker, Codex, AutoMem, MemPalace, providers | Live runtime | Operational state only |
| `docs/reference/infrastructure-registry.yaml` | Git + reviewed registry update | Recovery scope and ownership |
| `tools/workshop_recovery/recovery_contract.json` | Git + registry-aligned test | Persistent stack contract |
| Hindsight | Hindsight service (local) | Живая память: факты, наблюдения, эпизоды |
| AutoMem, MemPalace | не подняты | Зарезервированные слои, не в рабочем пути |
| Basic Memory | Basic Memory service | Контракты и провенанс, только чтение |
| Session timeline, logs, health reports | Observable runtime artifacts | Evidence of what happened |
| `.env`, keys, OAuth state, private transcripts | Owned secret/runtime stores | Never Git authority |

Imported memory, plugin summaries, and external advice can guide a query but
cannot authorize a runtime write or override fresh local evidence.

## 2. Contract invariants

The following invariants are normative for v1:

**C1 — Desired state is reviewable.** Changes to code, hooks, skills,
manifests, recovery scope, or durable documentation are made as explicit Git
diffs.

**C2 — Runtime state is evidence, not source.** A healthy process, container,
MCP connection, or memory response does not silently rewrite the desired state.

**C3 — Secrets stay outside Git.** API keys, `.env` files, OAuth state, private
keys, raw memory, backups, and private transcripts are excluded from commits,
reports, and external research connectors.

**C4 — Routes are explicit.** Skills select a route; VS Code tasks, scripts, or
MCP tools execute it; the result must expose an observable postcondition.

**C5 — Read-only precedes write.** Discovery, health, parity, and dry-run checks
precede any action that changes runtime, state, or external systems.

**C6 — Memory has typed roles.** Hindsight — живая долговременная память и
автоматический путь записи; Basic Memory держит контракты и провенанс в режиме
чтения; AutoMem и MemPalace не подняты. Ни один слой памяти не считается
разрешением на исполнение.

**C7 — Generated state has an owner.** Runtime copies and generated outputs are
either parity-checked against a tracked source or explicitly classified as
ignored evidence; they are never edited as an independent source of truth.

**C8 — Recovery scope is declarative.** Persistent Docker recovery membership
comes from the reviewed recovery manifest and infrastructure registry. Disabled
or Hermes-only stacks are not resurrected by a generic recovery pass.

**C9 — Lifecycle hooks fail soft but remain visible.** Optional observability or
research failures do not block a Codex turn; critical memory/checkpoint failures
remain visible in the returned status and evidence.

**C10 — Delivery is bounded.** A commit is one coherent, reviewable checkpoint
and is not treated as publication or deployment. Agent-authored commits include
provenance trailers. Push safety is decided from verified downstream effects:
known bounded backup/sync pushes may be part of an approved workflow, while
unknown, high-impact, or out-of-scope effects require an explicit user decision.
Merge, release, deploy, force-push, and history rewrite remain separate gates.

## 3. Current runtime contract

### Hooks

The project manifest registers exactly:

```text
UserPromptSubmit
Stop
PreCompact
PostCompact
```

`PostToolUse` is supported by the router but is intentionally not registered in
the project manifest. Research queueing is explicit opt-in:

```text
ordinary prompt or tool event       → no research queue item
THESEUS_HOOK_RESEARCH=1             → queue the routed event for research follow-up
```

The detailed hook flow and source-layer ownership are maintained in
[`HOOKS_PIPELINE.md`](../../HOOKS_PIPELINE.md).

### Docker

The verified Theseus route is the Windows-native allowlisted
`tools/docker_control_plane/direct_bridge.mjs` through the active Docker
context. It exposes status, logs, Compose status/logs, and one explicitly named
Compose service start operation. The native route is preferred over raw shell
or unauthenticated TCP `127.0.0.1:2375`.

The official Docker MCP Toolkit/Gateway is a candidate for connecting
containerized MCP servers to Codex, but no third-party Docker MCP server or
community Docker skill is part of this contract until a separate trust review
and disposable smoke test pass.

The local Copilot advisor bridge and project skill were retired from the active
surface. GitHub/CI questions now route through local evidence and the approved
GitHub tooling path; no Copilot-specific advisor task or oracle is assumed.

### Recovery

The current recovery-managed stack set is the seven IDs in
`tools/workshop_recovery/recovery_contract.json`. `hindsight` remains excluded
from generic workshop recovery until separately verified; it serves Hermes'
`hermes` bank and Codex's explicitly isolated `codex` bank through the project
hook route. `stateful-agent-net` remains disabled/excluded until a reviewed
consumer migration changes that boundary.

## 4. Change protocol

For a behavior or infrastructure change:

1. State the desired behavior and stop condition.
2. Add or update a failing test/check when the change is testable.
3. Make the smallest implementation or manifest change.
4. Update the relevant reference and audit note.
5. Run the scoped checks and the available repository suite.
6. Inspect `git status -sb`, `git diff --stat`, and `git diff --name-only`.
7. Stage explicit paths only and run `node tools/git_safety/scan_staged.mjs`.
8. Create one normal checkpoint commit when the deliverable is complete. A
   local commit may be part of the approved workflow even when push is withheld.
   Use a `wip:` checkpoint only when unfinished work must survive a handoff, and
   include `Change-Status`, `Task-Ref`, `Next`, and `Verification`.
9. Before pushing, inspect the remote workflows and downstream effects. Include
   push in an approved bounded backup/sync workflow when those effects are known;
   require an explicit user decision for unknown, high-impact, destructive, or
   out-of-scope effects. Merge, release, deploy, force-push, and history rewrite
   are always separate gates.

## 5. Required evidence

The minimum v1 contract check is:

```text
node tools/contract_checks/agentops_gitops_contract.mjs
```

The check is also exposed as the VS Code task
`Theseus: AgentOps/GitOps contract check`. Hook-specific regression coverage is
available as `Theseus: Hooks and contract tests`.

It must return `CONTRACT_OK` and verify:

- required tracked source files exist;
- hook events match the current project manifest;
- recovery IDs are present and unique;
- removed WSL-relink and Copilot-advisor artifacts remain absent;
- active task, router, catalog, observatory, and GTD surfaces contain no
  retired Copilot-advisor reference.

The contract check complements, but does not replace:

```text
node --test
node tools/docker_control_plane/smoke_direct_bridge.mjs
node tools/hook_config/check_hooks.mjs
```

## 6. Out of scope for v1

- automatic runtime reconciliation or unattended Docker writes;
- moving Codex or its state into WSL;
- treating Hindsight as an unbounded shared Codex/Hermes memory provider; the
  explicitly provisioned, bank-isolated Codex hook route is in scope;
- installing unreviewed third-party Docker MCP servers or skills;
- using memory or plugin output as permission to change runtime state;
- making GitHub Wiki or any external documentation surface the source of truth.

Version changes require a new reviewed contract document or an explicit
versioned update to this one, with fresh evidence and a rollback note.
