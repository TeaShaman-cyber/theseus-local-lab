"""Установка issue-guard в рантайм Гермеса, с проверкой расхождений.

Источник — репозиторий, копия в плагинах Гермеса — производная. `--check` нужен,
чтобы расхождение находилось командой, а не выяснялось при отладке живого агента.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import pathlib
import shutil
import sys

PLUGIN_DIR = pathlib.Path(__file__).resolve().parent

#: Только то, что нужно в рантайме. Тесты в плагин не копируются.
PLUGIN_FILES = ("__init__.py", "guard.py", "plugin.yaml")


def default_target() -> pathlib.Path:
    local = os.environ.get("LOCALAPPDATA")
    base = pathlib.Path(local) if local else pathlib.Path.home() / "AppData" / "Local"
    return base / "hermes" / "plugins" / "issue-guard"


def _digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def install(target: pathlib.Path) -> list[str]:
    """Копирует файлы плагина и возвращает имена скопированных."""
    target.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []
    for name in PLUGIN_FILES:
        source = PLUGIN_DIR / name
        if not source.exists():
            continue
        shutil.copy2(source, target / name)
        copied.append(name)
    return copied


def check(target: pathlib.Path) -> list[str]:
    """Имена файлов, которые отсутствуют в рантайме или отличаются от источника."""
    drift: list[str] = []
    for name in PLUGIN_FILES:
        source = PLUGIN_DIR / name
        if not source.exists():
            continue
        installed = target / name
        if not installed.exists() or _digest(source) != _digest(installed):
            drift.append(name)
    return drift


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Установка плагина issue-guard")
    parser.add_argument("--check", action="store_true", help="только проверить расхождения")
    parser.add_argument("--target", default=None, help="каталог плагина в рантайме")
    args = parser.parse_args(argv)

    target = pathlib.Path(args.target) if args.target else default_target()

    if args.check:
        drift = check(target)
        if drift:
            print(f"РАСХОЖДЕНИЯ в {target}: {', '.join(drift)}")
            return 1
        print(f"OK: {target} совпадает с репозиторием")
        return 0

    copied = install(target)
    print(f"установлено в {target}: {', '.join(copied) if copied else 'ничего'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
