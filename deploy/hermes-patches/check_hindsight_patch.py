#!/usr/bin/env python3
"""Check whether the local Hindsight recall-date patch is still applied.

Why this exists: the patch lives in an installed Hermes plugin, not in a package we
control. A Hermes or plugin update silently overwrites `__init__.py`, and the dates
disappear from the memory block without any error. This script turns that silent
regression into a loud one.

Exit codes: 0 = patch present, 1 = patch missing (plugin was replaced), 2 = plugin dir absent.

Usage:
    python deploy/hermes-patches/check_hindsight_patch.py
    python deploy/hermes-patches/check_hindsight_patch.py --path <plugin_dir>
"""
from __future__ import annotations

import argparse
import pathlib
import sys

DEFAULT_PLUGIN_DIR = pathlib.Path.home() / "AppData/Local/hermes/plugins/hindsight"

# The patch is "present" when all three markers exist: the helper and both call sites.
MARKERS = (
    "def _fmt_recall_line(",
    "self._fmt_recall_line(r) for r in results if r.text",
    'self._fmt_recall_line(r, f"{i}. ")',
)


def check(plugin_dir: pathlib.Path) -> int:
    target = plugin_dir / "__init__.py"
    if not target.is_file():
        print(f"FAIL: {target} not found")
        return 2

    text = target.read_text(encoding="utf-8", errors="replace")
    missing = [m for m in MARKERS if m not in text]

    if missing:
        print(f"FAIL: recall-date patch is NOT applied in {target}")
        for m in missing:
            print(f"  missing marker: {m}")
        print("The plugin was probably updated. Re-apply deploy/hermes-patches/hindsight-recall-dates.patch.")
        return 1

    version = "?"
    manifest = plugin_dir / "plugin.yaml"
    if manifest.is_file():
        for line in manifest.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("version:"):
                version = line.split(":", 1)[1].strip()
                break

    print(f"OK: recall-date patch present in {target} (plugin version {version})")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", type=pathlib.Path, default=DEFAULT_PLUGIN_DIR,
                        help="plugin directory (default: the Hermes install)")
    return check(parser.parse_args().path)


if __name__ == "__main__":
    sys.exit(main())
