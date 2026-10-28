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


def session_id(explicit: str | None) -> str:
    """Идентичность сессии обязательна.

    Общий fallback здесь опаснее отсутствия проверки: два чата получают одну
    заявку, и проверка считает её своей. Поэтому без явного идентификатора
    скрипт отказывается работать, а не подставляет значение по умолчанию.
    """
    value = explicit or os.environ.get("HERMES_SESSION_ID")
    if not value:
        print(
            "СТОП: не задан идентификатор сессии.\n"
            "Передайте --session <id> или выставьте HERMES_SESSION_ID.\n"
            "Общий fallback запрещён: две сессии получили бы одну заявку "
            "и гейт пропустил бы гонку.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return value


def current_branch() -> str:
    return git("rev-parse", "--abbrev-ref", "HEAD") or "(detached)"


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
    args = ap.parse_args()

    session = session_id(args.session)
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

    # 3. Отставание от origin.
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
