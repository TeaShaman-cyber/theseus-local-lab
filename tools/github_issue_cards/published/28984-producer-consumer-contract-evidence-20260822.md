---
card_id: ISSUE-20260822-005
status: READ_BACK_VERIFIED
operation: comment
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 28984
issue_url: https://github.com/NousResearch/hermes-agent/issues/28984
purpose: "Add recent cross-surface examples of the producer-consumer binding gap and suggest parity tests without expanding the issue into runtime authorization."
duplicate_check: "existing issue; comment only"
evidence:
  - "Recent issue examples: #85668 project/CWD, #86530 UI/config/runtime, #84772 tool registry/dispatcher and #85622 documented additive memory versus provider-spawn path."
  - "The comment keeps typed binding and runtime authorization as separate layers."
human_review:
  requested_at: 2026-08-22
  approved_at: 2026-08-22
  approval_scope: "comment on issue #28984 using the exact approved Draft comment body including Mermaid and Svarog signature"
  approver: user
readback:
  required: true
  expected: "Issue #28984 remains open and contains exactly one new comment with the approved examples and Svarog provenance signature."
  observed: "Issue #28984 remains OPEN. Comment https://github.com/NousResearch/hermes-agent/issues/28984#issuecomment-5382350573 is authored by TeaShaman-cyber; normalized body exactly matches the approved text and includes Mermaid plus the Svarog provenance signature."
  verified_at: 2026-08-22
---

## Draft comment

## Additional cross-surface examples of producer/consumer contract drift

Several newer reports fit the producer→consumer pattern described here, beyond ordinary config-field propagation:

- #85668: the project registry identifies the intended workspace, while the Desktop process CWD selects a different `AGENTS.md`;
- #86530: live config/runtime uses a local provider endpoint while the Settings UI continues to render a default cloud endpoint;
- #84772: MCP discovery and `tool_search` expose tools that the main dispatch registry cannot call;
- #85622: documentation specifies additive built-in + external memory, while one provider activation path produced a different session result.

These issues should not be collapsed into one bug, but they strengthen the FR's central claim: producer and consumer bindings are implicit, path-specific and difficult to verify before a user hits the missed path.

A useful extension to the proposed parity tests may be to require each declared contract field/state to identify:

```text
canonical producer
expected consumers/projections
activation boundary
parity test across execution surfaces
observable postcondition
```

For example, project-primary and CWD should have a declared relationship; MCP tool discovery and callable dispatch should converge on one registry or fail visibly; UI values should be read from the same effective config/runtime projection that the service uses.

```mermaid
flowchart LR
    P[canonical producer] --> R[typed contract registry]
    R --> U[Settings UI projection]
    R --> C[CLI / effective config]
    R --> W[worker / gateway runtime]
    R --> T[tool discovery + dispatch]
    U --> Q{parity checks}
    C --> Q
    W --> Q
    T --> Q
    Q --> O[observable postcondition or visible failure]
```

This remains complementary to #55811: this issue can prove that state/config reaches every intended consumer, while the runtime capability contract decides whether a high-risk action is authorized.

---
Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
