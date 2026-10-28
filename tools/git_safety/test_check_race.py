#!/usr/bin/env python3
"""Негативный контроль для tools/git_safety/check_race.py.

Гейт решает, можно ли коммитить, и до сих пор не был проверен ни одним тестом:
оба известных дефекта (идентичность сессии до проверки checkout, чужой id в
причине) нашло ревью, а не прогон. Здесь фиксируется наблюдаемое поведение,
снятое с работающего гейта, а не предполагаемое.

Что проверяется:

1. общий checkout без заявки — СТОП, потому что дерево делят несколько чатов;
2. своя заявка плюс --allow-shared — проходит;
3. живая заявка другой сессии плюс --allow-shared — СТОП с именем чужой сессии.

Третий пункт и есть смысл гейта: без него два чата молча считают дерево своим.

Запуск:
    python tools/git_safety/test_check_race.py
"""
from __future__ import annotations

import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

CHECK = pathlib.Path(__file__).with_name("check_race.py")


def git(cwd: pathlib.Path, *args: str) -> None:
    subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=str(cwd), check=True, capture_output=True, text=True,
    )


def run_gate(repo: pathlib.Path, session: str, *extra: str) -> tuple[int, str]:
    env = dict(os.environ)
    env["HERMES_SESSION_ID"] = session
    proc = subprocess.run(
        [sys.executable, str(CHECK), *extra],
        cwd=str(repo), env=env, capture_output=True, text=True,
    )
    return proc.returncode, f"{proc.stdout}{proc.stderr}"


def main() -> int:
    failures: list[str] = []
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="race-test-"))
    repo = tmp / "repo"

    try:
        repo.mkdir()
        git(repo, "init", "-q", "-b", "main", ".")
        (repo / "README.md").write_text("x\n", encoding="utf-8")
        git(repo, "add", "-A")
        git(repo, "commit", "-qm", "base")

        # 1. Общий checkout без заявки: гейт обязан отказать.
        code, out = run_gate(repo, "ses-alpha")
        if code == 0:
            failures.append("общий checkout без заявки прошёл, а должен блокироваться")
        elif "общий checkout" not in out:
            failures.append(f"отказ есть, но причина не названа: {out.strip()[:120]}")

        # 2. Своя заявка: проходим, иначе гейт мешает собственной работе.
        run_gate(repo, "ses-alpha", "--claim")
        code, out = run_gate(repo, "ses-alpha", "--allow-shared")
        if code != 0:
            failures.append(f"своя заявка не прошла: {out.strip()[:120]}")

        # 3. Чужая живая заявка: СТОП, и в причине именно чужая сессия.
        code, out = run_gate(repo, "ses-beta", "--allow-shared")
        if code == 0:
            failures.append("вторая сессия прошла на занятом дереве")
        elif "ses-alpha" not in out:
            failures.append(f"отказ есть, но чужая сессия не названа: {out.strip()[:120]}")

        if failures:
            for item in failures:
                print(f"FAIL: {item}")
            return 1

        print("RACE_GATE_OK: общий checkout блокируется, своя заявка проходит, чужая называется")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
