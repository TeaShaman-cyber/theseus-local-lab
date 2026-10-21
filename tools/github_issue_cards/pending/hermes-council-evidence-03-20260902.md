---
card_id: ISSUE-20260902-HERMES-COUNCIL-EVIDENCE-03
status: READ_BACK_VERIFIED
operation: comment
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 7
purpose: "Record comparative research on self-hosted council UIs and multi-agent runtimes."
approval_scope: "One public-source evidence comment on #7; no Docker writes, profile changes, secret movement, or production route changes."
duplicate_check: "Third evidence comment on #7; complements official Hermes Docker evidence and does not create a new issue."
labels: []
actual_labels: []
verified_at: 2026-09-02T13:32:00+02:00
verified_by: "GitHub API read-back of TeaShaman-cyber/theseus-local-lab#7 comment 5509057544"
observed: "Comment 5509057544 is present at https://github.com/TeaShaman-cyber/theseus-local-lab/issues/7#issuecomment-5509057544 with 5717 characters."
comment_body: |
  ## Evidence comment 03 — alternatives to Agent Room

  Scope: bounded public-source research only. No local profile, Docker service, credential, or production route was changed.

  ### FACT

  1. **Agent Chat UI is a mature open-source web UI with first-class tool-call and interrupt rendering, but its backend contract is LangGraph.** The official docs say it connects to any LangGraph agent/server, renders tool calls and tool results, and supports time-travel debugging and state forking. The repository is MIT-licensed and can be run locally.
     Sources:
     - https://docs.langchain.com/oss/python/langchain/ui
     - https://github.com/langchain-ai/agent-chat-ui

  2. **Flowise has a self-hostable multi-agent workflow model with a Supervisor and Worker team.** Its official documentation describes delegation, tool use by workers, memory, recursion/iteration limits, and result aggregation. It also documents constraints: one active task at a time and one Supervisor per flow.
     Source: https://docs.flowiseai.com/using-flowise/agentflowv1/multi-agents

  3. **Langflow provides detailed execution traces for flows/components and can export traces to external observability backends.** This makes it useful as a self-hosted workflow/trace surface, but the cited docs describe flow execution rather than a persistent room for independent Hermes profiles.
     Source: https://docs.langflow.org/1.10.0/traces

  4. **Dify is self-hostable and exposes logs for Agent, Chat, and Workflow applications.** The official docs describe agent nodes and run logs, but do not establish a general-purpose shared room where independently running Hermes profiles can deliberate.
     Sources:
     - https://docs.dify.ai/en/self-host/use-dify/build/agent
     - https://docs.dify.ai/en/self-host/use-dify/nodes/agent
     - https://docs.dify.ai/en/self-host/use-dify/monitor/logs

  5. **AutoGen Studio is a low-code web interface for prototyping agents and teams, but it assumes the AutoGen/AgentChat runtime.** It is therefore a candidate for rebuilding the council, not a drop-in UI for existing Hermes profiles.
     Source: https://microsoft.github.io/autogen/stable/user-guide/autogenstudio-user-guide/index.html

  6. **Open Multi-Agent Canvas is open source and provides one dynamic conversation with multiple agents and MCP servers, but it is built around Next.js, LangGraph, and CopilotKit.** It is a candidate frontend/orchestrator to adapt, not a ready Hermes-profile bridge.
     Source: https://github.com/CopilotKit/open-multi-agent-canvas

  7. **Agent Room is the closest existing room abstraction for heterogeneous agents, but its documented hosted deployment is serverless (Vercel + Upstash) rather than a ready self-hosted Docker service.** Its Hermes integration is REST/skill-oriented, which is promising for a bridge, but room persistence and webhook routing remain integration concerns.
     Sources:
     - https://github.com/ebin198351-akl/agent-room
     - https://github.com/ebin198351-akl/agent-room/blob/main/docs/integrations/HERMES.md

  ### INFERENCE

  - If preserving Hermes as the runtime is the priority, the best ready-UI candidate is **Agent Chat UI only after building a thin Hermes→LangGraph-compatible adapter**. Its tool/evidence rendering is already solved, but its thread/run contract must be mapped carefully.
  - If avoiding a custom web UI is the priority, **Flowise** is the fastest self-hosted council prototype, but Hermes profiles would become workers behind Flowise rather than first-class persistent agents.
  - If preserving independent profile memory, skills, credentials, and Desktop fallback is non-negotiable, no candidate found so far is drop-in; an adapter/event bridge is unavoidable.
  - A practical architecture may combine the official Hermes gateway/API per profile with a lightweight coordinator and Agent Chat UI or AG-UI-compatible frontend, while keeping Langfuse/Langflow traces optional rather than making them the room state.

  ### UNKNOWN

  - Whether Agent Chat UI can consume a minimal Hermes adapter without requiring LangSmith in local/self-hosted mode after the thread/run protocol is implemented.
  - Whether Flowise can call Hermes gateway instances with sufficient streaming, timeout, and per-profile identity semantics.
  - Whether LobeHub Agent Groups expose a true multi-agent turn/event contract or primarily multiple selectable agents; public docs were not extractable in this probe and are not counted as verified evidence.
  - Whether any candidate preserves Hermes tool approval, guardrail decisions, and profile-scoped memory without duplicating or weakening those controls.

  ### Current ranking

  1. **Agent Room** — fastest heterogeneous-agent room; self-host/state adaptation required.
  2. **Agent Chat UI + Hermes adapter** — strongest ready trace UI; LangGraph compatibility work required.
  3. **Flowise** — fastest self-hosted orchestrator; Hermes profiles become external workers.
  4. **AG-UI/CopilotKit or Open Multi-Agent Canvas** — best custom architecture base; implementation cost higher.
  5. **Langflow/Dify/Langfuse/MLflow** — complementary workflow/observability, not the council room itself.
  6. **AutoGen Studio** — useful only if Theseus accepts an AutoGen runtime rewrite.

  ### Next bounded probe

  Compare the minimal Hermes gateway/API contract with Agent Chat UI's LangGraph thread/run contract and Flowise's HTTP/custom-tool capabilities. Produce a reversible adapter design and failure matrix; do not deploy or migrate anything yet.

  Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
---
