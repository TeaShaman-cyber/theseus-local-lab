#!/usr/bin/env python3
"""Extract text from a PDF into a small JSON structure.

This is intentionally narrow: it avoids OCR, network calls, and heavyweight
model dependencies. Scanned pages are reported as empty so the caller can route
them to a separate OCR backend.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return "\n".join(line.rstrip() for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n")).strip()


def extract_with_pypdf(path: Path, max_pages: int | None) -> dict:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages = []
    limit = len(reader.pages) if max_pages is None else min(len(reader.pages), max_pages)
    for index in range(limit):
        text = normalize_text(reader.pages[index].extract_text())
        pages.append(
            {
                "page": index + 1,
                "method": "pypdf",
                "chars": len(text),
                "text": text,
            }
        )
    return {
        "ok": True,
        "method": "pypdf",
        "page_count": len(reader.pages),
        "pages_read": limit,
        "pages": pages,
    }


def extract_with_pdfplumber(path: Path, max_pages: int | None) -> dict:
    import pdfplumber

    pages = []
    with pdfplumber.open(str(path)) as pdf:
        limit = len(pdf.pages) if max_pages is None else min(len(pdf.pages), max_pages)
        for index in range(limit):
            text = normalize_text(pdf.pages[index].extract_text())
            pages.append(
                {
                    "page": index + 1,
                    "method": "pdfplumber",
                    "chars": len(text),
                    "text": text,
                }
            )
        return {
            "ok": True,
            "method": "pdfplumber",
            "page_count": len(pdf.pages),
            "pages_read": limit,
            "pages": pages,
        }


def best_extraction(path: Path, max_pages: int | None) -> dict:
    attempts = []
    for name, extractor in (("pypdf", extract_with_pypdf), ("pdfplumber", extract_with_pdfplumber)):
        try:
            result = extractor(path, max_pages)
            attempts.append({"method": name, "ok": True, "chars": sum(page["chars"] for page in result["pages"])})
            if sum(page["chars"] for page in result["pages"]) > 0:
                result["attempts"] = attempts
                return result
        except Exception as exc:  # noqa: BLE001 - this is a diagnostic boundary.
            attempts.append({"method": name, "ok": False, "error": str(exc)[:500]})

    return {
        "ok": False,
        "method": None,
        "page_count": 0,
        "pages_read": 0,
        "pages": [],
        "attempts": attempts,
        "error": "No bundled PDF text extractor produced text.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("--max-pages", type=int, default=0)
    args = parser.parse_args()

    path = Path(args.input)
    max_pages = args.max_pages if args.max_pages and args.max_pages > 0 else None
    if not path.exists():
        print(json.dumps({"ok": False, "error": f"Input does not exist: {path}"}, ensure_ascii=False))
        return 2

    result = best_extraction(path, max_pages)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
