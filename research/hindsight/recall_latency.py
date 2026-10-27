"""Time recall on a fixed question set so two reranker stacks can be compared.

The comparison that matters is wall-clock recall latency on the same machine,
same questions, same candidate budget. Anything else compares different things:
the old 6.2 s figure came from a different stack on a VPS that no longer exists,
and quoting it against today's numbers is how a wrong conclusion gets made.

Run this before and after switching HINDSIGHT_API_RERANKER_LOCAL_MODEL, restart
the container in between, and compare the printed percentiles.

Usage:
    python research/hindsight/recall_latency.py --label l12-mmarco
    python research/hindsight/recall_latency.py --label l6-msmarco --runs 2
"""
from __future__ import annotations

import argparse
import json
import pathlib
import statistics
import sys
import time
import urllib.request

API = "http://127.0.0.1:8888"
BANK = "hermes"
HERE = pathlib.Path(__file__).parent
QUESTIONS = HERE / "gold-questions-ru.json"
RESULTS = pathlib.Path(r"C:/Users/s.poklad/AppData/Local/hermes/cache/scratch/rerank-ab.json")


def recall(query: str, limit: int) -> tuple[float, int]:
    body = json.dumps({"query": query, "limit": limit}).encode()
    req = urllib.request.Request(
        f"{API}/v1/default/banks/{BANK}/memories/recall",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.loads(r.read().decode())
    return time.perf_counter() - started, len(data.get("results", []))


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = max(0, min(len(ordered) - 1, int(round((p / 100) * (len(ordered) - 1)))))
    return ordered[k]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", required=True, help="name of this configuration, e.g. l12-mmarco")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--runs", type=int, default=1, help="how many times to repeat the whole set")
    args = ap.parse_args()

    questions = list(json.loads(QUESTIONS.read_text(encoding="utf-8")).values())

    # One warm-up call: the first recall after a container start pays model load
    # and would otherwise land in the sample as a fake outlier.
    warm, _ = recall(questions[0], args.limit)
    print(f"прогрев: {warm:.1f} c\n")

    times: list[float] = []
    for run in range(args.runs):
        for i, q in enumerate(questions, 1):
            t, n = recall(q, args.limit)
            times.append(t)
            print(f"  {run + 1}.{i:02}  {t:6.2f} c  результатов={n}  {q[:60]}")

    summary = {
        "label": args.label,
        "limit": args.limit,
        "n": len(times),
        "mean": round(statistics.mean(times), 2),
        "p50": round(pct(times, 50), 2),
        "p95": round(pct(times, 95), 2),
        "min": round(min(times), 2),
        "max": round(max(times), 2),
    }
    print("\n=== итог ===")
    for k in ("label", "n", "mean", "p50", "p95", "min", "max"):
        print(f"{k:6}: {summary[k]}")

    history = []
    if RESULTS.exists():
        history = json.loads(RESULTS.read_text(encoding="utf-8"))
    history.append(summary)
    RESULTS.write_text(json.dumps(history, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nдобавлено в {RESULTS.name} (всего замеров: {len(history)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
