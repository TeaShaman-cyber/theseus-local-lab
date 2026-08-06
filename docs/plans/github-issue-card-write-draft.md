card_id: ISSUE-20260803-002
status: READ_BACK_VERIFIED

project: "Nakama Test blog"
repository: "TeaShaman-cyber/nakama-test"
repository_source: "user_contract"
target_confirmation: "user_confirmed"
issue_number: null
issue_url: ""
operation: "create"

purpose: "Зафиксировать локальный human-gated процесс работы агентов с GitHub Issues"
duplicate_check: "not-run"
evidence:
  - "docs/plans/github-issues-workflow.md"
  - "docs/plans/github-issue-card.md"
  - "tools/github_issue_cards/issue_card_guard.mjs"

draft:
  title: "Proposal: human-gated workflow for agent GitHub Issue actions"
  body: |
    ## Context

    Агентская работа с GitHub Issues должна сохранять человеческое ревью перед
    любой внешней записью и проверять результат после операции.

    ## Proposed workflow

    1. определить проект, репозиторий и одну операцию;
    2. проверить существующие и похожие issue;
    3. подготовить локальную карточку и черновик;
    4. получить явное одобрение конкретного текста и операции;
    5. выполнить одну разрешённую операцию через проектный GitHub route;
    6. прочитать результат обратно и закрыть карточку фактическим статусом.

    ## Scope

    Секреты и auth-маршрут остаются внутри project launcher/wrapper. Карточка
    не содержит токенов и не является заменой GitHub API или MCP.

    ## Verification

    Локальные rails находятся в `tools/github_issue_cards/` и проверяют поля
    карточки, human-gate и read-back. Этот issue является предложением для
    обсуждения, а не заявлением о завершённой интеграции.

    ## Question

    Подходит ли такой минимальный контракт для дальнейшей работы с issue в
    этом репозитории?
  comment: ""
  labels: []

human_review:
  requested_at: "2026-08-03"
  approved_at: "2026-08-03"
  approval_scope: "Создать ровно одну issue с указанными title и body в TeaShaman-cyber/nakama-test; после создания выполнить read-back номера, URL, title и state"
  approver: "user"

readback:
  required: true
  expected: "После создания получить номер, URL, title и state новой issue"
  observed: "Created #1; state OPEN; title and URL match exactly; body matches local approved body after normalized trailing-newline comparison (length 976)"
  verified_at: "2026-08-03T23:25:41+02:00"

notes: "Черновик для ручного ревью. Не выполнять до отдельного одобрения пользователя."
