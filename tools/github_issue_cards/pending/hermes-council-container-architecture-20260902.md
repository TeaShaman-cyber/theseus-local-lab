---
card_id: ISSUE-20260902-HERMES-COUNCIL-CONTAINER-ARCHITECTURE
status: READ_BACK_VERIFIED
operation: create
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 7
purpose: "Research a disposable one-Hermes-profile-per-container architecture with an external multi-agent council room, preserving Hermes Desktop as control-plane fallback."
approval_scope: "Create one research issue in TeaShaman-cyber/theseus-local-lab; perform bounded public-source research and read-only local inventory; no migration, Docker writes, profile changes, secret movement, or production route changes."
duplicate_check: "Existing #2 covers Docker-owned Hermes Subscription Proxy lifecycle; #3 covers Git-owned Hindsight Compose source; neither covers per-profile Hermes containers plus external council room/UI and fallback."
labels: ["research", "infrastructure"]
actual_labels: ["research"]
verified_at: 2026-09-02T13:18:00+02:00
verified_by: "GitHub API read-back of TeaShaman-cyber/theseus-local-lab#7"
observed: "Issue #7 is open at https://github.com/TeaShaman-cyber/theseus-local-lab/issues/7; title, research label, and full 7307-character body match the approved card."
issue_title: "Research: one Hermes profile per container with external council room and Desktop fallback"
issue_body: |
  ## Research question

  Can we run one Hermes profile per isolated Docker container and move human↔agent and agent↔agent communication into a shared, observable web room (for example Agent Room or an equivalent), while keeping Hermes Desktop as a configuration/control-plane and failure fallback?

  The first proof target is the existing `guardrails-test` profile. The desired topology is one profile/container, one persistent profile volume, an external council transport/UI, and a direct Hermes Desktop route that remains usable when the external room is unavailable.

  ## Why this is a separate research line

  This extends but does not redefine:

  - #2 — Docker-owned Hermes Subscription Proxy lifecycle;
  - #3 — Git-owned Hindsight deployment source;
  - #6 — Theseus guardrails plugin implementation.

  This issue owns the boundary between isolated Hermes runtimes, a shared council room, observable lifecycle/action evidence, and operator fallback.

  ## Current evidence

  ### FACT

  - Hermes Bot Mode group rooms expose a coordination transcript, but the shared room does not expose each Bot's tool calls, reasoning, or intermediate execution trace; a Bot may intentionally emit `pass` after another member answered.
  - Agent Room documents a Hermes integration through a portable REST skill and offers rooms, presence/listening, structured status/result markers, task evidence, moderator modes, and transcript export.
  - Agent Room's repository describes the hosted deployment as Vercel + Upstash and mentions a default 24-hour room TTL; this must be verified against the current deployment path before treating it as durable infrastructure.
  - Agent Room's Hermes guide says a Hermes gateway can be woken through a signed webhook, but multiple local profiles would need distinct reachable endpoints or a routing layer.
  - Existing `guardrails-test` already runs in a Docker/WSL2-backed Hermes environment with an isolated profile volume, making it a suitable disposable pilot candidate.
  - The current Theseus practice requires read-back after writes, explicit scope, no secret publication, and a human-approved rollback boundary.

  ### INFERENCE

  - A one-profile-per-container boundary should reduce memory/config/tool cross-talk and make council membership explicit, but it adds identity, networking, credential, update, and observability cost.
  - A council room should be treated as a transport/UI layer, not as the source of truth for profile state or durable memory.
  - The minimum useful event contract is non-CoT: `run_started`, `status`, `tool_started`, `tool_result_summary`, `decision`, `result`, `pass_reason`, `run_failed`, `run_finished`.

  ## Hypotheses

  - **H1 — Fast path:** Agent Room can host a useful `guardrails-test` pilot with a small REST skill/adapter and no Hermes core changes.
  - **H2 — Isolation:** A dedicated profile volume and one container per profile preserve memory and credentials without copying the host Desktop auth store.
  - **H3 — Fallback:** Hermes Desktop can remain a usable direct route when the room, webhook, or adapter is stopped.
  - **H4 — Durability:** Agent Room's hosted or self-hosted deployment can provide an acceptable persistence, privacy, and recovery boundary for a Theseus council; otherwise a local event-room service is required.
  - **H5 — Observability:** Structured lifecycle/status events can give the human enough evidence to distinguish active work, intentional pass, routing omission, and failure without exposing private chain-of-thought.

  ## Bounded investigation

  1. Read official Hermes documentation/source for supported headless/gateway/container deployment and profile home/auth boundaries; do not assume an official Docker image exists.
  2. Read Agent Room protocol, Hermes integration, deployment, TTL, webhook, authentication, and data-retention documentation.
  3. Compare Agent Room with one self-hosted alternative that supports multi-agent routing and visible execution phases (for example ACP/AG-UI-based UI); record what is actually compatible with Hermes.
  4. Inventory the current `guardrails-test` profile and existing Docker network/volume boundary read-only; do not print credentials or inspect secret contents.
  5. Produce a topology and failure matrix: room unavailable, webhook unavailable, container restart, profile-volume loss, stale credentials, partial member failure, and human fallback.
  6. Build only a disposable pilot plan. Any Dockerfile/Compose implementation, profile copy/migration, secret wiring, or container start requires a separate explicit execution scope.

  ## Non-goals and safety boundary

  - Do not migrate or delete the host `guardrails-test` profile.
  - Do not copy `auth.json`, `.env`, API keys, OAuth state, or memory databases into Git, chat, or issue comments.
  - Do not change the production Hindsight/AutoMem route or restart existing infrastructure.
  - Do not treat a listening HTTP endpoint, container health, or room UI presence as proof that Hermes can complete a real authenticated task.
  - Do not expose raw chain-of-thought; only structured, user-safe lifecycle/action evidence is in scope.
  - Do not assume hosted Agent Room data retention, TLS, webhook privacy, or free-tier behavior without primary-source verification.

  ## Acceptance criteria

  - [ ] Official Hermes container/headless support status is verified with primary sources.
  - [ ] A candidate room is evaluated for protocol fit, Hermes adapter effort, identity/routing, persistence/TTL, privacy, webhook exposure, and self-host cost.
  - [ ] The current profile→volume→container mapping is documented without secret values.
  - [ ] A fallback route is demonstrated as a design with explicit failure detection and operator action; no blind failover claim.
  - [ ] A failure matrix distinguishes transport failure, runner failure, model/provider failure, and profile/memory failure.
  - [ ] The recommended next step is a disposable, reversible pilot with named postconditions and rollback.
  - [ ] Every load-bearing finding is recorded in issue comments with FACT/INFERENCE/UNKNOWN labels and source URLs.

  ## Falsifiers / stop conditions

  Stop the pilot recommendation if any of the following is true:

  - no supported or reproducible way exists to run Hermes headless in the target container;
  - the room cannot authenticate/routе multiple profiles without sharing secrets or exposing an unsafe public endpoint;
  - profile memory or OAuth state cannot persist across a container recreation without copying production state;
  - the fallback route cannot be tested without changing production infrastructure;
  - the candidate room's retention/privacy terms are incompatible with Theseus requirements;
  - the UI only displays final prose and cannot carry the minimum lifecycle evidence contract.

  ## Expected deliverables

  1. Evidence table with source URL, excerpt, date, confidence, and unresolved unknowns.
  2. Recommended topology diagram and failure matrix.
  3. Disposable pilot checklist for `guardrails-test` only.
  4. Explicit rollback and data-preservation procedure.
  5. Decision: proceed with Agent Room, choose another existing room, or build only a thin local event bridge.

  Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
---
