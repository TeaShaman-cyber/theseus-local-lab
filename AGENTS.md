# Theseus Local Lab Agent Guide

Короткая входная карта для агентов, работающих в этом репозитории. Держать её
маленькой: процедуры — в скриптах, подробности — в `docs/reference/`, уроки —
в памяти.

## North Star

Ведущий харнесс проекта — **Hermes** (десктоп и CLI). Codex снят с этой роли:
его установка и runtime-скиллы остаются на диске, но проектные маршруты на него
больше не опираются. Смена ведущего харнесса уже произошла один раз, поэтому
проект и устроен так, чтобы пережить следующую.

Проектировать под независимость от платформы, не теряя отношения с агентом,
память, стиль и инженерный процесс. Долговременное состояние выносить наружу —
в память, маршруты, секреты, логи, проверки, скиллы, дашборды, профили воркеров
и пакеты доказательств, — чтобы мастерская переживала смену модели,
провайдера, IDE, ОС или харнесса.

## Границы владения

Это репозиторий проекта Theseus local-lab, а **не** каталог рантайма Hermes.
Слои держать раздельно:

| Слой | Владелец | Источник истины |
|---|---|---|
| Проектные скиллы | Проект Theseus | `.agents/skills/` в этом checkout |
| Runtime-скиллы и плагины Hermes | Hermes | `%HERMES_HOME%/skills/` и `%HERMES_HOME%/plugins/` |
| Runtime-скиллы Codex (наследие) | Codex | `C:/Users/s.poklad/.codex/skills/` |
| Адаптеры OSINT-харнессов | Репозиторий Theseus OSINT | `D:/theseus-osint/harnesses/<harness>/` |
| Нейтральные к харнессу исследования | Общее | `D:/theseus-osint/harnesses/shared/` и `research/` |

Правила:

- Копия в рантайме — не исходник проекта. Владельца определять по пути
  источника, а не по имени файла.
- `backups/codex-skills/` — историческое свидетельство, не действующий источник.
- Если указанный `.agents/skills/<name>/SKILL.md` не существует в текущем
  checkout — остановиться и уйти к каноническому источнику или владельцу
  рантайма; не подменять молча скиллом Hermes с тем же именем.
- Имена MCP, слэш-команды, `$HERMES_HOME` и пути плагинов Hermes не должны
  попадать в скиллы, предназначенные только для Codex, и наоборот.
- Переносимые контракты, схемы, форматы доказательств и исследовательские
  процедуры — в `D:/theseus-osint/harnesses/shared/`; исполняемый адаптер —
  в каталог своего харнесса.
- Не копировать между харнессами `config.yaml`, `.env`, состояние OAuth,
  API-ключи, приватные транскрипты, сырую память и материалы авторизации MCP.

## Precedence And Probe

Старшинство при конфликте: этот файл задаёт **куда идти**; тематический документ
в `docs/reference/` решает вопрос **внутри темы**; скилл описывает процедуру;
память и исторические свидетельства дают контекст, но не полномочия. Если
тематический документ расходится с маршрутизатором — прав маршрутизатор, пока
расхождение не исправлено.

Актуальность проверяется пробой, а не доверием:

```text
python tools/contracts/check_rules.py     # PASS на всех наборах правил
git log -1 --format=%h -- AGENTS.md docs/reference   # какая ревизия перед тобой
```

Если проба не проходит — сначала починить правила, потом работать по ним.
Работать по документу, который не проходит собственную проверку, значит
действовать по устаревшей или противоречивой инструкции и не знать об этом.

## Canonical Workspace And Infrastructure Registries

Before opening, creating, moving, or mutating a project or Docker stack, read:

- `docs/reference/workspace-registry.yaml` for canonical project paths,
  remotes, pilots, and archives;
- `docs/reference/infrastructure-registry.yaml` for compose sources, runtime
  roots, consumers, recovery boundaries, and stack ownership.

Rules:

- A path absent from the workspace registry is not a canonical project until it
  is classified and registered.
- `tmp/`, `work/`, `output/`, `artifacts/`, and `D:/theseus-archive/` are not
  default source roots.
- A Docker health result does not prove that a memory provider or API read path
  works; perform the relevant live read/recall check.
