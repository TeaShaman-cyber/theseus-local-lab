"""Measure recall quality by fact id instead of by text.

The earlier gold set stored reference texts written by hand and compared them to
what recall returned. That fails for two reasons that have nothing to do with
retrieval quality: the extractor rephrases facts when it stores them, and the
retrieval stack changes over time. Both break a text comparison while leaving
the answer perfectly retrievable.

This harness fixes the object under test. Each entry pins a real fact id that
exists in the bank right now, so the measurement asks the only question worth
asking: does the search return the fact that answers the question, and how high.

Usage:
    python research/hindsight/eval_recall_by_id.py
    python research/hindsight/eval_recall_by_id.py --limit 20 --json out.json
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import urllib.request

API = "http://127.0.0.1:8888"
BANK = "hermes"
HERE = pathlib.Path(__file__).parent
QUESTIONS = HERE / "gold-questions-ru.json"
GOLD_OUT = HERE / "gold-set-id.json"


def _get(url: str):
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.loads(r.read().decode())


def _post(url: str, payload: dict):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())


def load_all_memories() -> dict[str, dict]:
    """Fetch every memory once and index it by the first 8 chars of its id."""
    first = _get(f"{API}/v1/default/banks/{BANK}/memories/list?limit=1")
    total = first["total"]
    index: dict[str, dict] = {}
    offset = 0
    while offset < total:
        page = _get(f"{API}/v1/default/banks/{BANK}/memories/list?limit=500&offset={offset}")
        for m in page["items"]:
            index[m["id"][:8]] = m
        offset += 500
    return index


def build_gold(index: dict[str, dict]) -> list[dict]:
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    gold, missing = [], []
    for id8, question in questions.items():
        fact = index.get(id8)
        if not fact:
            missing.append(id8)
            continue
        gold.append({
            "id": fact["id"],
            "id8": id8,
            "type": fact.get("fact_type"),
            "question": question,
            "fact": fact["text"],
        })
    if missing:
        print(f"WARN: факты не найдены в банке: {missing}", file=sys.stderr)
    GOLD_OUT.write_text(json.dumps(gold, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return gold


def rank_of(gold_id: str, results: list[dict]) -> int | None:
    for i, r in enumerate(results, 1):
        if r.get("id") == gold_id:
            return i
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=20, help="how many results to request per query")
    ap.add_argument("--json", type=pathlib.Path, help="write per-question detail here")
    args = ap.parse_args()

    print("загружаю факты из банка…")
    index = load_all_memories()
    print(f"в банке {len(index)} записей")

    gold = build_gold(index)
    print(f"эталонов: {len(gold)} (сохранён в {GOLD_OUT.name})\n")

    rows = []
    for entry in gold:
        resp = _post(f"{API}/v1/default/banks/{BANK}/memories/recall",
                     {"query": entry["question"], "limit": args.limit})
        results = resp.get("results", [])
        rank = rank_of(entry["id"], results)
        rows.append({
            "id8": entry["id8"],
            "type": entry["type"],
            "question": entry["question"],
            "rank": rank,
            "returned": len(results),
        })
        mark = f"#{rank}" if rank else "—"
        print(f"  {mark:>4}  [{entry['type']:11}] {entry['question'][:72]}")

    n = len(rows)
    def at(k: int) -> float:
        return sum(1 for r in rows if r["rank"] and r["rank"] <= k) / n
    mrr = sum(1 / r["rank"] for r in rows if r["rank"]) / n
    found = sum(1 for r in rows if r["rank"])

    print("\n=== итог ===")
    print(f"найдено вообще: {found}/{n}")
    for k in (1, 3, 5, 10):
        print(f"recall@{k:<2}: {at(k):.3f}")
    print(f"MRR:      {mrr:.3f}")

    by_type: dict[str, list] = {}
    for r in rows:
        by_type.setdefault(r["type"], []).append(r)
    print("\nпо типам фактов:")
    for t, rs in sorted(by_type.items()):
        hit = sum(1 for r in rs if r["rank"] and r["rank"] <= 5)
        print(f"  {t:12} {hit}/{len(rs)} в топ-5")

    if args.json:
        args.json.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\nдетали: {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
