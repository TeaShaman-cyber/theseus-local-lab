card_id: ISSUE-20260803-001
status: READ_BACK_VERIFIED

project: "Theseus Local Lab"
repository: "TeaShaman-cyber/theseus-local-lab"
repository_source: "current_workspace_origin"
target_confirmation: "pending"
issue_number: null
issue_url: ""
operation: "read"

purpose: "Проверить, что карточка и read-only маршрут согласованы перед первой записью в issue"
duplicate_check: "not-run"
evidence:
  - "docs/plans/github-issues-workflow.md"
  - "docs/plans/github-issue-card.md"

draft:
  title: ""
  body: ""
  comment: ""
  labels: []

human_review:
  requested_at: "2026-08-03"
  approved_at: ""
  approval_scope: ""
  approver: "user"

readback:
  required: true
  expected: "Прочитать текущую issue-структуру без изменения GitHub"
  observed: "Локальный launcher выполнил gh issue list --state all --limit 5; GitHub вернул пустой список []"
  verified_at: "2026-08-03T22:54:26+02:00"

notes: "Incidental local launcher smoke probe only; not canonical nakama-test issue-workflow evidence. Внешняя запись запрещена: operation=read."