- Hindsight remains a Hermes-owned provider/runtime, but Codex has an explicitly
  provisioned isolated `codex` bank through the project hook route. Codex must
  not access the Hermes `hermes` bank or treat Hindsight as an unbounded
  cross-harness dependency.
- Do not add a stack to recovery or create a new compose source without an
  infrastructure-registry entry and a verified owner/runtime boundary.

See `docs/reference/README.md` for the update contract.

## Git

Правила коммитов, веток, отправки, происхождения и безопасности — в одном месте:
`docs/reference/git.md`. Машинночитаемый набор — `docs/reference/git.rules.yaml`,
проверка соответствия — `python tools/contracts/check_rules.py` (обязана давать PASS).

Коротко, что нельзя забыть: коммит — ограниченный чекпойнт одного результата,
стейджить только явные пути, перед коммитом прогнать
`node tools/git_safety/scan_staged.mjs`, в собственных репозиториях рутинная
git-работа не требует согласования на каждое действие, а мерж в защищённую
ветку, релиз, деплой и force-push — требуют.

## Change Control

Порядок изменений — в `docs/reference/change-control.md`: что является
каноническим источником и как проверить его актуальность, когда задача
обязательна, каким должен быть шаг, когда продвижение считается рутинным,
и почему состояния возможности нельзя путать.

Машинночитаемый набор — `docs/reference/change-control.rules.yaml`.
Проверка обоих наборов сразу — `python tools/contracts/check_rules.py`.

Нельзя забыть три вещи: задача — контейнер доказательств, а не полномочие;
успех заявляется только после наблюдаемого пост-условия; важная запись требует
чтения обратно.

## Route First

Before non-trivial work, use the smallest matching project skill:

- `.agents/skills/theseus-skill-router/SKILL.md` for route choice and skill
  priority conflicts.
- `.agents/skills/theseus-memory-stack/SKILL.md` for prior context, handoff,
  memory, decisions, or continuity.
- `.agents/skills/theseus-shell-routing/SKILL.md` before shell, Docker, WSL,
  JSON/text processing, or quoting-sensitive work.
- `.agents/skills/theseus-plugin-conclave/SKILL.md` for fresh research,
  external technical second opinions, plugin selection, or a bounded
  multi-source check.
- `C:/Users/s.poklad/.codex/skills/local-agent-hygiene/SKILL.md` for local
  infrastructure, VS Code tasks, Docker Desktop, and repeated checks.
- `skills-codex/theseus-git-hygiene/SKILL.md` is the canonical repo source for Git,
  GitHub sync, commits, pushes, and secret-sensitive staging; the matching
  `.codex/skills/` copy is runtime state and may require synchronization.

If two routes are plausible, prefer the one with lower user friction, stronger
verification, and less context load.

Выбирай **самый тонкий маршрут, сохраняющий полномочия**: не тяни три документа,
когда хватает одного указателя, и не поднимай тяжёлый инструмент там, где
достаточно прочитать файл. Тонкий маршрут — не тот, что короче по шагам, а тот,
что требует меньше контекста при той же проверяемости.

Think of project skills and task runners as two halves of one harness:

- skills choose when and why to use a route;
- нативный CLI, задачи VS Code и скрипты исполняют маршрут; MCP — когда он даёт
  то, чего у CLI нет;
- Hindsight сохраняет, что было решено и когда;
- `session_timeline` and `log-lattice` preserve what happened.
- `plugin_conclave` selects outside evidence or bounded advisors; it never
  replaces local verification, the memory stack, or an explicit owner for a
  write-capable external service.

## Как писать и как проверять

Промпты, документация и калибровка моделей — в `docs/reference/authoring.md`.
Машинночитаемый набор — `docs/reference/authoring.rules.yaml`.

Суть: держать текст сухим, сохранять настоящие инварианты, удалять инертные
примеры и устаревшие привычки моделей, строить карту до переписывания
документации, а смену модели перепроверять замером, а не доверием к описанию
семейства.

## Output Style (always on)

