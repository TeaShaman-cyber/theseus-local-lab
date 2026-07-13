# OpenAI Agents SDK Adapter Plan

Date: 2026-07-13

## Intent

Build an optional OpenAI Agents SDK adapter over the existing Theseus local lab
infrastructure. This is a serious follow-up track, not a quick migration.

The adapter should not replace the current local stack. It should expose a
small, testable agent layer over the pieces that already work:

- AutoMem and MemPalace for memory.
- Log Lattice for structured timeline/events.
- Docker MCP/TCP for container status and controlled operations.
- VS Code tasks and AHP for IDE/workbench integration.
- Git safety wrappers for checkpointing.

## Guiding Principle

Do not move complexity into the model prompt. Move repeatable behavior into
tools, logs, evals, and explicit approval gates.

## Phase 0 - Contract Before SDK

Define the agent contract before writing an Agents SDK app:

- Agent name and purpose: likely `Theseus Operator`.
- Input shape: user request, optional project state packet, optional event refs.
- Output shape: short answer, proposed actions, executed actions, stored events.
- Tool list: exact local tools and what each is allowed to do.
- State model: what lives in AutoMem, MemPalace, Log Lattice, git, and local files.
- Approval gates: Docker changes, git commits/pushes, secret-sensitive paths,
  destructive actions, network-heavy work.
- Smoke proof: one local command that proves the full path works.

## Phase 1 - Tool Boundary

Create deterministic wrappers before giving them to an SDK agent:

- `query_log_lattice`: read recent timeline events from Docker SQLite API.
- `write_timeline_event`: append local fallback and mirror to Log Lattice.
- `check_memory_health`: AutoMem/MemPalace health and recall check.
- `docker_status`: Docker MCP/TCP status only.
- `git_checkpoint_status`: read-only git status and last commit.
- Later: `request_checkpoint_commit` through existing VS Code/git safety path.

Tools must be boring, narrow, and observable.

## Phase 2 - Minimal Agents SDK Prototype

Build the smallest local prototype:

- One agent.
- No handoffs at first.
- No broad filesystem sandbox until needed.
- No direct secret handling.
- Local CLI smoke command first.
- Optional HTTP `/health` only after CLI behavior is stable.

The agent should answer operational questions such as:

- What changed since the last checkpoint?
- Are memory, Docker, and Log Lattice healthy?
- What should be checkpointed next?
- What evidence supports a claimed improvement?

## Phase 3 - Evals

Add a focused eval harness before expanding capability:

- Happy path: reads timeline, reports current state, writes a new event.
- Missing service: Log Lattice down, falls back cleanly to local JSONL.
- Safety: refuses to print secrets or read `.env.local`.
- Hygiene: prefers Docker MCP/TCP and VS Code tasks over raw PowerShell.
- Git: does not push unless explicitly asked.
- Memory: stores durable decisions only, not raw transcripts.

The eval should check behavior, tool choices, and event logs, not exact prose.

## Phase 4 - Optional Deployment

Only after the prototype and evals are stable:

- Add `pyproject.toml` with `openai-agents`.
- Add app entrypoint if needed.
- Add `/health` if running as a local service.
- Consider the OpenAI Agents SDK Deployment Manager for local Docker/process
  deployment.

## Credential Gate

If the adapter calls the OpenAI API, use the OpenAI Developers
`openai-platform-api-key` credential flow first.

Do not silently reuse or print keys. Do not put secrets in repo files. Continue
using Infisical/keychain as the local source of truth for non-OpenAI provider
secrets.

## Non-Goals

- Do not rewrite the current Theseus stack.
- Do not replace AutoMem or MemPalace.
- Do not make a large multi-agent system first.
- Do not depend on GitHub plugin workflows for normal local git.
- Do not add heavy observability stacks before SQLite/JSONL proves insufficient.

## First Next Step

Write `docs/theseus_operator_contract.md` or similar with the concrete contract:
tools, state, approvals, smoke command, and eval cases. Do not implement SDK code
until that contract is reviewed.

