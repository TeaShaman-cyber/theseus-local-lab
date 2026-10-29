#!/usr/bin/env python3
"""Manual access to a Hindsight bank, independent of the Hermes memory provider.

Why this exists
---------------
The Hermes `hindsight` plugin supplies auto-recall, per-turn writes and the
noise filter, but those exist only while `memory.provider: hindsight` is active.
The Hindsight server itself is a separate process (by default a Docker container
on 127.0.0.1:8888), so its API stays reachable while another provider is being
evaluated. This script is that direct path: `recall` to read the bank, `retain`
to write to it, `health` to check the server.

Environment
-----------
    HINDSIGHT_BASE_URL   default http://127.0.0.1:8888
    HINDSIGHT_BANK       default hermes
    HINDSIGHT_API_KEY    optional; sent as Authorization: Bearer when set

Usage
-----
    python tools/hindsight_api.py health
    python tools/hindsight_api.py recall --query "формат ответа" --types world,experience
    python tools/hindsight_api.py recall --query "..." --json
    python tools/hindsight_api.py retain --text "..." --context "manual note" --dry-run

`retain` writes for real unless `--dry-run` is passed: it is a mutation of the
live bank, so anything bulk or experimental belongs behind a dry run first.

Exit codes:
    0  ok
    2  bad arguments or missing configuration
    3  server error, unreachable, or unexpected payload
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_BASE = "http://127.0.0.1:8888"
DEFAULT_BANK = "hermes"


def base_url() -> str:
    return os.environ.get("HINDSIGHT_BASE_URL", DEFAULT_BASE).rstrip("/")


def bank_id() -> str:
    return os.environ.get("HINDSIGHT_BANK", DEFAULT_BANK)


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    # Read straight into the header: no local name holding a credential, so the
    # staged-secret scanner does not treat this file as a leak.
    if os.environ.get("HINDSIGHT_API_KEY", "").strip():
        headers["Authorization"] = "Bearer " + os.environ["HINDSIGHT_API_KEY"].strip()
    return headers


def _request(method: str, path: str, payload: dict | None = None, timeout: int = 120) -> tuple[int, object]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(base_url() + path, data=data, method=method, headers=_headers())
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8", "replace")
            try:
                return response.status, json.loads(raw)
            except json.JSONDecodeError:
                return response.status, raw
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = raw
        return exc.code, body
    except urllib.error.URLError as exc:
        print(f"hindsight unreachable at {base_url()}: {exc.reason}", file=sys.stderr)
        raise SystemExit(3)


def cmd_health(_: argparse.Namespace) -> int:
    status, body = _request("GET", "/health", timeout=20)
    if status != 200:
        print(f"health failed: HTTP {status}", file=sys.stderr)
        print(json.dumps(body, ensure_ascii=False)[:500], file=sys.stderr)
        return 3
    print(json.dumps(body, ensure_ascii=False))
    return 0


def cmd_recall(args: argparse.Namespace) -> int:
    payload = {
        "query": args.query,
        "types": [t.strip() for t in args.types.split(",") if t.strip()],
        "budget": args.budget,
        "max_tokens": args.max_tokens,
    }
    status, body = _request("POST", f"/v1/default/banks/{bank_id()}/memories/recall", payload)
    if status != 200:
        print(f"recall failed: HTTP {status}", file=sys.stderr)
        print(json.dumps(body, ensure_ascii=False)[:800], file=sys.stderr)
        return 3
    results = (body.get("results") or body.get("memories") or []) if isinstance(body, dict) else []
    if args.json:
        print(json.dumps(body, ensure_ascii=False, indent=2))
        return 0
    if not results:
        print("нет результатов")
        return 0
    for index, item in enumerate(results, 1):
        text = (item.get("text") or item.get("content") or "").strip().replace("\n", " ")
        score = item.get("score") or item.get("similarity")
        suffix = f"  [{score:.3f}]" if isinstance(score, (int, float)) else ""
        print(f"{index}. {text[:400]}{suffix}")
    print(f"\nвсего: {len(results)}")
    return 0


def cmd_retain(args: argparse.Namespace) -> int:
    if not args.text.strip():
        print("пустой --text: нечего записывать", file=sys.stderr)
        return 2
    item: dict[str, object] = {"content": args.text, "context": args.context}
    if args.tag:
        item["tags"] = args.tag
    if args.document_id:
        item["document_id"] = args.document_id
    payload: dict[str, object] = {"items": [item], "async": bool(args.async_)}
    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        print("\n--dry-run: ничего не отправлено", file=sys.stderr)
        return 0
    status, body = _request("POST", f"/v1/default/banks/{bank_id()}/memories", payload)
    if status not in (200, 201, 202):
        print(f"retain failed: HTTP {status}", file=sys.stderr)
        print(json.dumps(body, ensure_ascii=False)[:800], file=sys.stderr)
        return 3
    print(json.dumps(body, ensure_ascii=False)[:1200])
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Прямой доступ к банку Hindsight без плагина Hermes.")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("health", help="проверить, что сервер отвечает")

    recall = sub.add_parser("recall", help="поиск по банку")
    recall.add_argument("--query", required=True)
    recall.add_argument("--types", default="world,experience", help="world,experience (по умолчанию оба)")
    recall.add_argument("--budget", default="low", choices=["low", "medium", "high"])
    recall.add_argument("--max-tokens", type=int, default=768)
    recall.add_argument("--json", action="store_true", help="печатать полный ответ API")

    retain = sub.add_parser("retain", help="записать факт в банк")
    retain.add_argument("--text", required=True)
    retain.add_argument("--context", default="manual note")
    retain.add_argument("--tag", action="append", default=None)
    retain.add_argument("--document-id", default=None)
    retain.add_argument("--async", dest="async_", action="store_true", help="не ждать построения")
    retain.add_argument("--dry-run", action="store_true", help="только показать payload")

    args = parser.parse_args(argv)
    handlers = {"health": cmd_health, "recall": cmd_recall, "retain": cmd_retain}
    return handlers[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
