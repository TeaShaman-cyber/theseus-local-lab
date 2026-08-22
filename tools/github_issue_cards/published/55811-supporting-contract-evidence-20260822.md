---
card_id: ISSUE-20260822-004
status: READ_BACK_VERIFIED
operation: comment
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 55811
issue_url: https://github.com/NousResearch/hermes-agent/issues/55811
purpose: "Contribute concrete operator evidence showing where prompt/file/config policy diverged from live consumers, while preserving the issue's runtime capability-gate scope."
duplicate_check: "existing issue; comment only"
evidence:
  - "#84340, #87283/#87284/#87287, #85668, #86530 and #84772 are live issue evidence from distinct Hermes surfaces."
  - "The proposed comment explicitly avoids claiming one shared implementation root cause or that JSON is enforcement."
human_review:
  requested_at: 2026-08-22
  approved_at: 2026-08-22
  approval_scope: "comment on issue #55811 using the exact approved Draft comment body including Mermaid and Svarog signature"
  approver: user
readback:
  required: true
  expected: "Issue #55811 remains open and contains exactly one new comment with the approved evidence and Svarog provenance signature."
  observed: "Issue #55811 remains OPEN. Comment https://github.com/NousResearch/hermes-agent/issues/55811#issuecomment-5382342096 is authored by TeaShaman-cyber; normalized body exactly matches the approved text and includes Mermaid plus the Svarog provenance signature."
  verified_at: 2026-08-22
---

## Draft comment

## Supporting evidence: prose/state contracts repeatedly diverge from live consumers

A set of operator reports provides concrete evidence for the runtime boundary proposed here. These are different bugs and should remain separately tracked, but they share the failure shape described in this issue:

```text
policy or state exists somewhere
  -> the live consumer uses a different source/path/default
  -> no final contract check detects the divergence
```

Examples:

- #84340: `SOUL.md` / `AGENTS.md` / `MEMORY.md` / `USER.md` have no enforced placement contract, so facts are misplaced and duplicated;
- #87283 / #87284 / #87287: a plugin can appear passive while gateway dispatch auto-promotes work and spawns workers without an explicit shared enablement/concurrency contract;
- #85668: active project state and process CWD select different `AGENTS.md` sources;
- #86530: Desktop Settings can show defaults while live config/runtime uses a different endpoint;
- #84772: MCP discovery/tool-search and the main dispatcher disagree about whether a tool is callable.

This supports the proposed structured decision object and trace. One additional distinction may help keep the design narrow:

```text
typed declarative contract -> describes capability, scope, provenance and required checks
human Markdown projection   -> explains the contract to operators and agents
runtime pre-tool gate       -> actually allows, denies or asks
postcondition/trace         -> proves which source and decision were used
```

JSON, YAML or another typed representation could support validation and generated documentation, but the representation is not the security boundary. The core value remains the Hermes-native runtime gate and auditable decision path proposed in this issue.

```mermaid
flowchart LR
    P[prompt / skill / memory / config] --> C[typed capability contract]
    I[actor / session / profile / channel] --> C
    C --> G{runtime pre-tool gate}
    G -->|allow| X[execute scoped action]
    G -->|ask| A[explicit approval]
    G -->|deny| D[block]
    X --> T[trace + postcondition]
    A --> G
    D --> T
```

---
Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
