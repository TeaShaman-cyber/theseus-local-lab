"""Гейт против гонки между сессиями в одном рабочем дереве.

Зачем: два чата работают в одном checkout. Второй может переключить ветку или
занять файлы, пока первый коммитит. Итог — коммит не туда, потерянная правка,
или «конфликт», которого никто не создавал.

Что проверяется:
  1. ветка, на которой реально стоит дерево, против той, что заявлена сессией;
  2. живые заявки других сессий на это же дерево (heartbeat моложе TTL);
  3. отставание от origin: чужие коммиты, которых нет в текущей ветке;
  4. дрейф грязного дерева: файлы, изменившиеся после заявки.

Использование:
    python tools/git_safety/check_race.py --claim      # занять дерево под сессию
    python tools/git_safety/check_race.py              # проверить перед коммитом
    python tools/git_safety/check_race.py --release    # освободить

Коды: 0 — можно работать, 1 — стоп (гонка или устаревшая база).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TTL_SECONDS = 45 * 60  # заявка без heartbeat дольше этого считается брошенной


def claims_dir() -> Path:
    """Каталог заявок внутри настоящего git-каталога.

    В worktree `.git` — это файл-указатель, поэтому путь нельзя собирать как
    ROOT/".git"/...: там каталога нет, и заявки молча не создавались бы.
    """
    git_dir = git("rev-parse", "--absolute-git-dir") or str(ROOT / ".git")
    return Path(git_dir) / "hermes-claims"


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=False
    ).stdout.strip()


def resolve_session(explicit: str | None, shared: bool) -> str:
    """Идентичность нужна только там, где возможна гонка.

    В общем checkout несколько чатов делят одно дерево, и без явной идентичности
    заявки сливаются — там отказ обязателен. В отдельном worktree дерево
    принадлежит одной ветке, гонки быть не может, и требовать переменную
    окружения от человека, коммитящего из VS Code или Git GUI, нельзя: он
    получает СТОП и не знает выхода. Это же обещает `.githooks/README.md`.
    """
    value = explicit or os.environ.get("HERMES_SESSION_ID")
    if value:
        return value
    if shared:
        print(
            "СТОП: не задан идентификатор сессии.\n"
            "Передайте --session <id> или выставьте HERMES_SESSION_ID.\n"
            "В общем checkout общий fallback запрещён: две сессии получили бы "
            "одну заявку и гейт пропустил бы гонку.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    # Локальная идентичность по пути worktree: уникальна, ни с кем не делится.
    git_dir = git("rev-parse", "--absolute-git-dir")
    return f"worktree:{Path(git_dir).name}" if git_dir else "worktree:unknown"


def current_branch() -> str:
    return git("rev-parse", "--abbrev-ref", "HEAD") or "(detached)"


def is_shared_checkout() -> bool:
    """Главный checkout против отдельного worktree.

    В главном `.git` — каталог; в worktree — файл-указатель. Именно главный
    checkout делят между собой несколько чатов, поэтому работа в нём и создаёт
    гонку.
    """
    return (ROOT / ".git").is_dir()


def index_lock_present() -> bool:
    """Чужая git-операция прямо сейчас: lock держится во время записи индекса."""
    git_dir = git("rev-parse", "--absolute-git-dir")
    return bool(git_dir) and (Path(git_dir) / "index.lock").exists()


def head_moved_seconds_ago() -> float | None:
    """Сколько секунд назад двигался HEAD. Свежее движение без заявки — чужое."""
    stamp = git("reflog", "-1", "--date=unix", "--format=%cd", "HEAD")
    try:
        return max(0.0, time.time() - float(stamp))
    except (TypeError, ValueError):
        return None


def dirty_files() -> list[str]:
    out = git("status", "--porcelain")
    return sorted(line[3:] for line in out.splitlines() if line.strip())


def load_claims() -> dict[str, dict]:
    directory = claims_dir()
    if not directory.is_dir():
        return {}
    claims = {}
    for path in directory.glob("*.json"):
        try:
            claims[path.stem] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
    return claims


def write_claim(session: str, branch: str, files: list[str]) -> None:
    directory = claims_dir()
    directory.mkdir(parents=True, exist_ok=True)
    payload = {
        "session": session,
        "branch": branch,
        "claimed_at": time.time(),
        "heartbeat": time.time(),
        "dirty": files,
    }
    (directory / f"{session.replace('/', '_')}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--claim", action="store_true")
    ap.add_argument("--release", action="store_true")
    ap.add_argument("--session", default=None)
    ap.add_argument("--allow-shared", action="store_true",
                    help="разрешить работу в общем checkout (по умолчанию гейт против)")
    args = ap.parse_args()

    shared = is_shared_checkout()
    session = resolve_session(args.session, shared)
    branch = current_branch()
    key = session.replace("/", "_")

    if args.release:
        target = claims_dir() / f"{key}.json"
        if target.exists():
            target.unlink()
            print(f"заявка снята: {session}")
        return 0

    if args.claim:
        write_claim(session, branch, dirty_files())
        print(f"дерево занято: {session} на ветке {branch}")
        return 0

    problems: list[str] = []
    notes: list[str] = []
    claims = load_claims()
    mine = claims.get(key)

    # 1. Ветка не та, что заявлена.
    if mine and mine.get("branch") != branch:
        problems.append(
            f"дерево стоит на ветке {branch}, а заявка сессии — на {mine.get('branch')}. "
            "Кто-то переключил ветку в общем checkout."
        )

    # 2. Живые чужие заявки.
    now = time.time()
    for other_key, claim in claims.items():
        if other_key == key:
            continue
        age = now - float(claim.get("heartbeat") or claim.get("claimed_at") or 0)
        if age <= TTL_SECONDS:
            problems.append(
                f"живая заявка другой сессии: {claim.get('session')} на ветке "
                f"{claim.get('branch')} (heartbeat {int(age)} с назад)"
            )
        else:
            notes.append(f"брошенная заявка: {claim.get('session')} (возраст {int(age)} с)")

    # 3. Некооперативные сигналы: не требуют, чтобы другие чаты что-то писали.
    if shared and not args.allow_shared:
        problems.append(
            "это общий checkout, его делят несколько чатов. Работайте в своём "
            "worktree (git worktree add <путь> <ветка>) или повторите с --allow-shared"
        )
    if index_lock_present():
        problems.append("держится index.lock: прямо сейчас идёт чужая git-операция")
    moved = head_moved_seconds_ago()
    if mine is None and moved is not None and moved < 300:
        notes.append(
            f"HEAD двигался {int(moved)} с назад, а заявки у сессии нет — "
            "возможно, в дереве работает кто-то ещё"
        )

    # 4. Отставание от origin.
    git("fetch", "-q", "origin")
    behind = git("log", "--oneline", f"HEAD..origin/{branch}")
    if behind:
        problems.append(
            f"origin/{branch} ушёл вперёд на {len(behind.splitlines())} коммит(ов): "
            + "; ".join(behind.splitlines()[:3])
        )

    # 4. Дрейф грязного дерева относительно заявки.
    if mine:
        recorded = set(mine.get("dirty") or [])
        now_dirty = set(dirty_files())
        appeared = sorted(now_dirty - recorded)
        if appeared:
            notes.append(
                f"появились изменения, которых не было при заявке: {', '.join(appeared[:5])}"
            )

    print(f"ветка: {branch}   сессия: {session}")
    for note in notes:
        print(f"  замечание: {note}")
    if problems:
        print("\nСТОП:")
        for problem in problems:
            print(f"  - {problem}")
        print("\nДействия: снять чужую ветку с обсуждения, перезанять дерево "
              "(--claim) или перейти в отдельный worktree.")
        return 1

    print("гонки не видно: ветка своя, живых чужих заявок нет, от origin не отстаём")
    # Продление заявки: успешная проверка значит, что владелец ещё работает.
    # Обновляется только heartbeat — ветка и базовый список файлов не сбрасываются.
    if mine:
        mine["heartbeat"] = time.time()
        (claims_dir() / f"{key}.json").write_text(
            json.dumps(mine, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
