# GitHub Issue action card

```yaml
card_id: ISSUE-YYYYMMDD-NNN
status: DRAFT

project: ""
repository: ""
repository_source: "user_contract | project_card | read_only_discovery | pending"
target_confirmation: "pending | user_confirmed"
issue_number: null
issue_url: ""
operation: "read | create | edit | comment | label | close"

purpose: ""
duplicate_check: "not-run"
evidence:
  - ""

draft:
  title: ""
  body: ""
  comment: ""
  labels: []

human_review:
  requested_at: ""
  approved_at: ""
  approval_scope: ""
  approver: "user"

readback:
  required: true
  expected: ""
  observed: ""
  verified_at: ""

notes: ""
```

## Заполнение

- `project` и `repository` обязательны до подготовки текста.
- `repository_source` показывает, откуда взята цель: из пользовательского
  контракта, карточки проекта или read-only discovery. Для нового проекта
  допускается `pending` до определения репозитория.
- `current_workspace_origin` не является допустимым источником target: текущий
  checkout может быть только техническим execution context.
- `target_confirmation` становится `user_confirmed` только после явного
  подтверждения конкретного репозитория в чате; это отдельный gate от
  одобрения текста issue.
- `operation` выбирается до ревью и не меняется молча после одобрения.
- `draft` содержит только то, что реально будет отправлено.
- `approval_scope` должен назвать конкретную операцию и конкретный текст.
- `readback.expected` формулируется до записи; `observed` заполняется только
  после чтения результата обратно.
- Секреты, токены, env-переменные и внутренние auth-пути сюда не записываются.
