---
status: BLOCKED
operation: label
project: "Hermes Agent"
repository: "NousResearch/hermes-agent"
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: "84340"
issue_url: "https://github.com/NousResearch/hermes-agent/issues/84340"
purpose: "Qualify the recurring runtime symptom in the existing memory-file placement contract issue as a bug without creating a duplicate issue."
duplicate_check: "Issue #84340 is the existing placement-contract issue; no separate bug issue will be created."
evidence:
  - "The issue already contains a real-session reproduction from 2026-08-11."
  - "The same misplacement recurred on 2026-08-16 during an explicit profile/runtime memory separation."

human_review:
  requested_at: "2026-08-16T23:29:59+02:00"
  approved_at: "2026-08-16T23:29:59+02:00"
  approval_scope: "Add the existing GitHub label type/bug to NousResearch/hermes-agent issue #84340, then read back issue labels."
  approver: "user"

readback:
  required: true
  expected: "Issue #84340 remains OPEN and includes the type/bug label after the approved label operation."
  observed: "GraphQL gh issue edit failed with AddLabelsToLabelable permission error; REST POST /repos/NousResearch/hermes-agent/issues/84340/labels failed with HTTP 403 'Must have admin rights to Repository'. Read-back: issue #84340 remains OPEN and labels are unchanged; type/bug is absent."
  verified_at: "2026-08-16T23:32:25+02:00"

notes: "Keep the existing type/feature label and add type/bug; do not remove labels or create a duplicate issue."
