---
card_id: ISSUE-20260822-003
status: READ_BACK_VERIFIED
operation: comment
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 84340
issue_url: https://github.com/NousResearch/hermes-agent/issues/84340
purpose: "Add a bounded follow-up connecting the placement-contract reproduction to adjacent typed contract, capability, authoring and source-of-truth issues without changing the issue's scope."
duplicate_check: "existing issue; comment only"
evidence:
  - "Issue #84340 has two independent live reproductions of content being routed to the wrong flat-file layer and duplicated."
  - "Related live issues: #55811, #28984, #67324, #87287, #87284, #85668, #86530 and #84772."
human_review:
  requested_at: 2026-08-22
  approved_at: 2026-08-22
  approval_scope: "comment on issue #84340 using the exact approved Draft comment body including Mermaid and Svarog signature"
  approver: user
readback:
  required: true
  expected: "Issue #84340 remains open and contains exactly one new comment with the approved text and Svarog provenance signature."
  observed: "Issue #84340 remains OPEN. Comment https://github.com/NousResearch/hermes-agent/issues/84340#issuecomment-5382328752 is authored by TeaShaman-cyber; normalized body matches the approved text and includes Mermaid plus the Svarog provenance signature."
  verified_at: 2026-08-22
---

## Draft comment

## Follow-up: placement is one instance of a wider typed-contract gap

The two live reproductions in this thread now sit inside a broader issue pattern. This does **not** mean all of the following reports share one implementation root cause; it means they repeatedly expose the same missing boundary between prose, state and the consumer that must act on it:

- #28984 — config/state producers and runtime consumers can silently drift;
- #55811 — high-risk capabilities need a structured pre-tool decision and trace;
- #67324 — `/learn` and background review need one authoritative skill-authoring contract;
- #87287 / #87284 — orchestrator plugins need declared behavior and explicit dispatch/concurrency contracts;
- #85668 / #86530 / #84772 — project state, UI/config and tool registries can each disagree with the live consumer.

This strengthens the original qualification of #84340. The immediate issue should remain focused on **placement discipline** for `SOUL.md`, `AGENTS.md`, `MEMORY.md` and `USER.md`, but the contract may benefit from a typed representation that records at least:

```text
kind · owner · scope · provenance · lifecycle · allowed use · verification
```

Markdown remains useful as the human- and harness-compatible surface. A JSON/YAML/typed registry would be a possible canonical representation for linting and generating those projections; it would **not** itself enforce runtime authority. Runtime actions still need the capability gate described in #55811.

The concrete acceptance invariant for this issue remains small:

```text
user facts/preferences -> USER.md
agent identity/anchor   -> SOUL.md or MEMORY.md by declared type
project rules           -> AGENTS.md
misplacement/duplication -> warning or failed validation + read-back
```

```mermaid
flowchart LR
    A[Incoming durable fact] --> B{kind / owner / scope}
    B -->|user fact or preference| U[USER.md]
    B -->|agent identity| S[SOUL.md]
    B -->|agent anchor or lesson| M[MEMORY.md]
    B -->|project rule| G[AGENTS.md]
    U --> V[placement + duplicate validator]
    S --> V
    M --> V
    G --> V
    V --> R[read-back: content + provenance + lifecycle]
```

---
Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
