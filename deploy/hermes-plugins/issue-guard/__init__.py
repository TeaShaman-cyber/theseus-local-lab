"""issue-guard: задача — лабораторный журнал, и уйти от исследования без записи нельзя.

Плагин слушает два хука Гермеса:

- `post_tool_call` — отмечает, что было исследование, и что запись состоялась;
- `pre_tool_call` — не пускает к другой работе, пока записи нет.

Вся логика решения живёт в `guard.py` и покрыта тестами; здесь только проводка.
"""
from __future__ import annotations

import logging
import pathlib
import sys

_PLUGIN_DIR = str(pathlib.Path(__file__).resolve().parent)
if _PLUGIN_DIR not in sys.path:
    sys.path.insert(0, _PLUGIN_DIR)

from guard import GuardState, observe, verdict  # noqa: E402

log = logging.getLogger("issue_guard")

#: Состояние по сессиям: чужая сессия не должна снимать нашу блокировку.
_STATE: dict[str, GuardState] = {}

_OK_STATUSES = frozenset({"ok", "success", "completed", "done"})


def _session_key(session_id: object) -> str:
    return str(session_id or "default")


def _succeeded(status: object, error_type: object) -> bool:
    """Успех по данным хука, а не по тексту результата.

    `post_tool_call` отдаёт `status` и `error_type`, поэтому догадываться по
    строке результата не нужно: упавшая команда записи не должна снимать блок.
    """
    if error_type:
        return False
    if status is None:
        return True
    return str(status).strip().lower() in _OK_STATUSES


def on_post_tool_call(*, tool_name: str = "", args: dict | None = None, status: object = None,
                      error_type: object = None, session_id: object = None, **_ignored: object) -> None:
    key = _session_key(session_id)
    before = _STATE.get(key, GuardState())
    after = observe(before, tool_name, args or {}, _succeeded(status, error_type))
    _STATE[key] = after
    if after.record_seen and not before.record_seen:
        log.info("issue_guard action=posted task=#%s session=%s", after.task, key)


def on_pre_tool_call(*, tool_name: str = "", args: dict | None = None,
                     session_id: object = None, **_ignored: object) -> dict | None:
    key = _session_key(session_id)
    state = _STATE.get(key, GuardState())
    message = verdict(state, tool_name, args or {})
    if not message:
        return None
    log.info("issue_guard action=required task=#%s tool=%s session=%s",
             state.task or "?", tool_name, key)
    return {"action": "block", "message": message}


def register(ctx) -> None:
    ctx.register_hook("post_tool_call", on_post_tool_call)
    ctx.register_hook("pre_tool_call", on_pre_tool_call)
