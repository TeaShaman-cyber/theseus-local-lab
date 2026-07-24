#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Iterable

import ijson
import pyarrow as pa
import pyarrow.parquet as pq


CONVERSATION_SCHEMA = pa.schema([
    ("conversation_id", pa.string()),
    ("title", pa.string()),
    ("inserted_at", pa.string()),
    ("updated_at", pa.string()),
])
MESSAGE_SCHEMA = pa.schema([
    ("conversation_id", pa.string()),
    ("node_id", pa.string()),
    ("parent_id", pa.string()),
    ("model", pa.string()),
    ("inserted_at", pa.string()),
])
EDGE_SCHEMA = pa.schema([
    ("conversation_id", pa.string()),
    ("parent_id", pa.string()),
    ("child_id", pa.string()),
])
FRAGMENT_SCHEMA = pa.schema([
    ("conversation_id", pa.string()),
    ("node_id", pa.string()),
    ("fragment_index", pa.int32()),
    ("fragment_type", pa.string()),
    ("content", pa.string()),
])


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_rows(writer: pq.ParquetWriter, schema: pa.Schema, rows: list[dict]) -> None:
    if rows:
        writer.write_table(pa.Table.from_pylist(rows, schema=schema))
        rows.clear()


def normalize_export(source: str | Path, output_dir: str | Path, batch_size: int = 2000) -> dict:
    source = Path(source)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    paths = {
        "conversations.parquet": output_dir / "conversations.parquet",
        "messages.parquet": output_dir / "messages.parquet",
        "edges.parquet": output_dir / "edges.parquet",
        "fragments.parquet": output_dir / "fragments.parquet",
    }

    counts = {"conversations": 0, "messages": 0, "edges": 0, "fragments": 0}
    conv_rows: list[dict] = []
    message_rows: list[dict] = []
    edge_rows: list[dict] = []
    fragment_rows: list[dict] = []

    writers = {
        "conversations": pq.ParquetWriter(paths["conversations.parquet"], CONVERSATION_SCHEMA, compression="zstd"),
        "messages": pq.ParquetWriter(paths["messages.parquet"], MESSAGE_SCHEMA, compression="zstd"),
        "edges": pq.ParquetWriter(paths["edges.parquet"], EDGE_SCHEMA, compression="zstd"),
        "fragments": pq.ParquetWriter(paths["fragments.parquet"], FRAGMENT_SCHEMA, compression="zstd"),
    }

    try:
        with source.open("rb") as handle:
            for conversation in ijson.items(handle, "item"):
                conversation_id = str(conversation.get("id") or "")
                conv_rows.append({
                    "conversation_id": conversation_id,
                    "title": conversation.get("title") or "",
                    "inserted_at": conversation.get("inserted_at") or "",
                    "updated_at": conversation.get("updated_at") or "",
                })
                counts["conversations"] += 1

                mapping = conversation.get("mapping") or {}
                for node_key, node in mapping.items():
                    node_id = str(node.get("id") or node_key)
                    parent_id = node.get("parent")
                    for child_id in node.get("children") or []:
                        edge_rows.append({
                            "conversation_id": conversation_id,
                            "parent_id": node_id,
                            "child_id": str(child_id),
                        })
                        counts["edges"] += 1

                    message = node.get("message")
                    if not message:
                        continue
                    message_rows.append({
                        "conversation_id": conversation_id,
                        "node_id": node_id,
                        "parent_id": None if parent_id is None else str(parent_id),
                        "model": message.get("model") or "",
                        "inserted_at": message.get("inserted_at") or "",
                    })
                    counts["messages"] += 1

                    for fragment_index, fragment in enumerate(message.get("fragments") or []):
                        fragment_rows.append({
                            "conversation_id": conversation_id,
                            "node_id": node_id,
                            "fragment_index": fragment_index,
                            "fragment_type": fragment.get("type") or "",
                            "content": fragment.get("content") or "",
                        })
                        counts["fragments"] += 1

                    if len(message_rows) >= batch_size:
                        _write_rows(writers["messages"], MESSAGE_SCHEMA, message_rows)
                    if len(edge_rows) >= batch_size:
                        _write_rows(writers["edges"], EDGE_SCHEMA, edge_rows)
                    if len(fragment_rows) >= batch_size:
                        _write_rows(writers["fragments"], FRAGMENT_SCHEMA, fragment_rows)

                if len(conv_rows) >= batch_size:
                    _write_rows(writers["conversations"], CONVERSATION_SCHEMA, conv_rows)

        _write_rows(writers["conversations"], CONVERSATION_SCHEMA, conv_rows)
        _write_rows(writers["messages"], MESSAGE_SCHEMA, message_rows)
        _write_rows(writers["edges"], EDGE_SCHEMA, edge_rows)
        _write_rows(writers["fragments"], FRAGMENT_SCHEMA, fragment_rows)
    finally:
        for writer in writers.values():
            writer.close()

    manifest = {
        "schema": "theseus.deepseek_corpus_normalized.v0.1",
        "source": {
            "filename": source.name,
            "bytes": source.stat().st_size,
            "sha256": sha256_file(source),
        },
        "counts": counts,
        "artifacts": {},
    }
    for name, path in paths.items():
        manifest["artifacts"][name] = {
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }

    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Stream-normalize a DeepSeek conversations.json export into graph-preserving Parquet tables.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--batch-size", type=int, default=2000)
    args = parser.parse_args()
    manifest = normalize_export(args.input, args.output, batch_size=max(1, args.batch_size))
    print(json.dumps(manifest, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
