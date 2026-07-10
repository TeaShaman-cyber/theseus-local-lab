#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_INBOX = Path("outputs/memory_inbox")


def slugify(text: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", text.strip().lower()).strip("-")
    return slug[:60] or "memory-candidate"


def normalize_tags(values: list[str]) -> list[str]:
    tags: list[str] = []
    for value in values:
        for part in value.split(","):
            tag = part.strip()
            if tag and tag not in tags:
                tags.append(tag)
    return tags


def write_candidate(args: argparse.Namespace) -> Path:
    root = Path(args.project_root).resolve()
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = root / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{slugify(args.title)}.md"
    path = output_dir / filename
    tags = normalize_tags(args.tags or [])
    tag_text = ", ".join(tags)
    evidence = args.evidence.strip() if args.evidence else "Add links, files, logs, or conversation references before promotion."
    body = f"""---
status: draft
created_at: {now}
source: {args.source}
title: {args.title}
tags: [{tag_text}]
importance: {args.importance:.2f}
---

# Memory Candidate: {args.title}

## Candidate Memory

{args.summary.strip()}

## Evidence

{evidence}

## Review Checklist

- [ ] Durable enough to remember after this task.
- [ ] Factually checked against local files, tools, or user confirmation.
- [ ] Contains no secrets, private keys, or raw credentials.
- [ ] Belongs in AutoMem rather than only in a temporary task note.
"""
    path.write_text(body, encoding="utf-8")
    return path


def list_candidates(args: argparse.Namespace) -> int:
    root = Path(args.project_root).resolve()
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = root / output_dir
    if not output_dir.exists():
        print("no inbox directory")
        return 0
    files = sorted(output_dir.glob("*.md"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not files:
        print("no memory candidates")
        return 0
    for path in files[: args.limit]:
        print(path)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Create and list reviewed-memory inbox drafts.")
    parser.add_argument("--project-root", default=".", help="Repository root. Defaults to current directory.")
    parser.add_argument("--output-dir", default=str(DEFAULT_INBOX), help="Inbox directory.")
    sub = parser.add_subparsers(dest="command", required=True)

    new = sub.add_parser("new", help="Create a memory candidate draft.")
    new.add_argument("--title", required=True)
    new.add_argument("--summary", required=True)
    new.add_argument("--tags", nargs="*", default=[])
    new.add_argument("--source", default="codewhale")
    new.add_argument("--importance", type=float, default=0.65)
    new.add_argument("--evidence", default="")

    listing = sub.add_parser("list", help="List recent memory candidate drafts.")
    listing.add_argument("--limit", type=int, default=20)

    args = parser.parse_args()
    if args.command == "new":
        path = write_candidate(args)
        print(f"wrote {path}")
        return 0
    if args.command == "list":
        return list_candidates(args)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
