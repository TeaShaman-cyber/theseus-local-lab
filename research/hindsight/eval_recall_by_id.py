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


def norm_key(text: str) -> str:
    """Same normalisation the plugin uses when it collapses repeated facts.

    Mirrors it deliberately instead of importing: the measuring harness must not
    depend on the thing it measures, or a bug there silently redefines the score.
    """
    cleaned = str(text or "").split("| When:")[0].lower()
    cleaned = "".join(ch if (ch.isalnum() or ch == " ") else " " for ch in cleaned)
    return " ".join(cleaned.split())[:160]


def build_gold(index: dict[str, dict]) -> list[dict]:
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))

    # A fact usually exists more than once: the raw experience and the observation
    # consolidated from it share the same text. Pinning one id scored the sibling
    # copy as a miss, so recall@k measured duplication rather than retrieval. Each
    # gold entry therefore carries every id whose text answers the question.
    by_key: dict[str, list[str]] = {}
    for fact in index.values():
        by_key.setdefault(norm_key(fact.get("text", "")), []).append(fact["id"])

    gold, missing = [], []
    for id8, question in questions.items():
        fact = index.get(id8)
        if not fact:
            missing.append(id8)
            continue
        answer_ids = by_key.get(norm_key(fact["text"]), [fact["id"]])
        gold.append({
            "id": fact["id"],
            "id8": id8,
            "type": fact.get("fact_type"),
            "question": question,
            "fact": fact["text"],
            "answer_ids": answer_ids,
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


def rank_of_any(gold_ids: list[str], results: list[dict]) -> int | None:
    """Best rank among every record whose text answers the question."""
    wanted = set(gold_ids)
    for i, r in enumerate(results, 1):
        if r.get("id") in wanted:
            return i
    return None


def summarise(rows: list[dict], field: str, title: str) -> None:
    n = len(rows)
    def at(k: int) -> float:
        return sum(1 for r in rows if r[field] and r[field] <= k) / n
    mrr = sum(1 / r[field] for r in rows if r[field]) / n
    found = sum(1 for r in rows if r[field])
    print(f"\n=== {title} ===")
    print(f"найдено вообще: {found}/{n}")
    for k in (1, 3, 5, 10):
        print(f"recall@{k:<2}: {at(k):.3f}")
    print(f"MRR:      {mrr:.3f}")


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
        rank_strict = rank_of(entry["id"], results)
        rank_content = rank_of_any(entry["answer_ids"], results)
        rows.append({
            "id8": entry["id8"],
            "type": entry["type"],
            "question": entry["question"],
            "rank": rank_strict,
            "rank_content": rank_content,
            "copies": len(entry["answer_ids"]),
            "returned": len(results),
        })
        s = f"#{rank_strict}" if rank_strict else "—"
        c = f"#{rank_content}" if rank_content else "—"
        print(f"  id {s:>4}  содержание {c:>4}  копий {len(entry['answer_ids'])}  "
              f"[{entry['type']:11}] {entry['question'][:52]}")

    summarise(rows, "rank", "строго по одному id")
    summarise(rows, "rank_content", "по содержанию: любая запись с тем же ответом")

    by_type: dict[str, list] = {}
    for r in rows:
        by_type.setdefault(r["type"], []).append(r)
    print("\nпо типам фактов (в топ-5, по содержанию):")
    for t, rs in sorted(by_type.items()):
        hit = sum(1 for r in rs if r["rank_content"] and r["rank_content"] <= 5)
        print(f"  {t:12} {hit}/{len(rs)}")

    if args.json:
        args.json.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"\nдетали: {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
