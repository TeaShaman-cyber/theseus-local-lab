---
status: READ_BACK_VERIFIED
operation: comment
project: "Hermes Agent"
repository: "NousResearch/hermes-agent"
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: "84340"
issue_url: "https://github.com/NousResearch/hermes-agent/issues/84340"
purpose: "Add a second verified reproduction of recurring user-profile misplacement into MEMORY.md and clarify that the existing placement-contract issue also has a runtime symptom."
duplicate_check: "Read-back on 2026-08-16 found issue #84340 open with the original 2026-08-11 reproduction and no comments."
evidence:
  - "Issue #84340 already documents the original 2026-08-11 real-session reproduction."
  - "On 2026-08-16, after explicitly separating USER.md profile data from MEMORY.md operational data, the attempted cleanup again left user-profile entries in MEMORY.md and left duplicate entries."
  - "Follow-up read-back was required to detect the misplacement; no placement warning or validator fired."

human_review:
  requested_at: "2026-08-16T23:29:59+02:00"
  approved_at: "2026-08-16T23:29:59+02:00"
  approval_scope: "Publish exactly one comment below to NousResearch/hermes-agent issue #84340, then read back the issue and comment."
  approver: "user"

readback:
  required: true
  expected: "Exactly one new comment on issue #84340, authored by TeaShaman-cyber, with the approved body; issue remains OPEN and comment body matches after trim-normalization."
  observed: "Published https://github.com/NousResearch/hermes-agent/issues/84340#issuecomment-5309774757; issue #84340 remains OPEN; author TeaShaman-cyber; body matched the approved body exactly after trim-normalization (1457 characters)."
  verified_at: "2026-08-16T23:32:25+02:00"

notes: "User approved publishing the comment and adding type/bug to the existing issue. Signature is required by the local issue-publishing contract."

## Comment body

## Reproduction re-confirmed: recurring runtime failure

The original 2026-08-11 reproduction is not isolated.

On 2026-08-16, while explicitly separating user-profile data from agent/runtime memory, the same failure recurred:

- user preferences were correctly identified as belonging to `USER.md`;
- the cleanup operation nevertheless left user-profile entries in `MEMORY.md`;
- duplicate entries remained after the attempted migration;
- a follow-up read-back was required to detect and explain the misplacement;
- no placement warning or validator was triggered.

This is a second observed reproduction of the behavior described above, not merely a documentation preference. The current system allows user-profile content to enter `MEMORY.md`, allows the mistake to survive a subsequent rewrite, and provides no write-time or compaction-time signal.

Suggested qualification:

- keep this issue as the placement-contract/design gap;
- additionally qualify the observed behavior as a runtime bug (`type/bug`), or split it only if maintainers want the contract request and the enforcement defect tracked separately.

The expected invariant remains:

- `USER.md` — user facts and preferences;
- `MEMORY.md` — agent anchor and operational memory;
- user-profile content must not be written to `MEMORY.md`.

— Semyon Poklad and Сварог, an AI engineering agent and engineering partner.
Submitted only after Semyon Poklad's manual review and explicit approval.
