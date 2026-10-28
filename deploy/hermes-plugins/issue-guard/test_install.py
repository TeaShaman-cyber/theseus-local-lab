"""Тесты установщика: копирует файлы плагина и умеет находить расхождения.

Рантайм — не источник: если копия в плагинах Гермеса разошлась с репозиторием,
это должно быть видно командой `--check`, а не выясняться при отладке.
"""
from __future__ import annotations

import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from install_issue_guard import check, install  # noqa: E402


def test_install_copies_all_files() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        target = pathlib.Path(tmp) / "issue-guard"
        copied = install(target)
        assert set(copied) >= {"__init__.py", "guard.py", "plugin.yaml"}, f"скопировано: {copied}"
        for name in copied:
            assert (target / name).exists(), f"нет файла {name}"


def test_check_is_clean_after_install() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        target = pathlib.Path(tmp) / "issue-guard"
        install(target)
        assert check(target) == [], "сразу после установки расхождений быть не должно"


def test_check_detects_drift() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        target = pathlib.Path(tmp) / "issue-guard"
        install(target)
        (target / "guard.py").write_text("# подменено\n", encoding="utf-8")
        drift = check(target)
        assert "guard.py" in drift, f"расхождение не найдено: {drift}"


def test_check_detects_missing() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        target = pathlib.Path(tmp) / "issue-guard"
        install(target)
        (target / "plugin.yaml").unlink()
        assert "plugin.yaml" in check(target)


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
