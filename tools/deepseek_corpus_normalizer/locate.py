#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import duckdb


def locate_fragments(normalized_dir: str | Path, terms: list[str], limit: int = 50, snippet_chars: int = 320) -> list[dict]:
    normalized_dir = Path(normalized_dir)
    clean_terms = []
    seen = set()
    for term in terms:
        t = str(term).strip().lower()
        if t and t not in seen:
            seen.add(t)
            clean_terms.append(t)
    if not clean_terms:
        return []

    fragments = str(normalized_dir / 'fragments.parquet').replace("'", "''")
    messages = str(normalized_dir / 'messages.parquet').replace("'", "''")
    score_expr = " + ".join(["CASE WHEN lower(f.content) LIKE ? THEN 1 ELSE 0 END" for _ in clean_terms])
    where_expr = " OR ".join(["lower(f.content) LIKE ?" for _ in clean_terms])
    sql = f"""
        SELECT
            f.conversation_id,
            f.node_id,
            f.fragment_index,
            f.fragment_type,
            m.model,
            m.inserted_at,
            ({score_expr})::INTEGER AS score,
            f.content
        FROM read_parquet('{fragments}') f
        LEFT JOIN read_parquet('{messages}') m
          USING (conversation_id, node_id)
        WHERE {where_expr}
        ORDER BY score DESC, m.inserted_at ASC, f.fragment_index ASC
        LIMIT ?
    """
    like_params = [f"%{term}%" for term in clean_terms]
    params = like_params + like_params + [max(1, int(limit))]
    rows = duckdb.connect().execute(sql, params).fetchall()
    cols = ['conversation_id','node_id','fragment_index','fragment_type','model','inserted_at','score','content']
    results = []
    max_chars = max(40, int(snippet_chars))
    for row in rows:
        item = dict(zip(cols, row))
        content = item.pop('content') or ''
        lower = content.lower()
        item['matched_terms'] = [term for term in clean_terms if term in lower]
        compact = ' '.join(content.split())
        suffix = ' [...]'
        item['snippet'] = compact if len(compact) <= max_chars else compact[:max(1, max_chars-len(suffix))].rstrip() + suffix
        results.append(item)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description='Locate research-relevant fragments in normalized DeepSeek Parquet without loading the full corpus into context.')
    parser.add_argument('--normalized', required=True)
    parser.add_argument('--term', action='append', default=[])
    parser.add_argument('--terms-file')
    parser.add_argument('--limit', type=int, default=50)
    parser.add_argument('--snippet-chars', type=int, default=320)
    parser.add_argument('--output')
    args = parser.parse_args()
    terms = list(args.term)
    if args.terms_file:
        payload = json.loads(Path(args.terms_file).read_text(encoding='utf-8'))
        terms.extend(payload['terms'] if isinstance(payload, dict) else payload)
    result = locate_fragments(args.normalized, terms, args.limit, args.snippet_chars)
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(text, encoding='utf-8')
    else:
        print(text, end='')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
