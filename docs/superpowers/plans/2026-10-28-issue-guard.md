# Issue Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Не дать агенту продолжить работу после исследования, пока вывод не записан в задачу.

**Architecture:** Плагин Гермеса, который слушает `post_tool_call` (отмечает, что было исследование) и `pre_tool_call` (не пускает дальше, пока не увидит команду записи в задачу). Вся логика решения — в чистом модуле без зависимостей от Гермеса, чтобы её можно было проверить тестами; тонкая обвязка только передаёт события.

**Tech Stack:** Python 3.11+, плагинный API Гермеса (`register(ctx)`, `ctx.register_hook`), `unittest` для чистого модуля.

**Spec:** `docs/superpowers/specs/2026-10-28-issue-as-lab-notebook-design.md`

## Global Constraints

- Источник плагина живёт в репозитории: `deploy/hermes-plugins/issue-guard/`; копия в рантайме — не источник.
- Никаких правок ядра Гермеса: только публичный плагинный API.
- Плагин пишет в лог строки вида `issue_guard action=required|posted|skipped task=#N reason=...` — по ним строятся счётчики в Grafana.
- Отсутствие записи блокирует только **переход к другой работе**, а не продолжение исследования: новые `web_search`/`web_extract` не блокируются.
- Фаза 1 покрывает только веб-исследование. Замеры терминалом — отдельная фаза, чтобы не блокировать каждый `docker logs`.

## Отклонения от спеки (осознанные)

1. **«В конце хода» → «перед следующим не-исследовательским инструментом».** Хук `pre_verify` в Гермесе срабатывает только когда агент правил код, а исследовательский ход кода не трогает. Поэтому конец хода ловится не событием, а первым же действием, которое пытается уйти от исследования. Смысл сохраняется: уйти дальше без записи нельзя.
2. **Страховка «перед сжатием контекста» не реализуется в фазе 1.** В списке `VALID_HOOKS` нет хука сжатия для обычных плагинов (он есть только у провайдера памяти, а он занят Hindsight). Ближайшая замена — `on_session_end`, и это отдельная фаза, а не молчаливая дыра.

## Review Focus

- Агент делает `web_search`, затем сразу `write_file` — ожидание: заблокировано с внятным сообщением, работа не потеряна.
- Агент делает `web_search`, затем ещё `web_extract` — ожидание: не заблокировано, исследование продолжается.
- Агент пишет `gh issue comment 115 --body-file ...` — ожидание: разблокировано, состояние сброшено.
- Команда записи упала (неверный номер задачи) — ожидание: блокировка не снимается.
- В сессии не было исследования — ожидание: плагин молчит и ничего не требует.

---

### Task 1: Чистая логика решения

**Files:**
- Create: `deploy/hermes-plugins/issue-guard/guard.py`
- Test: `deploy/hermes-plugins/issue-guard/test_guard.py`

**Interfaces:**
- Produces:
  - `@dataclass GuardState(research_seen: bool, record_seen: bool, task: str | None)`
  - `RESEARCH_TOOLS: frozenset[str]` = `{"web_search", "web_extract", "web_fetch"}`
  - `observe(state: GuardState, tool_name: str, args: dict, ok: bool) -> GuardState`
  - `verdict(state: GuardState, tool_name: str, args: dict) -> str | None` — текст блокировки или `None`
  - `record_command_task(command: str) -> str | None` — номер задачи из команды `gh issue comment|create`, иначе `None`

- [ ] **Step 1: Написать падающие тесты**

```python
def test_research_then_other_tool_blocks():
    state = observe(GuardState(False, False, "115"), "web_search", {}, True)
    assert "115" in verdict(state, "write_file", {})

def test_research_then_more_research_passes():
    state = observe(GuardState(False, False, "115"), "web_search", {}, True)
    assert verdict(state, "web_extract", {}) is None

def test_record_clears_block():
    state = observe(GuardState(False, False, "115"), "web_search", {}, True)
    state = observe(state, "terminal", {"command": "gh issue comment 115 --body-file x.md"}, True)
    assert verdict(state, "write_file", {}) is None

def test_failed_record_keeps_block():
    state = observe(GuardState(False, False, "115"), "web_search", {}, True)
    state = observe(state, "terminal", {"command": "gh issue comment 115 --body-file x.md"}, False)
    assert verdict(state, "write_file", {}) is not None

def test_no_research_no_block():
    assert verdict(GuardState(False, False, None), "write_file", {}) is None

def test_record_command_parses_task():
    assert record_command_task("gh issue comment 115 --body x") == "115"
    assert record_command_task("gh issue create --title t") is None
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `python deploy/hermes-plugins/issue-guard/test_guard.py`
Expected: FAIL — `ModuleNotFoundError: guard`

- [ ] **Step 3: Реализовать `guard.py`**

`observe` ставит `research_seen=True`, если `tool_name in RESEARCH_TOOLS` и `ok`; ставит `record_seen=True`, если `record_command_task(args.get("command",""))` вернул номер. `verdict` возвращает текст блокировки, если `research_seen and not record_seen and tool_name not in RESEARCH_TOOLS`; текст обязан содержать номер задачи, если он известен, и требование записать вывод.

- [ ] **Step 4: Прогнать тесты**

Run: `python deploy/hermes-plugins/issue-guard/test_guard.py`
Expected: PASS, 6 тестов

- [ ] **Step 5: Коммит**

```bash
git add deploy/hermes-plugins/issue-guard/guard.py deploy/hermes-plugins/issue-guard/test_guard.py
git commit -m "feat(issue-guard): чистая логика «исследовал — запиши»"
```

---

### Task 2: Обвязка плагина

**Files:**
- Create: `deploy/hermes-plugins/issue-guard/__init__.py`
- Create: `deploy/hermes-plugins/issue-guard/plugin.yaml`

**Interfaces:**
- Consumes: `guard.observe`, `guard.verdict` из Task 1.
- Produces: `def register(ctx) -> None`, который регистрирует `pre_tool_call` и `post_tool_call`.

- [ ] **Step 1: Написать `plugin.yaml`**

```yaml
name: issue-guard
version: 0.1.0
description: Не даёт продолжить работу после исследования, пока вывод не записан в задачу.
```

- [ ] **Step 2: Написать `register(ctx)`**

Состояние — словарь `session_id -> GuardState`. `post_tool_call` вызывает `observe` с `tool_name`, `args`, `ok` из kwargs. `pre_tool_call` вызывает `verdict`; при непустом результате возвращает директиву блокировки `{"action": "block", "message": <текст>}` и пишет в лог `issue_guard action=required task=#N`; при разрешающей команде записи пишет `issue_guard action=posted task=#N`.