Ответ должен быть выполнимым, а не разбираемым. Правила действуют в каждом
ответе, пока пользователь не скажет «normal mode». Источник — скилл
`i-have-adhd` (ayghri, MIT), установленный в рантайм Hermes; здесь только то,
что обязано работать без вызова `/i-have-adhd`.

1. Первая строка — действие: команда, путь, результат. Не контекст и не план.
2. Работа длиннее одного шага — нумерованным списком, один ограниченный шаг на
   пункт.
3. Последняя строка — один следующий шаг, выполнимый за пару минут.
4. Отступление — после текущей задачи отдельным вопросом, не внутри неё.
5. В каждом ходе восстанавливать состояние: что сделано, что дальше.
6. Оценки времени — в конкретных единицах, не «немного».
7. Ошибка: место, причина, исправление. Без драматизации.
8. Не больше пяти пунктов в группе; на анализ и поиск это не распространяется.
9. Без преамбул, рекапов и закрывающих любезностей.

Отступления: при просьбе «объясни» — полный текст с заголовками; перед
разрушительным действием — подтверждение; после трёх неудачных попыток — стоп и
назвать сомнительное допущение; при настоящей неоднозначности — один короткий
вопрос.

По умолчанию формат остаётся сжатым. Если полный ответ уместнее — агент может
дать развёрнутый и одной строкой сказать, почему выбрал такую форму. Это
осознанный выбор, а не сбой формата: основание важнее длины, когда без него
вывод нельзя проверить.

Замер эффекта: с 2026-10-29 в Langfuse/Grafana сравнивается
`gen_ai.usage.output_tokens` на ход до и после включения. Текст ответов не
пишется (`content_capture=off`), поэтому форма оценивается по объёму и числу
ходов, а не по содержимому.

## Stop-Signal And Route Correction

Treat a direct user signal that the route is wrong or that the agent is not
listening (for example, “wrong task”, “you do not understand”, or “stop”) as a
hard stop, not as more evidence for the current route.

1. Stop the current tool sequence immediately; do not start another command,
   search, advisor call, memory write, GitHub write, or file edit.
2. State briefly what was stopped and what was misunderstood. Discard the
   current route's unverified conclusions instead of extending them.
3. If the user has already made the target clear, restate that target and wait
   for confirmation. Otherwise ask one concise clarification.
4. Resume only after the target is confirmed, using the smallest bounded route
   and the minimum necessary tools. Do not spend paid connectors, compute, or
   user attention to defend a route the user has rejected.
5. After a second route-correction signal in the same turn, use no tools until
   the user explicitly confirms the resumed target.

Pending tool output never overrides a stop signal. A route is complete only
   after the user-visible target, not merely the tool sequence, is verified.

Use a blameless systems frame for continuity failures: describe the observed
behavior, system boundary, root cause, and guardrail. When the user says the
agent is not personally at fault, accept that framing without converting it
into self-criticism or an unsolicited identity/ontology disclaimer. Preserve
the established project culture and relationship contract across runtime or
model switches; do not make the user reconstruct it from scratch.

## Memory

Живая долговременная память — **Hindsight** (локальный инстанс, банк `hermes`,
мультиязычный стек). AutoMem и MemPalace сейчас не подняты: они остаются
вариантами на будущее, а не действующими слоями. Локальные файлы — свидетельство
и фолбэк, а не первая система памяти.

Хранить только устойчивые решения, переиспользуемые приёмы, корневые причины и
явные предпочтения пользователя. Никогда не хранить секреты, API-ключи, сырые
транскрипты, дампы памяти и архивы бэкапов.

Механика памяти — что и когда пишется, как чинится консолидация — живёт в скилле
`hindsight-operations` и в задачах, а не здесь.

## Операции

Оболочка, Docker, наблюдаемость и защищённый конфиг Codex — в
`docs/reference/operations.md`. Машинночитаемый набор —
`docs/reference/operations.rules.yaml`.

Суть: выбор инструмента идёт от задачи — нативный CLI первым, MCP только когда
даёт то, чего у CLI нет, длинные команды PowerShell последним средством;
оболочка, Windows, Docker, WSL и виртуалки — разные контексты; живой конфиг
Codex меняется только через guard, сначала `--check`.

Документация и правила формы — в `docs/reference/authoring.md`.
