"""Тесты чистой логики issue-guard: без Гермеса, без сети, без файлов.

Запуск: python deploy/hermes-plugins/issue-guard/test_guard.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from guard import GuardState, observe, record_command_task, verdict  # noqa: E402


def test_research_then_other_tool_blocks() -> None:
    state = observe(GuardState(False, False, "115"), "web_search", {}, True)
    message = verdict(state, "write_file", {})
    assert message is not None, "после исследования переход к другой работе должен блокироваться"
    assert "115" in message, f"в сообщении должен быть номер задачи, получено: {message!r}"


def test_research_then_more_research_passes() -> None:
    state = observe(GuardState(False, False, "115"), "web_search", {}, True)
    assert verdict(state, "web_extract", {}) is None, "продолжение исследования блокировать нельзя"


def test_record_clears_block() -> None:
    state = observe(GuardState(False, False, "115"), "web_search", {}, True)
    state = observe(state, "terminal", {"command": "gh issue comment 115 --body-file x.md"}, True)
    assert verdict(state, "write_file", {}) is None, "после успешной записи блокировка снимается"


def test_failed_record_keeps_block() -> None:
    state = observe(GuardState(False, False, "115"), "web_search", {}, True)
    state = observe(state, "terminal", {"command": "gh issue comment 115 --body-file x.md"}, False)
    assert verdict(state, "write_file", {}) is not None, "неудачная запись не снимает блокировку"


def test_no_research_no_block() -> None:
    assert verdict(GuardState(False, False, None), "write_file", {}) is None


def test_record_command_parses_task() -> None:
    assert record_command_task("gh issue comment 115 --body x") == "115"
    assert record_command_task("gh issue create --title t") is None


def main() -> int:
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    failed = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {test.__name__}: {exc}")
    print(f"\n{tests.__len__() - failed}/{tests.__len__()} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
