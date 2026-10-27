#!/usr/bin/env python3
"""Worktree lifecycle for parallel agent sessions.

Two sessions sharing one git worktree is a race by construction: a `checkout` in
one changes HEAD for the other, so edits appear to revert, commits land on the
wrong branch, and artifacts reach a commit in their old version. Each session gets
its own worktree instead, and this tool makes sure they do not accumulate.

The registry stores ownership and intent. Existence is never taken from the
registry - it comes from `git worktree list`, because a registry that is trusted
over reality will eventually describe trees that no longer exist. A mismatch is
reported as a finding, not acted on.

Reaping is deliberately conservative: a worktree is removed only when it is
merged or empty, clean, and past its time to live. Anything with uncommitted work,
unpushed commits or an open claim is reported and left alone.

Usage:
    wt.py claim <id> --purpose "text" [--branch name] [--session ref]
    wt.py list
    wt.py release <id> [--remove]
    wt.py reap [--apply]
    wt.py guard
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import subprocess
import sys
import time

TTL_DAYS = 7
ALERT_THRESHOLD = 3
MARKER_NAME = ".worktree-claim.json"


def repo_root() -> pathlib.Path:
    """Main worktree root, whatever worktree this file is executed from."""
    common = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return pathlib.Path(common).parent


ROOT = repo_root()
# Claims are local operational state, not repository content: keeping them in the
# git directory makes them shared by every worktree and immune to branch switches,
# which a committed file inside a worktree is not - each worktree would carry its
# own copy and they would fight on every merge.
GIT_DIR = pathlib.Path(
    subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
                   capture_output=True, text=True, check=True).stdout.strip()
)
REGISTRY = GIT_DIR / "theseus-worktrees.json"
WORKTREES_DIR = ROOT / ".worktrees"


def git(*args: str, cwd: pathlib.Path | None = None) -> str:
    r = subprocess.run(["git", *args], capture_output=True, text=True, cwd=str(cwd or ROOT))
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout


def git_ok(*args: str, cwd: pathlib.Path | None = None) -> bool:
    return subprocess.run(["git", *args], capture_output=True, cwd=str(cwd or ROOT)).returncode == 0


def load_registry() -> dict:
    if not REGISTRY.exists():
        return {"schema_version": 1, "ttl_days": TTL_DAYS, "claims": []}
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def save_registry(data: dict) -> None:
    REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def worktrees() -> list[dict]:
    out = git("worktree", "list", "--porcelain")
    trees, cur = [], {}
    for line in out.splitlines():
        if line.startswith("worktree "):
            if cur:
                trees.append(cur)
            cur = {"path": line[len("worktree "):]}
        elif line.startswith("branch "):
            cur["branch"] = line[len("branch "):].replace("refs/heads/", "")
        elif line == "detached":
            cur["branch"] = None
        elif line.startswith("HEAD "):
            cur["head"] = line[len("HEAD "):]
    if cur:
        trees.append(cur)
    return trees


def is_main_tree(path: pathlib.Path) -> bool:
    return path.resolve() == ROOT.resolve()


def branch_stats(branch: str | None) -> dict:
    if not branch:
        return {"ahead": 0, "behind": 0, "merged": False, "commits": 0, "last_ts": 0, "unpushed": 0}
    ahead = int(git("rev-list", "--count", f"main..{branch}").strip() or 0)
    behind = int(git("rev-list", "--count", f"{branch}..main").strip() or 0)
    merged = git_ok("merge-base", "--is-ancestor", branch, "main")
    commits = int(git("rev-list", "--count", branch).strip() or 0)
    last_ts = int(git("log", "-1", "--format=%ct", branch).strip() or 0)
    unpushed = 0
    if git_ok("rev-parse", "--verify", f"origin/{branch}"):
        unpushed = int(git("rev-list", "--count", f"origin/{branch}..{branch}").strip() or 0)
    else:
        unpushed = ahead
    return {"ahead": ahead, "behind": behind, "merged": merged, "commits": commits,
            "last_ts": last_ts, "unpushed": unpushed}


def is_dirty(path: pathlib.Path) -> bool:
    return bool(git("status", "--porcelain", cwd=path).strip())


def claim_of(data: dict, wid: str) -> dict | None:
    for c in data["claims"]:
        if c["id"] == wid and c.get("status") == "active":
            return c
    return None


def cmd_claim(args) -> int:
    data = load_registry()
    if claim_of(data, args.id):
        print(f"REFUSED: '{args.id}' is already claimed and active")
        return 1

    path = WORKTREES_DIR / args.id
    branch = args.branch or f"feat/{args.id}"
    if path.exists():
        print(f"REFUSED: {path} already exists on disk")
        return 1
    if git_ok("rev-parse", "--verify", branch):
        print(f"REFUSED: branch {branch} already exists")
        return 1

    path.parent.mkdir(parents=True, exist_ok=True)
    git("worktree", "add", str(path), "-b", branch)
    marker = {
        "id": args.id,
        "branch": branch,
        "session": args.session or "",
        "owner": args.owner or "",
        "purpose": args.purpose,
        "created": dt.datetime.now().isoformat(timespec="seconds"),
    }
    (path / MARKER_NAME).write_text(json.dumps(marker, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    data["claims"].append({**marker, "path": str(path), "status": "active"})
    save_registry(data)
    print(f"CLAIMED {args.id}: {path} on {branch}")
    return 0


def cmd_list(args) -> int:
    data = load_registry()
    claims = {c["id"]: c for c in data["claims"]}
    now = time.time()
    rows = []
    for t in worktrees():
        path = pathlib.Path(t["path"])
        if is_main_tree(path):
            continue
        st = branch_stats(t.get("branch"))
        age = int((now - st["last_ts"]) / 86400) if st["last_ts"] else None
        owner = ""
        for c in claims.values():
            if c.get("path") and pathlib.Path(c["path"]).resolve() == path.resolve():
                owner = f"{c['id']}[{c['status']}]"
                break
        rows.append({
            "id": owner or "unregistered",
            "branch": t.get("branch") or "detached",
            "ahead": st["ahead"],
            "behind": st["behind"],
            "dirty": is_dirty(path),
            "unpushed": st["unpushed"],
            "age_days": age,
        })
    if not rows:
        print("нет дополнительных деревьев")
        return 0
    print(f"{'id':22} {'branch':34} {'ahead':>5} {'behind':>6} {'dirty':>5} {'unpushed':>8} {'age':>4}")
    for r in rows:
        print(f"{r['id']:22} {r['branch']:34} {r['ahead']:>5} {r['behind']:>6} "
              f"{str(r['dirty']):>5} {r['unpushed']:>8} {str(r['age_days']):>4}")
    return 0


def cmd_release(args) -> int:
    data = load_registry()
    c = claim_of(data, args.id)
    if not c:
        print(f"REFUSED: no active claim '{args.id}'")
        return 1
    path = pathlib.Path(c["path"])
    if args.remove:
        if is_dirty(path):
            print(f"REFUSED: {path} has uncommitted changes")
            return 1
        git("worktree", "remove", str(path))
        print(f"removed worktree {path}")
    c["status"] = "closed"
    c["closed"] = dt.datetime.now().isoformat(timespec="seconds")
    save_registry(data)
    print(f"released {args.id}")
    return 0


def reap_candidates(data: dict) -> tuple[list[dict], list[dict]]:
    """Return (removable, kept-with-reason)."""
    now = time.time()
    claims = {c["id"]: c for c in data["claims"]}
    removable, kept = [], []
    for t in worktrees():
        path = pathlib.Path(t["path"])
        if is_main_tree(path):
            continue
        st = branch_stats(t.get("branch"))
        claim = None
        for c in claims.values():
            if c.get("path") and pathlib.Path(c["path"]).resolve() == path.resolve():
                claim = c
                break
        created = 0.0
        if claim:
            try:
                created = dt.datetime.fromisoformat(claim["created"]).timestamp()
            except Exception:
                created = 0.0
        age_days = (now - max(st["last_ts"], created)) / 86400 if (st["last_ts"] or created) else 0
        entry = {"path": str(path), "branch": t.get("branch"), "ahead": st["ahead"],
                 "age_days": round(age_days, 1)}
        if claim and claim.get("status") == "active":
            kept.append({**entry, "reason": "active claim"})
        elif is_dirty(path):
            kept.append({**entry, "reason": "uncommitted changes"})
        elif st["unpushed"] > 0:
            kept.append({**entry, "reason": "unpushed commits"})
        elif not (st["merged"] or st["ahead"] == 0):
            kept.append({**entry, "reason": "not merged and has commits"})
        elif age_days < data.get("ttl_days", TTL_DAYS):
            kept.append({**entry, "reason": f"younger than TTL ({age_days:.1f}d)"})
        else:
            removable.append(entry)
    return removable, kept


def cmd_reap(args) -> int:
    data = load_registry()
    removable, kept = reap_candidates(data)
    for e in removable:
        print(f"REAP {e['path']}  branch={e['branch']}  ahead={e['ahead']}  age={e['age_days']}d")
        if args.apply:
            git("worktree", "remove", e["path"])
            for c in data["claims"]:
                if c.get("path") and pathlib.Path(c["path"]).resolve() == pathlib.Path(e["path"]).resolve():
                    c["status"] = "closed"
            print(f"  removed")
    for e in kept:
        print(f"KEEP {e['path']}  branch={e['branch']}  reason={e['reason']}")
    save_registry(data) if args.apply else None
    print(f"\nremovable={len(removable)} kept={len(kept)} threshold={ALERT_THRESHOLD}")
    if len(removable) >= ALERT_THRESHOLD:
        print(f"ALERT: {len(removable)} stale worktrees is at or above the threshold")
    return 0


def cmd_guard(args) -> int:
    """Fail when the current worktree's branch is not the one it claimed."""
    cwd = pathlib.Path.cwd()
    marker = cwd / MARKER_NAME
    if not marker.exists():
        return 0  # main worktree or an unclaimed tree: nothing to enforce
    claimed = json.loads(marker.read_text(encoding="utf-8"))
    current = git("rev-parse", "--abbrev-ref", "HEAD", cwd=cwd).strip()
    if claimed.get("branch") and current != claimed["branch"]:
        print(f"COMMIT REFUSED: this worktree claimed '{claimed['branch']}' but HEAD is '{current}'.")
        print("Another session probably switched branches here. Run: git checkout "
              f"{claimed['branch']}")
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("claim", help="create and register a worktree")
    p.add_argument("id")
    p.add_argument("--purpose", required=True)
    p.add_argument("--branch")
    p.add_argument("--session", default="")
    p.add_argument("--owner", default="")
    p.set_defaults(func=cmd_claim)

    p = sub.add_parser("list", help="show every worktree with state")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("release", help="close a claim, optionally removing the tree")
    p.add_argument("id")
    p.add_argument("--remove", action="store_true")
    p.set_defaults(func=cmd_release)

    p = sub.add_parser("reap", help="report or remove eligible worktrees")
    p.add_argument("--apply", action="store_true", help="actually remove (default: dry run)")
    p.set_defaults(func=cmd_reap)

    p = sub.add_parser("guard", help="refuse a commit from the wrong branch")
    p.set_defaults(func=cmd_guard)

    args = ap.parse_args()
    try:
        return args.func(args)
    except RuntimeError as e:
        print(f"FAIL: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
