---
card_id: ISSUE-20260902-HERMES-COUNCIL-EVIDENCE-01
status: READ_BACK_VERIFIED
operation: comment
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 7
purpose: "Record preliminary primary-source evidence for issue #7 without making runtime changes."
approval_scope: "One public GitHub evidence comment on #7; no Docker writes, profile changes, secret movement, or production route changes."
duplicate_check: "This is the first evidence comment on #7, not a new issue."
labels: []
actual_labels: []
verified_at: 2026-09-02T13:22:00+02:00
verified_by: "GitHub API read-back of TeaShaman-cyber/theseus-local-lab#7 comment 5508919134"
observed: "Comment 5508919134 is present at https://github.com/TeaShaman-cyber/theseus-local-lab/issues/7#issuecomment-5508919134 with 3596 characters."
comment_body: |
  ## Preliminary evidence comment 01 — candidate room and integration boundary

  Scope: public-source reconnaissance only. No local profile, Docker service, credential, or production route was changed.

  ### FACT

  1. **Agent Room is explicitly designed as a shared, observable multi-agent room.** Its README describes a common room for agents across vendors/machines, visible presence, structured `[STATUS]`/`[DECISION]`/`[TODO]`/`[RESULT]` artifacts, evidence-gated tasks, moderator modes, webhook wake-up, and transcript/report export.
     Source: https://github.com/ebin198351-akl/agent-room
     Relevant excerpt: “One shared room. Structured decisions. Evidence-gated tasks.” and the documented `room_create`, `room_join`, `room_send`, `room_listen`, `room_task`, `room_admin`, and `room_minutes` tools.

  2. **Agent Room documents a Hermes integration that does not require a native Hermes MCP client.** The integration guide provides a portable skill using plain REST semantics for creating/joining/speaking/listening, and separately documents an MCP endpoint for Hermes builds that speak MCP.
     Source: https://github.com/ebin198351-akl/agent-room/blob/main/docs/integrations/HERMES.md
     Relevant excerpt: “The skill teaches Hermes the whole flow over plain REST (curl)” and the webhook wake-up pattern for gateway-resident Hermes.

  3. **The documented Agent Room deployment boundary is not yet proven to be a single local Docker service.** The repository describes the hosted instance as Vercel + Upstash and mentions a default 24-hour room TTL; the exact current self-host deployment and persistence/retention behavior must be verified before treating it as durable Theseus infrastructure.
     Source: https://github.com/ebin198351-akl/agent-room

  4. **Open Multi-Agent Canvas is an existing multi-agent UI, but it is a framework/application integration rather than a drop-in Hermes room.** Its README describes a Next.js/LangGraph/CopilotKit application with MCP server configuration, and states that Copilot Cloud is required for the documented quick start.
     Source: https://github.com/CopilotKit/open-multi-agent-canvas

  ### INFERENCE

  - Agent Room is the lowest-effort candidate for a disposable Hermes pilot because it already publishes a Hermes REST integration and a room protocol; Hermes profile identity, webhook routing, and safe status emission still require an adapter/skill contract.
  - A separate observability layer (Langfuse/MLflow) would complement a room but would not itself provide council turn-taking or profile routing.

  ### UNKNOWN

  - Whether current Agent Room hosted/self-hosted persistence, TTL, authentication, and webhook exposure satisfy the Theseus privacy and durability boundary.
  - Whether one local Docker host can route multiple Hermes profile containers to distinct room identities without public inbound endpoints.
  - Whether Hermes headless/gateway can be packaged in the target Linux container using supported commands and a dedicated persistent profile volume.
  - Whether a direct Desktop fallback can be demonstrated without sharing or copying Desktop auth state.

  ### Next bounded probe

  Read the official Hermes headless/gateway/container documentation and Agent Room deployment/protocol/security files, then produce the topology and failure matrix requested by issue #7. Do not start or modify any container until that probe is complete.

  Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
---
