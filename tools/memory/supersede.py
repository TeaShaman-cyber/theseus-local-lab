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
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE = (os.environ.get("HINDSIGHT_API_URL") or "http://127.0.0.1:8888").rstrip("/") + "/v1/default/banks/hermes"


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
    needle = text.strip()[:80].lower()
    if not needle:
        return None
    items = data.get("items") or []
    # Список идёт от новых к старым: сначала ищем точное начало текста, чтобы не
    # привязать к аудитовой причине чужой id из-за совпадения префикса.
    for item in items:
        body = (item.get("text") or "").lower()
        if body.startswith(needle):
            return str(item.get("id"))
    for item in items:
        body = (item.get("text") or "").lower()
        if needle in body:
            return str(item.get("id"))
    return None


def invalidate(memory_id: str, reason: str) -> bool:
    """Отзывает факт и возвращает подтверждённый результат.

    Проверяем тело ответа, а не только код: PATCH может вернуть 200 с
    {"success": false}, и тогда «отозван» было бы ложью. Ровно тот инвариант,
    который проект требует соблюдать — успех только после наблюдаемого
    пост-условия.
    """
    data = _request("PATCH", f"{BASE}/memories/{memory_id}",
                    {"state": "invalidated", "reason": reason})
    return bool(data.get("success")) or data.get("state") == "invalidated"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", required=True, help="id устаревшего факта")
    ap.add_argument("--new-text", default=None, help="новый факт; если не задан, старый только отзывается")
    ap.add_argument("--reason", required=True, help="почему старый факт больше не верен")
    ap.add_argument("--tag", action="append", default=[], help="тег нового факта, можно несколько")
    args = ap.parse_args()

    new_id = None
    if args.new_text:
        new_id = write_fact(args.new_text, args.tag)
        print(f"новый факт: {new_id}")

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    reason = f"{args.reason} [{stamp}]"
    if new_id:
        reason += f" (заменён на {new_id})"

    def _orphan_warning() -> None:
        if new_id:
            print(f"ВНИМАНИЕ: новый факт {new_id} уже записан, но старый НЕ отозван — "
                  "пара разорвана, разберите вручную")

    try:
        ok = invalidate(args.old, reason)
    except urllib.error.HTTPError as exc:
        body = exc.read()[:200].decode("utf-8", "ignore")
        print(f"PATCH отклонён: HTTP {exc.code} {body}")
        _orphan_warning()
        return 1
    except urllib.error.URLError as exc:
        # Сеть, а не HTTP-ответ: сервер недоступен, это отдельный случай.
        print(f"сервер памяти недоступен: {exc.reason}")
        _orphan_warning()
        return 1

    if not ok:
        print("PATCH ответил без подтверждения отзыва — считаем неудачей, а не успехом")
        _orphan_warning()
        return 1

    print(f"старый факт отозван: {args.old}")
    print(f"причина: {reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
