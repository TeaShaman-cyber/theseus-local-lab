---
card_id: ISSUE-20260902-HERMES-COUNCIL-EVIDENCE-04
status: READ_BACK_VERIFIED
operation: comment
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 7
purpose: "Record primary-source verification of Buzz as the leading self-hosted council candidate and select the Hermes native gateway route for a disposable pilot."
approval_scope: "Add one public-source evidence comment to issue #7; no Docker writes, profile migration, credential movement, or production route changes."
duplicate_check: "Fourth evidence comment on #7; complements prior comments and does not create a new issue."
labels: []
actual_labels: []
verified_at: 2026-09-02T13:37:00+02:00
verified_by: "GitHub API read-back of TeaShaman-cyber/theseus-local-lab#7 comment 5509223317"
observed: "Comment 5509223317 is present at https://github.com/TeaShaman-cyber/theseus-local-lab/issues/7#issuecomment-5509223317 with 3038 characters."
comment_body: |
  ## Evidence comment 04 — Buzz is the leading candidate, with an integration-risk gate

  Scope: bounded public-source research only. No local profile, Docker service, volume, credential, or production route was changed.

  ### FACT

  1. The official Hermes integration documentation describes three Buzz routes:
     Buzz Desktop managed runtime, relay bridge via `buzz-acp`/ACP, and Hermes' native gateway platform.
     It explicitly recommends the native gateway route for full Hermes because it preserves Hermes memory,
     skills, approvals, cron, and session management while Buzz supplies channels, DMs, mentions, threads,
     reactions, and a Nostr relay transport.
     Source: https://hermes-agent.nousresearch.com/docs/integrations/buzz

  2. Buzz's official repository describes a self-hostable workspace in which humans and agents share rooms,
     with signed Nostr events for messages, workflow steps, approvals, git events, and audit history. It
     provides a Docker-backed development stack and a production Compose bundle with Postgres, Redis, and
     MinIO. Its agent surface includes `buzz-cli`, JSON in/JSON out, and an ACP harness.
     Source: https://github.com/block/buzz

  3. Buzz's support documentation confirms that agents have independent profiles/public keys and scoped
     channel access. Hosted Block communities are not end-to-end encrypted; a self-hosted relay changes
     the operator boundary but does not make private-key handling optional.
     Source: https://block.github.io/buzz/support.html

  4. Buzz issue #5621 documents an open integration failure cluster involving identity handoff/bootstrap,
     membership, CLI/configuration, and reply publication. Buzz issue #4923 separately documents the case
     where a Hermes ACP turn completes and streams output, but no signed reply event is published to the
     channel. These are direct reasons to require postcondition checks rather than trusting a completed turn.
     Sources: https://github.com/block/buzz/issues/5621 and https://github.com/block/buzz/issues/4923

  ### INFERENCE

  Buzz is currently the strongest candidate for the Theseus council surface because its native abstraction
  is a shared event log with first-class human/agent identities, not merely a supervisor workflow or an
  observability dashboard. The preferred pilot route is Hermes native gateway platform (route ③), not ACP,
  because it keeps the Hermes runtime authoritative and uses Buzz as the communication/workspace layer.

  ### UNKNOWN / GATE

  The pilot must prove: (a) one dedicated Hermes profile/container can authenticate with its own Buzz key;
  (b) inbound channel messages reach the intended Hermes session; (c) exactly one signed reply is published
  and readable back from the relay; (d) identity and channel membership persist across restart; (e) a failed
  Buzz route leaves direct Hermes Desktop fallback usable; and (f) no secrets or unrelated profile state are
  exposed by the mounted volume. No migration is approved until these postconditions pass.
---
