---
card_id: ISSUE-20260902-HERMES-COUNCIL-EVIDENCE-02
status: READ_BACK_VERIFIED
operation: comment
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 7
purpose: "Record verified official Hermes Docker and multi-profile gateway evidence for issue #7."
approval_scope: "One public GitHub evidence comment on #7; no Docker writes, profile changes, secret movement, or production route changes."
duplicate_check: "Second evidence comment on #7; complements evidence-01 and does not create a new issue."
labels: []
actual_labels: []
verified_at: 2026-09-02T13:26:00+02:00
verified_by: "GitHub API read-back of TeaShaman-cyber/theseus-local-lab#7 comment 5508958486"
observed: "Comment 5508958486 is present at https://github.com/TeaShaman-cyber/theseus-local-lab/issues/7#issuecomment-5508958486 with 4205 characters."
comment_body: |
  ## Evidence comment 02 — official Hermes Docker path

  Scope: read-only public-source verification. No local container, profile, volume, credential, or production route was changed.

  ### FACT

  1. **Hermes publishes an official Docker image:** `nousresearch/hermes-agent`.
     Source: https://hub.docker.com/r/nousresearch/hermes-agent
     The Docker Hub page identifies the image as Hermes Agent and exposes a current `latest` tag.

  2. **The official Docker guide supports running Hermes itself inside a container.** The documented gateway command mounts a host Hermes data directory at `/opt/data`, runs `gateway run`, uses `restart: unless-stopped`, and exposes port `8642` for the gateway API/health endpoint.
     Source: https://hermes-agent.nousresearch.com/docs/user-guide/docker

  3. **The official image supervises gateway and dashboard services.** The guide documents s6-overlay supervision, crash restart, optional dashboard enablement with `HERMES_DASHBOARD=1`, and authenticated non-loopback dashboard requirements.
     Source: https://hermes-agent.nousresearch.com/docs/user-guide/docker

  4. **The official Docker guide treats `/opt/data` as the Hermes state boundary.** It lists config, `.env`, `auth.json`, sessions, memories, skills, logs, profiles, and related mutable state under the mounted data directory; the installed application tree is immutable in the published image.
     Source: https://hermes-agent.nousresearch.com/docs/user-guide/docker

  5. **The official multi-profile guide documents one independent gateway process per profile as the default model** and explicitly describes separate profile credentials, sessions, memory, skills, and model routing. It also documents a separate multiplexing alternative, which is not the hard-isolation model requested here.
     Source: https://hermes-agent.nousresearch.com/docs/user-guide/multi-profile-gateways

  6. **The official Docker documentation includes a Compose pattern with separate Hermes services and warns against sharing one Hermes data directory between containers.** This supports the one-profile/one-container direction as a viable topology candidate, but does not prove that an existing Windows profile can be copied safely into Linux without migration checks.
     Source: https://hermes-agent.nousresearch.com/docs/user-guide/docker

  7. **Agent Room remains a separate external layer.** Its Hermes integration uses REST/skill semantics and webhook wake-up, while its documented hosted deployment uses Vercel + Upstash and a room TTL. This is not the same state boundary as Hermes `/opt/data` and requires a separate persistence, privacy, and failure analysis.
     Sources:
     - https://github.com/ebin198351-akl/agent-room
     - https://github.com/ebin198351-akl/agent-room/blob/main/docs/integrations/HERMES.md

  ### INFERENCE

  - The safest pilot shape is now: one disposable Hermes container with one dedicated data volume, Agent Room adapter as a separate reversible integration, and host Hermes Desktop left untouched as fallback.
  - The official image removes the need to invent a Hermes Dockerfile, but the image does not solve room state, webhook routing, profile migration, or fallback semantics.

  ### UNKNOWN

  - Exact profile-directory layout and migration procedure for moving `guardrails-test` from the Windows host profile into a Linux container without copying unrelated profiles or secrets.
  - Whether the required Hermes gateway/API route can be safely consumed by an Agent Room adapter on a private Docker network.
  - Whether Agent Room can be self-hosted with a local state backend while preserving its protocol and evidence semantics.
  - How to implement fail-closed fallback when the room or adapter is unavailable.

  ### Next bounded probe

  Read the current Hermes Docker Compose and profile migration sections in full, inspect the Agent Room protocol/deployment source, and write the pilot topology/failure matrix. No container start or profile migration is authorized by this comment.

  Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
---
