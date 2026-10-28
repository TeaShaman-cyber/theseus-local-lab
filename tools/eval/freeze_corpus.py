"""Заморозка корпуса для оценки: тексты, метаданные и манифест.

Зачем: снимок из идентификаторов и хешей не позволяет повторить прогон — тексты
читаются из живой базы, и разницу с прошлой цифрой нельзя отделить от изменения
данных. Здесь сохраняется сам корпус.

Где: вне git, по умолчанию D:/theseus-archive/eval-corpora/<дата-время>/.
Тексты памяти — персональные данные, в репозиторий они не попадают.

Запуск:
    python tools/eval/freeze_corpus.py
    python tools/eval/freeze_corpus.py --out D:/somewhere
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

CONTAINER = "hindsight-api"
DEFAULT_OUT = Path("D:/theseus-archive/eval-corpora")
SQL = """\\pset tuples_only on
\\pset format unaligned
\\pset fieldsep '\\t'
select id, fact_type, coalesce(bank_id,''), coalesce(array_to_string(tags, ','), ''),
       created_at::date, replace(replace(text, chr(9), ' '), chr(10), ' ')
from memory_units order by created_at, id;
"""


def _run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def _db_password() -> str:
    """Пароль берём из instance.json внутри контейнера, в коде его нет."""
    res = _run(["docker", "exec", CONTAINER, "cat", "/home/hindsight/.pg0/instances/hindsight/instance.json"])
    if res.returncode != 0:
        raise SystemExit(f"не прочитал instance.json: {res.stderr[:200]}")
    return json.loads(res.stdout)["password"]


def dump_corpus(sql_path: Path) -> str:
    """Выгружает корпус через psql внутри контейнера."""
    copy = _run(["docker", "cp", str(sql_path), f"{CONTAINER}:/tmp/freeze.sql"])
    if copy.returncode != 0:
        raise SystemExit(f"не удалось положить SQL в контейнер: {copy.stderr[:200]}")
    cmd = (
        "/home/hindsight/.pg0/installation/18.1.0/bin/psql -h 127.0.0.1 -p 5432 "
        "-U hindsight -d hindsight -f /tmp/freeze.sql"
    )
    # Пароль передаётся как имя переменной окружения, значение — через env процесса:
    # в исходнике нет присвоения, и сканер секретов не срабатывает ложно.
    env = {
        **os.environ,
        "PGPASSWORD": _db_password(),
        "LD_LIBRARY_PATH": "/home/hindsight/.pg0/installation/18.1.0/lib",
    }
    res = _run(
        ["docker", "exec", "-e", "PGPASSWORD", CONTAINER, "sh", "-c", cmd],
        env=env,
    )
    if res.returncode != 0:
        raise SystemExit(f"psql упал: {res.stderr[:300]}")
    lines = [l for l in res.stdout.splitlines() if l.strip() and not l.startswith(("Output format", "Field separator"))]
    return "\n".join(lines) + "\n"


def search_config() -> dict:
    """Конфигурация поиска, без которой прогон невоспроизводим."""
    import os

    compose = Path(__file__).resolve().parents[2] / "deploy/hindsight/docker-compose.yml"
    wanted = (
        "HINDSIGHT_API_EMBEDDINGS_LOCAL_MODEL",
        "HINDSIGHT_API_RERANKER_LOCAL_MODEL",
        "HINDSIGHT_API_RERANKER_MAX_CANDIDATES",
        "HINDSIGHT_API_RERANKER_LOCAL_BUCKET_BATCHING",
    )
    cfg = {}
    if compose.exists():
        for line in compose.read_text(encoding="utf-8").splitlines():
            for key in wanted:
                if line.strip().startswith(key + ":"):
                    cfg[key] = line.split(":", 1)[1].strip().strip('"')
    cfg["recall_budget"] = os.environ.get("EVAL_RECALL_BUDGET", "low")
    cfg["recall_max_tokens"] = os.environ.get("EVAL_RECALL_MAX_TOKENS", "768")
    return cfg


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    stamp = time.strftime("%Y%m%d-%H%M%S")
    target = Path(args.out) / f"corpus-{stamp}"
    target.mkdir(parents=True, exist_ok=True)

    sql_path = target / "freeze.sql"
    sql_path.write_text(SQL, encoding="utf-8")
    body = dump_corpus(sql_path)
    sql_path.unlink()

    corpus = target / "corpus.tsv"
    corpus.write_text(body, encoding="utf-8")
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    rows = [l for l in body.splitlines() if l.strip()]

    manifest = {
        "frozen_at": stamp,
        "rows": len(rows),
        "sha256": digest,
        "columns": ["id", "fact_type", "bank_id", "tags", "created_date", "text"],
        "search_config": search_config(),
        "note": "Тексты памяти: персональные данные, в git не коммитить.",
    }
    (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"корпус: {corpus}")
    print(f"строк: {len(rows)}")
    print(f"sha256: {digest}")
    print(f"манифест: {target / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
