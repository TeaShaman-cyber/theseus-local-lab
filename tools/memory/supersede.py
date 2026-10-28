"""Замена устаревшего факта без миграции схемы: новый факт плюс инвалидация старого.

Зачем: замечание ревью — у старого правила может быть proof_count=22, а у нового
одно прямое указание пользователя. Продвижение по частоте оставит устаревшее.
Здесь явная коррекция сильнее частоты: старый факт не удаляется, а помечается
invalidated с причиной, поэтому история остаётся читаемой.

Опоры в API (проверено по openapi): PATCH /memories/{id} принимает state со
значением 'invalidated' и reason, а также text для переписывания. Миграция не
нужна.

Использование:
    python tools/memory/supersede.py --old <id> --new-text "<новый факт>" --reason "<почему>"
    python tools/memory/supersede.py --old <id> --reason "<почему>"     # только отозвать
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8888/v1/default/banks/hermes"


def _request(method: str, url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def write_fact(text: str, tags: list[str], fact_type: str = "world") -> str:
    data = _request("POST", f"{BASE}/memories",
                    {"items": [{"content": text, "fact_type": fact_type, "tags": tags}]})
    if not data.get("success"):
        raise SystemExit(f"запись не удалась: {data}")
    # API не возвращает id элемента в этом ответе — читаем обратно по тексту.
    found = find_by_text(text)
    if not found:
        raise SystemExit("факт записан, но не найден при чтении обратно — проверьте вручную")
    return found


def find_by_text(text: str) -> str | None:
    """Ищет запись в списке последних, а не через recall.

    Recall пересказывает текст и меняет формулировку, поэтому по нему нельзя
    надёжно связать «что записали» с «что лежит». Список отдаёт записи как есть.
    """
    url = f"{BASE}/memories/list?limit=30"
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = json.loads(resp.read())
    needle = text.strip()[:50].lower()
    for item in data.get("items") or []:
        body = (item.get("text") or "").lower()
        if needle and needle in body:
            return str(item.get("id"))
    return None


def invalidate(memory_id: str, reason: str) -> dict:
    return _request("PATCH", f"{BASE}/memories/{memory_id}",
                    {"state": "invalidated", "reason": reason})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", required=True, help="id устаревшего факта")
    ap.add_argument("--new-text", default=None, help="новый факт; если не задан, старый только отзывается")
    ap.add_argument("--reason", required=True, help="почему старый факт больше не верен")
    ap.add_argument("--tag", action="append", default=[], help="тег нового факта, можно несколько")
    args = ap.parse_args()

    new_id = None
    if args.new_text:
        new_id = write_fact(args.new_text, args.tag or ["habit:process"])
        print(f"новый факт: {new_id}")

    reason = args.reason if not new_id else f"{args.reason} (заменён на {new_id})"
    try:
        invalidate(args.old, reason)
    except urllib.error.HTTPError as exc:
        print("PATCH не удался:", exc.code, exc.read()[:200].decode("utf-8", "ignore"))
        return 1

    print(f"старый факт отозван: {args.old}")
    print(f"причина: {reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
