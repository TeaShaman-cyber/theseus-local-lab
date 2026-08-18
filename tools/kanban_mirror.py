#!/usr/bin/env python3
"""
kanban_mirror.py — one-way mirror GTD + sagtask -> Hermes Kanban.

Purpose:
  Give a single human-readable Kanban surface over the three task backends
  we actually use:
    - GTD     : docker volume `theseus-gtd-clean:/data/gtd.toml`
    - sagtask : ~/.hermes/sag_tasks/<id>/.sag_task_state.json
    - Kanban  : ~/.hermes/kanban.db  (via `hermes kanban` CLI)

Design rules (see federation-kanban-mirror GTD task):
  - Kanban is the READ surface, NOT a source of truth. Never writes back.
  - Idempotent: a local map file remembers source_id -> kanban_id so re-runs
    update cards instead of duplicating them.
  - Only the `federation-plugin` GTD project is mirrored by default (--all to
    mirror everything). sagtask tasks are mirrored only if they exist.
  - Dry-run by default. Pass --apply to actually create/update Kanban cards.

Usage:
  python tools/kanban_mirror.py            # dry-run, prints plan
  python tools/kanban_mirror.py --apply    # create/update cards
  python tools/kanban_mirror.py --all      # mirror all GTD projects, not just federation-plugin
  python tools/kanban_mirror.py --board mirror   # target a custom board
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERMES_HOME = Path(os.environ.get("HERMES_HOME", r"C:\Users\s.poklad\AppData\Local\hermes"))
GTD_VOLUME = "theseus-gtd-clean"
GTD_IMAGE = "gtd-gtd:latest"
SAGTASK_ROOT = HERMES_HOME / "sag_tasks"
MAP_FILE = HERMES_HOME / "kanban-mirror-map.json"
TARGET_BOARD = "default"

# GTD status -> Kanban column
GTD_STATUS_MAP = {
    "project": "ready",
    "next_action": "todo",
    "waiting_for": "blocked",
    "later": "todo",
    "calendar": "todo",
    "someday": "todo",
    "reference": "todo",
    "done": "archived",
    "trash": "archived",
    "inbox": "triage",
    "context": "todo",
}


def run(cmd: list[str], capture: bool = True) -> str:
    res = subprocess.run(cmd, capture_output=capture, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"cmd failed {cmd}: {res.stderr.strip()}")
    return res.stdout


def read_gtd_toml() -> str:
    # gtd-mcp binary only accepts `gtd-mcp <FILE>`; override entrypoint to cat.
    return run([
        "docker.exe", "run", "--rm", "--entrypoint", "cat",
        "-v", f"{GTD_VOLUME}:/data", GTD_IMAGE, "/data/gtd.toml",
    ])


def parse_gtd(toml_text: str) -> list[dict]:
    """Minimal TOML parser for the gtd subset we need (no external dep)."""
    items: list[dict] = []
    current: dict | None = None
    for raw in toml_text.splitlines():
        line = raw.strip()
        if line.startswith("[[") and line.endswith("]]"):
            if current:
                items.append(current)
            current = {}
            continue
        if current is None:
            continue
        if "=" not in line or line.startswith("#"):
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"')
        # arrays like project = "x" are single strings here; handle comma lists
        if key in ("project", "context") and val:
            current.setdefault(key, val)
        else:
            current[key] = val
    if current:
        items.append(current)
    return items


def read_sagtask_tasks() -> list[dict]:
    tasks: list[dict] = []
    if not SAGTASK_ROOT.exists():
        return tasks
    for state_file in SAGTASK_ROOT.glob("*/.sag_task_state.json"):
        try:
            data = json.loads(state_file.read_text(encoding="utf-8"))
            tasks.append(data)
        except Exception as e:
            print(f"  [warn] failed reading {state_file}: {e}", file=sys.stderr)
    return tasks


def load_map() -> dict:
    if MAP_FILE.exists():
        try:
            return json.loads(MAP_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_map(m: dict) -> None:
    MAP_FILE.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")


def kanban_create(title: str, body: str, status: str, priority: int) -> str:
    cmd = ["hermes", "kanban", "create", title, "--body", body,
           "--priority", str(priority)]
    if status == "triage":
        cmd += ["--triage"]
    elif status in ("blocked", "running"):
        cmd += ["--initial-status", status]
    # todo/ready/done/archived fall out of defaults or are set later via edit
    out = run(cmd + ["--json"])
    # Output is a pretty-printed JSON object; extract id via regex over full text.
    m = re.search(r'"id"\s*:\s*"([^"]+)"', out)
    if not m:
        raise RuntimeError(f"no id from kanban create: {out}")
    return m.group(1)


def kanban_link(parent: str, child: str) -> None:
    run(["hermes", "kanban", "link", parent, child])


def kanban_statuses() -> dict:
    """Return {kanban_id: status} for all non-archived cards (one batched call)."""
    out = run(["hermes", "kanban", "list", "--json"])
    try:
        items = json.loads(out)
    except Exception:
        return {}
    return {it.get("id"): it.get("status") for it in items if it.get("id")}


def kanban_transition(kid: str, target: str, current: str) -> None:
    """Move a card toward `target` Kanban status from `current` without clobbering
    agent-set running/blocked states unless the source explicitly demands it."""
    if current == target:
        return
    # Protect agent/human-set in-flight states: only override on terminal source.
    if current in ("running", "blocked") and target not in ("done", "archived"):
        print(f"  [skip-status] {kid}: source {current} preserved (not clobbering agent work)")
        return
    if target == "done":
        # In Kanban, a closed source task leaves the active board via archive
        # (complete needs running state + cleared parent deps; archive is safe
        # from any state and preserves history). Mirror is a read-surface.
        run(["hermes", "kanban", "archive", kid])
    elif target == "blocked":
        run(["hermes", "kanban", "block", kid, "mirrored: GTD waiting/blocked"])
    elif target == "archived":
        run(["hermes", "kanban", "archive", kid])
    # ready/triage transitions: leave as-is (dispatcher promotes); no-op here


def kanban_archive(kid: str) -> None:
    run(["hermes", "kanban", "archive", kid])


def kanban_edit(kid: str, title: str, body: str, status: str) -> None:
    run(["hermes", "kanban", "edit", kid, "--title", title, "--body", body])
    # status transitions: complete / block / promote handled separately if needed
    if status == "done":
        run(["hermes", "kanban", "complete", kid])
    elif status == "blocked":
        run(["hermes", "kanban", "block", kid, "mirrored blocked"])


def kanban_find_by_title(title: str) -> str | None:
    """Return existing kanban id for a card title, or None."""
    out = run(["hermes", "kanban", "list", "--json"])
    try:
        items = json.loads(out)
    except Exception:
        return None
    for it in items:
        if it.get("title") == title:
            return it.get("id")
    return None


def sync(apply: bool, only_federation: bool, board: str) -> None:
    if board != "default":
        run(["hermes", "kanban", "boards", "switch", board])
    else:
        run(["hermes", "kanban", "boards", "switch", "default"])

    gtd_text = read_gtd_toml()
    gtd_items = parse_gtd(gtd_text)
    sag_tasks = read_sagtask_tasks()
    state_map = load_map()
    # Batched read of current Kanban statuses (one call, not per-card).
    statuses = kanban_statuses() if apply else {}

    # ---- Build plan ----
    plan: list[dict] = []
    gtd_by_id: dict[str, dict] = {}

    for it in gtd_items:
        sid = it.get("id")
        st = it.get("status", "inbox")
        proj = it.get("project")
        if not sid:
            continue
        gtd_by_id[sid] = it
        # Filter: federation only, or everything
        if only_federation:
            if st == "project":
                # only the federation-plugin project itself, not other projects
                if sid != "federation-plugin":
                    continue
            else:
                # a task is in scope only if it belongs to federation-plugin
                if proj != "federation-plugin":
                    continue
        kstatus = GTD_STATUS_MAP.get(st, "todo")
        plan.append({
            "source": "gtd", "source_id": sid, "title": it.get("title", sid),
            "body": f"Source: GTD [{st}]\n\n{it.get('notes','')}",
            "status": kstatus, "priority": 2, "parent_source": proj,
        })

    for st in sag_tasks:
        sid = st.get("sag_task_id") or st.get("name")
        if not sid:
            continue
        if not sid.startswith("sagtask:"):
            sid = f"sagtask:{sid}"
        # epic = the sagtask itself
        epic_id = sid
        plan.append({
            "source": "sagtask", "source_id": epic_id, "title": st.get("name", sid),
            "body": f"Source: sagtask\nStatus: {st.get('status')}\n"
                    f"Phase: {st.get('current_phase_id')} / Step: {st.get('current_step_id')}",
            "status": "ready", "priority": 1, "parent_source": None,
        })
        # phases -> child cards (parent = epic)
        for ph in st.get("phases", []):
            ph_id = ph.get("id")
            if not ph_id:
                continue
            plan.append({
                "source": "sagtask", "source_id": f"{sid}:phase:{ph_id}",
                "title": f"[phase] {ph.get('name', ph_id)}",
                "body": f"Source: sagtask phase\nGate: {ph.get('gate', {}).get('question', 'none')}",
                "status": "todo", "priority": 2, "parent_source": epic_id,
            })
            # steps -> grandchild cards (parent = phase)
            for step in ph.get("steps", []):
                step_id = step.get("id")
                if not step_id:
                    continue
                plan.append({
                    "source": "sagtask", "source_id": f"{sid}:phase:{ph_id}:step:{step_id}",
                    "title": f"[step] {step.get('name', step_id)}",
                    "body": f"Source: sagtask step\nVerification: {step.get('verification', {}).get('commands', [])}",
                    "status": "todo", "priority": 3, "parent_source": f"{sid}:phase:{ph_id}",
                })

    # sort: projects first so their kanban id lands in map before children
    plan.sort(key=lambda p: (0 if p["status"] == "ready" and p["source_id"].endswith("-plugin") or p.get("parent_source") is None and p["source"]=="gtd" and p["source_id"]=="federation-plugin" else 1, p["source_id"]))

    # ---- Resolve parents (only those already in plan) ----
    id_to_kid: dict[str, str] = {k: v for k, v in state_map.items()}
    for p in plan:
        p["parent_kid"] = id_to_kid.get(p["parent_source"]) if p.get("parent_source") else None

    # ---- Execute ----
    print(f"Plan: {len(plan)} card(s) to mirror"
          f" ({sum(1 for p in plan if p['source']=='gtd')} GTD,"
          f" {sum(1 for p in plan if p['source']=='sagtask')} sagtask)")
    dirty = False
    links: list[tuple[str, str]] = []  # (parent_source_id, child_source_id)
    for p in plan:
        key = f"{p['source']}:{p['source_id']}"
        existing = state_map.get(key)
        if existing:
            # Card already mirrored. Sync status if the source changed.
            cur = statuses.get(existing)
            if apply and cur is not None and p["status"] != cur:
                kanban_transition(existing, p["status"], cur)
                print(f"  [status-sync] {key} -> {p['status']} (was {cur})")
            else:
                print(f"  [skip exists] {key} -> {existing} (already mirrored)")
            continue
        # guard against duplicates if map is stale/missing
        dup = kanban_find_by_title(p["title"]) if apply else None
        if dup:
            print(f"  [skip dup] {key} already in kanban as {dup}")
            state_map[key] = dup
            id_to_kid[p["source_id"]] = dup
            dirty = True
            continue
        print(f"  [create] {key} ({p['status']})")
        if apply:
            kid = kanban_create(p["title"], p["body"], p["status"], p["priority"])
            state_map[key] = kid
            id_to_kid[p["source_id"]] = kid
            dirty = True
            # queue parent link if this task belongs to a mirrored project
            if p.get("parent_source") and p["parent_source"] in id_to_kid:
                links.append((id_to_kid[p["parent_source"]], kid))
    # apply parent links (project epic -> child tasks)
    for parent_kid, child_kid in links:
        if apply:
            try:
                kanban_link(parent_kid, child_kid)
                print(f"  [link] {parent_kid} -> {child_kid}")
            except Exception as e:
                print(f"  [link-warn] {parent_kid}->{child_kid}: {e}", file=sys.stderr)
    # archive cards whose source no longer exists (deleted in GTD/sagtask)
    live_keys = {f"{p['source']}:{p['source_id']}" for p in plan}
    for key, kid in list(state_map.items()):
        if key not in live_keys:
            if apply:
                try:
                    kanban_archive(kid)
                    print(f"  [archive] {key} -> {kid} (source removed)")
                except Exception as e:
                    print(f"  [archive-warn] {key}: {e}", file=sys.stderr)
            else:
                print(f"  [would-archive] {key} -> {kid} (source removed)")
            del state_map[key]
            dirty = True
    if apply and dirty:
        save_map(state_map)
        print(f"  map saved -> {MAP_FILE}")
    elif not apply:
        print("\nDRY-RUN only. Re-run with --apply to create/update Kanban cards.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Mirror GTD + sagtask into Hermes Kanban")
    ap.add_argument("--apply", action="store_true", help="actually write to Kanban (default: dry-run)")
    ap.add_argument("--all", action="store_true", help="mirror all GTD projects, not just federation-plugin")
    ap.add_argument("--board", default="default", help="target kanban board slug")
    args = ap.parse_args()
    sync(apply=args.apply, only_federation=not args.all, board=args.board)


if __name__ == "__main__":
    main()
