"""Чистая логика issue-guard: решает, можно ли агенту уйти от исследования.

Ничего не знает про Гермес: на вход события инструментов, на выход — текст
блокировки или None. Так её можно проверить без рантайма и без сети.

Смысл: задача — лабораторный журнал, и после исследования вывод должен попасть
в журнал до того, как начнётся другая работа. Продолжать исследование при этом
нельзя запрещать — иначе агент не сможет дочитать первоисточник.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, replace

#: Инструменты, которыми добывают знание. Их вызов не блокируется никогда.
RESEARCH_TOOLS = frozenset({"web_search", "web_extract", "web_fetch"})

#: Команда записи в задачу. `gh issue create` не считается: у создания нет номера.
_RECORD_COMMAND = re.compile(r"\bgh\s+issue\s+comment\s+#?(\d+)\b")


@dataclass(frozen=True)
class GuardState:
    """Что известно о текущей сессии."""

    research_seen: bool = False
    record_seen: bool = False
    task: str | None = None


def record_command_task(command: str) -> str | None:
    """Номер задачи, если команда пишет в существующую задачу."""
    match = _RECORD_COMMAND.search(command or "")
    return match.group(1) if match else None


def observe(state: GuardState, tool_name: str, args: dict, ok: bool) -> GuardState:
    """Обновляет состояние по завершившемуся вызову инструмента.

    Неудачный вызов не считается ни исследованием, ни записью: иначе упавшая
    команда снимала бы блокировку, ничего не записав.
    """
    if not ok:
        return state
    if tool_name in RESEARCH_TOOLS:
        return replace(state, research_seen=True)
    task = record_command_task((args or {}).get("command", ""))
    if task:
        return replace(state, record_seen=True, task=task)
    return state


def verdict(state: GuardState, tool_name: str, args: dict) -> str | None:
    """Текст блокировки, если уходить от исследования пока нельзя."""
    if not state.research_seen or state.record_seen:
        return None
    if tool_name in RESEARCH_TOOLS:
        return None
    target = f"#{state.task}" if state.task else "задачу"
    command = f"gh issue comment {state.task}" if state.task else "gh issue comment <N>"
    return (
        f"Исследование было, а записи в {target} нет. "
        f"Запиши наблюдение и вывод командой `{command}` — и только потом продолжай."
    )
