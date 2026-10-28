"""Тесты обвязки плагина: проверяют, что хуки подключены и ведут себя как задумано.

Гермес грузит `__init__.py` из каталога плагина, поэтому тест делает то же самое —
через importlib по пути к файлу, с поддельным ctx.
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys

PLUGIN_DIR = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(PLUGIN_DIR))


def load_plugin():
    spec = importlib.util.spec_from_file_location("issue_guard_plugin", PLUGIN_DIR / "__init__.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeCtx:
    def __init__(self) -> None:
        self.hooks: dict[str, object] = {}

    def register_hook(self, name: str, callback) -> None:
        self.hooks[name] = callback


def wired():
    module = load_plugin()
    ctx = FakeCtx()
    module.register(ctx)
    return ctx.hooks


def test_register_wires_both_hooks() -> None:
    hooks = wired()
    assert "pre_tool_call" in hooks, "не подключён pre_tool_call"
    assert "post_tool_call" in hooks, "не подключён post_tool_call"


def test_blocks_after_research() -> None:
    hooks = wired()
    hooks["post_tool_call"](tool_name="web_search", args={}, result="ok", status="ok", session_id="s1")
    result = hooks["pre_tool_call"](tool_name="write_file", args={}, session_id="s1")
    assert isinstance(result, dict) and result.get("action") == "block", f"ожидалась блокировка, получено {result!r}"


def test_record_clears_block() -> None:
    hooks = wired()
    hooks["post_tool_call"](tool_name="web_search", args={}, result="ok", status="ok", session_id="s1")
    hooks["post_tool_call"](
        tool_name="terminal",
        args={"command": "gh issue comment 115 --body-file x.md"},
        result="posted", status="ok", session_id="s1",
    )
    assert hooks["pre_tool_call"](tool_name="write_file", args={}, session_id="s1") is None


def test_failed_record_keeps_block() -> None:
    hooks = wired()
    hooks["post_tool_call"](tool_name="web_search", args={}, result="ok", status="ok", session_id="s1")
    hooks["post_tool_call"](
        tool_name="terminal",
        args={"command": "gh issue comment 115 --body-file x.md"},
        result="boom", status="error", error_type="RuntimeError", session_id="s1",
    )
    assert hooks["pre_tool_call"](tool_name="write_file", args={}, session_id="s1") is not None


def test_sessions_are_isolated() -> None:
    hooks = wired()
    hooks["post_tool_call"](tool_name="web_search", args={}, result="ok", status="ok", session_id="s1")
    assert hooks["pre_tool_call"](tool_name="write_file", args={}, session_id="s2") is None


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
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
