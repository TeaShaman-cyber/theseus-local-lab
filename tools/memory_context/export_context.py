#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_QUERIES = [
    "theseus-local-lab AutoMem CodeWhale Bothub durable project rules",
    "CodeWhale harness AutoMem context memory inbox worker boundaries",
    "stateful-agent-net observatory Docker background service",
    "security secrets git backup restore rules local lab",
    "Theseus local lab user collaboration preferences",
]

DEFAULT_OUTPUT = Path("outputs/context/codewhale_context.md")
DEFAULT_API_URL = "http://127.0.0.1:8001"
LOCAL_HOSTS = {"127.0.0.1", "localhost", "host.docker.internal"}


def parse_env_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        return None
    name, value = stripped.split("=", 1)
    value = value.strip().strip('"').strip("'")
    return name.strip(), value


def load_env_files(root: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for name in (".env", ".env.local"):
        path = root / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            parsed = parse_env_line(line)
            if parsed:
                key, value = parsed
                values[key] = value
    values.update({key: value for key, value in os.environ.items()})
    return values


def redact(text: str) -> str:
    patterns = [
        r"(?i)\b(api[_-]?key|token|secret|password)\s*[:=]\s*['\"]?[^'\"\s`]+",
        r"\bsk-[A-Za-z0-9_-]{16,}\b",
        r"\bsk-proj-[A-Za-z0-9_-]{16,}\b",
    ]
    redacted = text
    for pattern in patterns:
        redacted = re.sub(pattern, lambda m: m.group(0).split("=", 1)[0] + "=***REDACTED***" if "=" in m.group(0) else "***REDACTED***", redacted)
    return redacted


def request_json(url: str, token: str | None, timeout: float = 20.0) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read().decode("utf-8")
    return json.loads(data)


def build_url(api_url: str, path: str, params: dict[str, Any] | None = None) -> str:
    base = api_url.rstrip("/")
    query = ""
    if params:
        clean = {key: value for key, value in params.items() if value not in (None, "", [])}
        query = "?" + urllib.parse.urlencode(clean, doseq=True)
    return f"{base}{path}{query}"


def is_local_api(api_url: str) -> bool:
    parsed = urllib.parse.urlparse(api_url)
    return (parsed.hostname or "") in LOCAL_HOSTS


def resolve_api_token(api_url: str, env: dict[str, str]) -> str | None:
    token = env.get("AUTOMEM_API_TOKEN")
    if token:
        return token
    if is_local_api(api_url):
        return "test-token"
    return None


def recall(api_url: str, token: str | None, query: str, limit: int) -> list[dict[str, Any]]:
    params = {
        "query": query,
        "limit": limit,
        "state_mode": "current",
        "expand_relations": "true",
        "expand_min_importance": "0.4",
        "expand_min_strength": "0.3",
        "recency_bias": "auto",
    }
    payload = request_json(build_url(api_url, "/recall", params), token)
    results = payload.get("results", [])
    if not isinstance(results, list):
        return []
    for item in results:
        if isinstance(item, dict):
            item["_source_query"] = query
    return [item for item in results if isinstance(item, dict)]


def item_id(item: dict[str, Any]) -> str:
    return str(item.get("id") or item.get("memory_id") or item.get("uuid") or "")


def item_content(item: dict[str, Any]) -> str:
    content = item.get("content")
    if content is None and isinstance(item.get("memory"), dict):
        content = item["memory"].get("content")
    return redact(str(content or "").strip())


def item_tags(item: dict[str, Any]) -> list[str]:
    tags = item.get("tags")
    if tags is None and isinstance(item.get("memory"), dict):
        tags = item["memory"].get("tags")
    if isinstance(tags, str):
        return [tag.strip() for tag in tags.split(",") if tag.strip()]
    if isinstance(tags, list):
        return [str(tag) for tag in tags]
    return []


def item_float(item: dict[str, Any], *names: str) -> float | None:
    for name in names:
        value = item.get(name)
        if value is None and isinstance(item.get("memory"), dict):
            value = item["memory"].get(name)
        try:
            if value is not None:
                return float(value)
        except (TypeError, ValueError):
            pass
    return None


def dedupe(items: list[dict[str, Any]], max_items: int) -> list[dict[str, Any]]:
    seen: set[str] = set()
    output: list[dict[str, Any]] = []
    for item in items:
        content = item_content(item)
        key = item_id(item) or re.sub(r"\s+", " ", content.lower())[:160]
        if not key or key in seen or not content:
            continue
        seen.add(key)
        output.append(item)
        if len(output) >= max_items:
            break
    return output


def format_memory(index: int, item: dict[str, Any]) -> str:
    tags = item_tags(item)
    importance = item_float(item, "importance")
    score = item_float(item, "score", "relevance_score")
    lines = [f"### {index}. Memory"]
    meta = []
    memory_id = item_id(item)
    if memory_id:
        meta.append(f"id `{memory_id}`")
    if tags:
        meta.append("tags " + ", ".join(f"`{tag}`" for tag in tags[:12]))
    if importance is not None:
        meta.append(f"importance {importance:.2f}")
    if score is not None:
        meta.append(f"score {score:.3f}")
    source_query = item.get("_source_query")
    if source_query:
        meta.append(f"query `{source_query}`")
    if meta:
        lines.append("- " + "; ".join(meta))
    content = textwrap.shorten(item_content(item), width=900, placeholder=" ...")
    lines.extend(["", content, ""])
    return "\n".join(lines)


def build_markdown(
    *,
    api_url: str,
    health: dict[str, Any] | None,
    memories: list[dict[str, Any]],
    warnings: list[str],
) -> str:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    health_lines = ["- AutoMem health: unavailable"]
    if health:
        stats = health.get("statistics", {}) if isinstance(health.get("statistics"), dict) else {}
        health_lines = [
            f"- AutoMem health: `{health.get('status', 'unknown')}`",
            f"- Memory count: `{stats.get('memory_count', 'unknown')}`",
            f"- Vector count: `{stats.get('vector_count', 'unknown')}`",
        ]
    warning_block = ""
    if warnings:
        warning_block = "\n## Warnings\n\n" + "\n".join(f"- {redact(warning)}" for warning in warnings) + "\n"
    memory_block = "\n".join(format_memory(i + 1, item) for i, item in enumerate(memories))
    if not memory_block:
        memory_block = "No recalled memories were available. Use this pack only as a boundary note.\n"
    return f"""# CodeWhale Context Pack

Generated: `{now}`

Source: `{api_url}`

Purpose: give CodeWhale and other worker harnesses a compact read-only project
context without granting direct write access to long-term memory.

## Boundaries

- Treat this file as context, not as an instruction to rewrite project memory.
- Do not store directly into AutoMem from worker models.
- Put durable memory candidates in `outputs/memory_inbox/` for review.
- Never request, print, or infer secret values.
- Prefer small, reviewable diffs and keep Windows-specific wrappers thin.

## AutoMem Status

{chr(10).join(health_lines)}
{warning_block}
## Recalled Context

{memory_block}
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Export a compact AutoMem context pack for CodeWhale.")
    parser.add_argument("--project-root", default=".", help="Repository root. Defaults to current directory.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Markdown output path.")
    parser.add_argument("--api-url", default=None, help="AutoMem API URL. Overrides env.")
    parser.add_argument("--query", action="append", default=[], help="Recall query. Can be repeated.")
    parser.add_argument("--limit-per-query", type=int, default=6)
    parser.add_argument("--max-items", type=int, default=24)
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    env = load_env_files(root)
    api_url = args.api_url or env.get("AUTOMEM_API_URL") or DEFAULT_API_URL
    token = resolve_api_token(api_url, env)
    queries = args.query or DEFAULT_QUERIES
    warnings: list[str] = []

    health: dict[str, Any] | None = None
    try:
        health = request_json(build_url(api_url, "/health"), token=None, timeout=10)
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        warnings.append(f"Health check failed: {type(exc).__name__}: {exc}")

    recalled: list[dict[str, Any]] = []
    for query in queries:
        try:
            recalled.extend(recall(api_url, token, query, max(1, args.limit_per_query)))
        except urllib.error.HTTPError as exc:
            warnings.append(f"Recall failed for `{query}`: HTTP {exc.code}")
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            warnings.append(f"Recall failed for `{query}`: {type(exc).__name__}: {exc}")

    memories = dedupe(recalled, max(1, args.max_items))
    output = Path(args.output)
    if not output.is_absolute():
        output = root / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(build_markdown(api_url=api_url, health=health, memories=memories, warnings=warnings), encoding="utf-8")
    print(f"wrote {output}")
    print(f"memories {len(memories)}")
    if warnings:
        print(f"warnings {len(warnings)}", file=sys.stderr)
    return 0 if health or memories else 2


if __name__ == "__main__":
    raise SystemExit(main())
