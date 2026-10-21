---
card_id: ISSUE-20260902-HERMES-GROUP-ROOM-PASS-EVIDENCE
status: READ_BACK_VERIFIED
operation: comment
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "Add one evidence comment to existing issue #91814 documenting group-room pass ambiguity and explicit multi-Bot addressing semantics; do not create a new issue; perform exact read-back."
issue_number: "91814"
issue_url: "https://github.com/NousResearch/hermes-agent/issues/91814"
title: "Evidence: group room cannot distinguish intentional pass from missing turn"
purpose: "Document a reproduced UX case where a user addresses multiple Bots in a shared room, one Bot answers, and another intentionally passes; the UI gives no visible reason or confirmation, making pass indistinguishable from routing or execution failure."
duplicate_check: "Existing #91814/#91817/#91826 cover the requested per-Bot activity panel and session transcript. This comment narrows the additional evidence to pass explainability and user-visible addressing semantics; no new issue created."
labels: []
actual_labels: []
verified_at: 2026-09-02T13:14:36+02:00
verified_by: "GitHub API read-back of comment 5508659436 by TeaShaman-cyber"
observed: "Comment 5508659436 is present on issue #91814 with the prepared body and URL https://github.com/NousResearch/hermes-agent/issues/91814#issuecomment-5508659436"
comment_body: |
  Additional reproduced UX evidence for the shared group-room contract:

  A user sent a message addressed conversationally to both Bots (\"this question is for both of you\"). Bot A answered. Bot B received the room turn, judged that Bot A's answer was already sufficient, and intentionally emitted `pass`. From the user's perspective, however, the room provided no visible distinction between:

  - Bot B intentionally passing because the question was already answered;
  - Bot B not being routed the message;
  - Bot B failing to start or complete its turn; or
  - the response being lost by the room UI.

  This is especially confusing because the user did not know that the room's response protocol treats a completed answer from another member as a reason to stay silent. A natural-language phrase such as \"for both of you\" also did not visibly guarantee a turn from both members; explicit `@bot-handle` addressing is the only discoverable way to target a member, but the UI does not explain this distinction.

  Suggested UX additions to the proposed activity panel / room transcript:

  1. Record a visible, non-CoT lifecycle event such as `passed: another member already answered` when a Bot intentionally passes.
  2. Show whether the Bot was addressed explicitly, included by the room's default fan-out, or not selected for the round.
  3. Make the room's addressing rule discoverable near the composer (for example: `@mention a Bot for a targeted turn; without mentions, eligible members may respond or pass`).
  4. Preserve these lifecycle events in the completed per-Bot activity timeline so silence is auditable without exposing private chain-of-thought.

  This evidence is about observable routing/lifecycle transparency only. It does not request exposing hidden reasoning or raw private chain-of-thought.

  Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
---
