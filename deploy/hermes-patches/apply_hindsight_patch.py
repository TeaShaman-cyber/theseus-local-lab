#!/usr/bin/env python3
"""Apply the Hindsight recall-date patch to the installed plugin, idempotently.

The plugin lives outside this repository (in the Hermes install), so a repo-only
patch file is not enough: after any plugin or Hermes update the change is gone
and nobody notices, because the memory block simply stops showing dates.

This script closes that gap:
  - if the patch is already present, it does nothing (exit 0);
  - otherwise it inserts the helper and rewrites the two render sites;
  - it always writes a timestamped backup next to the file.

Exit codes: 0 = applied or already present, 1 = target text not found (upstream
changed), 2 = plugin file missing.

Usage:
    python deploy/hermes-patches/apply_hindsight_patch.py
    python deploy/hermes-patches/apply_hindsight_patch.py --path <plugin_dir>
    python deploy/hermes-patches/apply_hindsight_patch.py --check
"""
from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import shutil
import sys

DEFAULT_PLUGIN_DIR = pathlib.Path.home() / "AppData/Local/hermes/plugins/hindsight"

MARKER = "def _fmt_recall_line("

HELPER = '''    def _fmt_recall_line(self, r, prefix: str = "- ") -> str:
        """Render one recalled memory with its date, so the reader can tell how old a fact is.

        Hindsight returns occurred_start / occurred_end / mentioned_at, but the block used to
        render only ``r.text`` - a fact from yesterday looked identical to one from three weeks
        ago. Dates are metadata, so this is deterministic: no model call, no server change.
        """
        when = (
            getattr(r, "occurred_start", None)
            or getattr(r, "occurred_end", None)
            or getattr(r, "mentioned_at", None)
        )
        if when:
            return f"{prefix}[{str(when)[:10]}] {r.text}"
        return f"{prefix}{r.text}"

'''

ANCHOR = "    def _do_recall(self, query: str) -> tuple[str, int]:"

OLD_PREFETCH = '            return "\\n".join(f"- {r.text}" for r in results if r.text), len(results)'
NEW_PREFETCH = '            return "\\n".join(self._fmt_recall_line(r) for r in results if r.text), len(results)'

OLD_TOOL = '        return "\\n".join(f"{i}. {r.text}" for i, r in enumerate(results, 1)) or "No relevant memories found."'
NEW_TOOL = '        return "\\n".join(self._fmt_recall_line(r, f"{i}. ") for i, r in enumerate(results, 1)) or "No relevant memories found."'


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--path", type=pathlib.Path, default=DEFAULT_PLUGIN_DIR)
    ap.add_argument("--check", action="store_true", help="report state, never modify")
    args = ap.parse_args()

    target = args.path / "__init__.py"
    if not target.is_file():
        print(f"FAIL: {target} not found")
        return 2

    text = target.read_text(encoding="utf-8")

    if MARKER in text:
        print(f"OK: patch already present in {target}")
        return 0

    if args.check:
        print(f"PENDING: patch not applied in {target}")
        return 1

    if ANCHOR not in text:
        print(f"FAIL: anchor not found ({ANCHOR!r}); upstream changed shape, review manually")
        return 1
    if OLD_PREFETCH not in text or OLD_TOOL not in text:
        print("FAIL: render sites not found; upstream changed shape, review manually")
        return 1

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = target.with_suffix(f".py.bak-{stamp}")
    shutil.copy2(target, backup)

    patched = text.replace(ANCHOR, HELPER + ANCHOR, 1)
    patched = patched.replace(OLD_PREFETCH, NEW_PREFETCH, 1)
    patched = patched.replace(OLD_TOOL, NEW_TOOL, 1)

    target.write_text(patched, encoding="utf-8")
    print(f"APPLIED and verified: {target} (backup: {backup.name})")
    print("Restart the Hermes BACKEND, not just the window: tools run in the python")
    print("backend, which survives a UI restart and keeps the old module in memory.")
    print("A UI-only restart looks exactly like a patch that did not apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