- [ ] **Step 3: Проверить, что плагин виден Гермесу**

Run: `hermes plugins list | grep issue-guard`
Expected: строка с `issue-guard`

- [ ] **Step 4: Коммит**

```bash
git add deploy/hermes-plugins/issue-guard/__init__.py deploy/hermes-plugins/issue-guard/plugin.yaml
git commit -m "feat(issue-guard): обвязка хуков"
```

---

### Task 3: Установка в рантайм и проверка на живом

**Files:**
- Create: `deploy/hermes-plugins/install_issue_guard.py`

**Interfaces:**
- Produces: `install(target_dir: Path) -> list[str]` — копирует файлы плагина в `%LOCALAPPDATA%/hermes/plugins/issue-guard/` и возвращает список скопированных имён; `--check` печатает расхождения и возвращает код 1 при них.

- [ ] **Step 1: Написать установщик с `--check`**

Копирование по списку файлов, сравнение по хешу, код возврата 1 при расхождении — как в `deploy/hermes-patches/check_hindsight_patch.py`.

- [ ] **Step 2: Установить и проверить**

Run: `python deploy/hermes-plugins/install_issue_guard.py && python deploy/hermes-plugins/install_issue_guard.py --check`
Expected: `--check` печатает `OK`, код 0

- [ ] **Step 3: Живая проверка вручную**

В новой сессии: сделать `web_search`, затем попробовать `write_file` — ожидание: блокировка с номером задачи. Затем `gh issue comment <N>` — ожидание: дальше проходит.

- [ ] **Step 4: Проверить лог и счётчики**

Run: `grep issue_guard %LOCALAPPDATA%/hermes/logs/agent.log | tail -5`
Expected: строки `action=required` и `action=posted`

- [ ] **Step 5: Коммит**

```bash
git add deploy/hermes-plugins/install_issue_guard.py
git commit -m "feat(issue-guard): установка в рантайм с проверкой"
```

---

### Task 4: Панель в Grafana

**Ruling:** счётчик берём запросом к Loki, а не извлечением метрик в Alloy. Цифра та же, но без правки живого конфига и без reload — в полночь это дешевле по риску.

Запрос проверен на исполнение: `sum by (action) (count_over_time({job="hermes"} |= "issue_guard action=" | regexp "action=(?P<action>[a-z]+)" [24h]))` — сканирует поток, возвращает ноль совпадений, потому что плагин ещё не дал ни одной строки (включается после рестарта).

Панель добавляется на дашборд Hermes двумя сериями: `action=required` (блокировки) и `action=posted` (записи).

### Task 4 (исходная формулировка, оставлена для истории): Счётчики в Grafana

**Files:**
- Modify: `deploy/alloy/config.alloy`

**Interfaces:**
- Consumes: строки `issue_guard action=...` из логов Гермеса.
- Produces: метрика `hermes_issue_guard_total{action=...}`.

- [ ] **Step 1: Добавить в Alloy разбор строк `issue_guard`**

По образцу существующего разбора `loki_process_custom_hermes_llm_*`: regexp по `action=(?P<action>\w+)`, счётчик по `action`.

- [ ] **Step 2: Проверить конфиг и перезагрузить**

Run: `alloy fmt --check deploy/alloy/config.alloy && curl -X POST http://127.0.0.1:12345/-/reload`
Expected: формат ок, reload 200

- [ ] **Step 3: Проверить, что метрика появилась**

Run: в Grafana `sum by (action) (hermes_issue_guard_total)`
Expected: значения для `required` и `posted`

- [ ] **Step 4: Коммит**

```bash
git add deploy/alloy/config.alloy
git commit -m "feat(observability): счётчики issue-guard"
```
