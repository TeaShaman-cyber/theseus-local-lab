# Operation card: Hermes Agent issue #87283 runtime follow-up

```yaml
card_id: ISSUE-20260816-HERMES-87283-RUNTIME-FOLLOWUP
status: READ_BACK_VERIFIED

project: "Hermes Agent"
repository: "NousResearch/hermes-agent"
repository_source: "user_contract"
target_confirmation: "user_confirmed"
issue_number: 87283
issue_url: "https://github.com/NousResearch/hermes-agent/issues/87283"
operation: "comment"

purpose: "Add verified runtime evidence that Desktop plugin disablement does not gate gateway dispatch and that normal gateway shutdown leaves orphaned workers capable of continued tool execution."
duplicate_check: "Read-back on 2026-08-16 found zero existing comments on issue #87283."
body_file: "docs/plans/github-issue-body-87283-runtime-followup.md"

evidence:
  - "Hermes Agent v0.20.1 (2026.8.13), Windows 11"
  - "Gateway log: spawned=12, reclaimed=1, crashed=29, promoted=11, auto_blocked=29"
  - "Seven live Kanban process trees remained after gateway exit, represented by 21 OS processes"
  - "Eleven task rows and eleven task_run rows remained running"
  - "Worker executed global mutation: hermes mcp remove gtd"
  - "Recovery verified 0 running tasks/runs and DB integrity ok"
  - "PR #87313 is open and green but currently adds disclosure rather than runtime lifecycle/authority enforcement"

human_review:
  requested_at: "2026-08-16T14:00:13+02:00"
  approved_at: "2026-08-16T14:03:16+02:00"
  approval_scope: "Publish the exact body in docs/plans/github-issue-body-87283-runtime-followup.md as exactly one comment on NousResearch/hermes-agent issue #87283."
  approver: "user"

readback:
  required: true
  expected: "Exactly one new comment on NousResearch/hermes-agent issue #87283, authored by TeaShaman-cyber, with body matching the approved file; issue URL/state and comment URL read back."
  observed: "Published https://github.com/NousResearch/hermes-agent/issues/87283#issuecomment-5307337616; issue #87283 remains OPEN; author TeaShaman-cyber; comment_count=1; body matches the approved file after trim-normalization (3310/3310 characters)."
  verified_at: "2026-08-16T14:04:22+02:00"

notes: "User explicitly approved the exact body and exactly one comment on issue #87283 at 2026-08-16T14:03:16+02:00."
```
