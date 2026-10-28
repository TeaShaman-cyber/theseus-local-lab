# SDD ledger — plan: docs/superpowers/plans/2026-10-28-issue-guard.md

Pre-flight: проверка общих интерфейсов — guard.py (Task 1) производит GuardState/verdict/observe, Task 2 их потребляет; имена совпадают.
Task 1: complete (tests: python deploy/hermes-plugins/issue-guard/test_guard.py -> 6/6 passed)
Task 2: complete (tests: test_plugin.py -> 5/5, test_guard.py -> 6/6)
Ruling: номер задачи до первой записи неизвестен, поэтому первая блокировка говорит «в задачу» и показывает шаблон команды. Стоимость ошибки: агент может записать не в ту задачу — но запись всё равно будет, и её видно.
Task 3: complete (tests: test_install.py -> 4/4)
