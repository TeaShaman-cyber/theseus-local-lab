#!/usr/bin/env python3
"""Reproduce the registry race: two concurrent claims must both survive.

The tool exists to stop sessions from colliding on a worktree. If its own
bookkeeping collides, a claim is silently lost and the tree it describes becomes
unprotected - `reap` sees an unregistered worktree and may remove live work.

This test fails on the pre-lock implementation and passes once the registry
read-modify-write is serialised.

Run:
    python tools/worktree_lifecycle/test_concurrent_claim.py
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile

WT = pathlib.Path(__file__).with_name("wt.py")


def sh(cwd: pathlib.Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(*[list(args)], cwd=str(cwd), capture_output=True, text=True)


def git(cwd: pathlib.Path, *args: str) -> str:
    r = subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def main() -> int:
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="wt-race-"))
    repo = tmp / "repo"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main", ".")
    (repo / "README.md").write_text("x\n", encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base")
    (repo / ".gitignore").write_text(".worktrees/\n", encoding="utf-8")

    # Two claims launched together, exactly the case a second session creates.
    procs = []
    for wid in ("alpha", "beta"):
        procs.append(subprocess.Popen(
            [sys.executable, str(WT), "claim", wid, "--purpose", f"{wid} work"],
            cwd=str(repo), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        ))
    outs = [(p.communicate()[0].strip(), p.returncode) for p in procs]
    for out, code in outs:
        print(f"  claim -> {code}: {out.splitlines()[0] if out else ''}")

    reg = repo / ".git" / "theseus-worktrees.json"
    if not reg.exists():
        print("FAIL: no registry written")
        return 1
    claims = json.loads(reg.read_text(encoding="utf-8"))["claims"]
    ids = sorted(c["id"] for c in claims if c.get("status") == "active")
    print(f"  active claims in registry: {ids}")

    trees = [l.split()[-1] for l in git(repo, "worktree", "list", "--porcelain").splitlines()
             if l.startswith("worktree ")]
    trees = [t for t in trees if ".worktrees" in t]
    print(f"  worktrees on disk: {len(trees)}")

    if len(trees) == 2 and ids == ["alpha", "beta"]:
        print("PASS: both claims survived and both trees are registered")
        return 0
    print(f"FAIL: {len(trees)} trees but claims {ids} - a claim was lost")
    return 1


if __name__ == "__main__":
    sys.exit(main())
