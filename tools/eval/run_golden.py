"""Прогон golden-сета по живому Hindsight.

Почему так, а не проще:
- у эндпоинта recall НЕТ параметра limit: объём задают budget, max_tokens и types,
  поэтому раннер воспроизводит настройки плагина, а не «топ-5»;
- засчитывается не только точный id, но и запись, выведенная из искомого факта:
  консолидация создаёт наблюдения, и они законно отвечают на вопрос вместо
  исходной записи. Проверка идёт по source_facts и по пересечению текста.

Запуск: python tools/eval/run_golden.py
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GOLDEN = ROOT / "docs/eval/golden-v1.jsonl"
DEFAULT_BASE = "http://127.0.0.1:8888"
BASE = f"{DEFAULT_BASE}/v1/default/banks/hermes"
RECALL = f"{BASE}/memories/recall"
TYPES = ["observation", "world", "experience"]
DEFAULT_TYPES = ",".join(TYPES)
STOP = set("""и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только
для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того
этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех
никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них
какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя
такой им более всегда конечно всю между the and for not with that this from are was you all
any can has have but its our their they will would must should may only when then than into
out""".split())


def _post(url: str, payload: dict, timeout: int = 180) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def fetch_text(memory_id: str) -> str:
    try:
        with urllib.request.urlopen(f"{BASE}/memories/{memory_id}", timeout=30) as resp:
            data = json.loads(resp.read())
        return data.get("text") or data.get("content") or ""
    except Exception:  # noqa: BLE001
        return ""


def stems(text: str) -> set[str]:
    raw = re.findall(r"[a-zA-Zа-яА-ЯёЁ0-9_]{4,}", text.lower())
    return {w[:5] for w in raw if w not in STOP}


def overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", default="low")
    ap.add_argument("--max-tokens", type=int, default=768)
    ap.add_argument("--base", default=DEFAULT_BASE,
                    help="адрес Hindsight, например http://10.10.10.13:8888 — чтобы мерить "
                         "тестовый стенд, не трогая боевой")
    ap.add_argument("--types", default=DEFAULT_TYPES,
                    help="через запятую; например world,experience — чтобы проверить, "
                         "что дают производные наблюдения")
    ap.add_argument("--corpus", default=None,
                    help="каталог или файл замороженного корпуса; без него тексты читаются из живой базы")
    args = ap.parse_args()

    global BASE, RECALL
    BASE = f"{args.base.rstrip('/')}/v1/default/banks/hermes"
    RECALL = f"{BASE}/memories/recall"

    corpus_text: dict[str, str] = {}
    corpus_note = "живая база"
    if args.corpus:
        path = Path(args.corpus)
        tsv = path / "corpus.tsv" if path.is_dir() else path
        for line in tsv.read_text(encoding="utf-8").splitlines():
            parts = line.split("\t")
            if len(parts) >= 6:
                corpus_text[parts[0]] = parts[5]
        manifest = tsv.parent / "manifest.json"
        if manifest.exists():
            meta = json.loads(manifest.read_text(encoding="utf-8"))
            corpus_note = f"{tsv.parent.name}, sha256 {meta.get('sha256', '?')[:16]}…, строк {meta.get('rows')}"
        else:
            corpus_note = f"{tsv} (без манифеста)"

    rows = [json.loads(l) for l in GOLDEN.read_text(encoding="utf-8").splitlines() if l.strip()]

    expected_text: dict[str, str] = {}
    for row in rows:
        for mid in row.get("expected_ids") or []:
            if mid in expected_text:
                continue
            expected_text[mid] = corpus_text.get(mid) or fetch_text(mid)
    expected_stems = {k: stems(v) for k, v in expected_text.items() if v}

    hits, soft_hits, rr = 0, 0, []
    contradictions = 0
    answerable = 0
    print(f"{'id':5} {'категория':16} {'выдача':>7}  результат")
    print(f"корпус: {corpus_note}\n")
    for row in rows:
        try:
            data = _post(RECALL, {
                "query": row["query"], "budget": args.budget,
                "max_tokens": args.max_tokens,
                "types": [t.strip() for t in args.types.split(",") if t.strip()],
            })
        except Exception as exc:  # noqa: BLE001
            print(f"{row['id']:5} {row['category']:16} {'—':>7}  ОШИБКА: {exc}")
            continue

        results = data.get("results") or []
        expected = set(row.get("expected_ids") or [])
        hard_neg = set(row.get("hard_negative_ids") or [])

        rank = None
        reason = ""
        soft_rank = None
        contradiction_hits = 0
        for pos, item in enumerate(results, start=1):
            rid = str(item.get("id") or "")
            if rid in hard_neg:
                # Явно неверная запись в выдаче — это не попадание, а противоречие.
                contradiction_hits += 1
                continue
            if rid in expected:
                rank, reason = pos, "точный id"
                break
            sources = item.get("source_facts") or item.get("source_memory_ids") or []
            src_ids = {str(s.get("id")) if isinstance(s, dict) else str(s) for s in sources}
            if src_ids & expected:
                rank, reason = pos, "производная запись"
                break
            if soft_rank is None:
                st = stems(item.get("text") or "")
                if any(overlap(st, exp) >= 0.5 for exp in expected_stems.values()):
                    soft_rank = pos
        # Мягкий зачёт не подменяет строгий: он показывается отдельной цифрой,
        # потому что на русском совпадение основ слов даёт ложные попадания.
        soft_only = rank is None and soft_rank is not None

        if not expected:
            print(f"{row['id']:5} {row['category']:16} {len(results):>7}  "
                  f"{'пусто' if not results else 'вернул ' + str(len(results))}")
            continue

        answerable += 1
        contradictions += contradiction_hits
        tail = f" | противоречий: {contradiction_hits}" if contradiction_hits else ""
        if rank:
            hits += 1
            rr.append(1.0 / rank)
            print(f"{row['id']:5} {row['category']:16} {len(results):>7}  ok, ранг {rank} ({reason}){tail}")
        elif soft_only:
            soft_hits += 1
            rr.append(0.0)
            print(f"{row['id']:5} {row['category']:16} {len(results):>7}  только мягкий зачёт, ранг {soft_rank}{tail}")
        else:
            rr.append(0.0)
            print(f"{row['id']:5} {row['category']:16} {len(results):>7}  ПРОМАХ{tail}")

    print()
    if answerable:
        print(f"строгий hit rate: {hits}/{answerable} = {hits / answerable:.3f}")
        print(f"с мягким зачётом: {(hits + soft_hits)}/{answerable} = {(hits + soft_hits) / answerable:.3f}"
              f"  (мягких {soft_hits})")
        print(f"MRR (строгий): {statistics.mean(rr):.3f}")
        if contradictions:
            print(f"противоречий в выдаче всего: {contradictions} (hard negatives, "
                  f"зачёт по ним запрещён)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
