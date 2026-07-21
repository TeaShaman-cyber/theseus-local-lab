#!/usr/bin/env python3
"""Read-only local Sonar preflight over the existing AutoMem graph."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import duckdb
from rank_bm25 import BM25Okapi


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = Path.home() / ".cache" / "theseus-sonar" / "sonar.duckdb"
DEFAULT_OUT = ROOT / "outputs" / "sonar_local"
CONTRACT_PATH = Path(__file__).with_name("federation_contract.json")
TERM_RE = re.compile(r"[\w\-]+", re.UNICODE)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def tokenize(text: str) -> list[str]:
    return [term.lower() for term in TERM_RE.findall(text) if len(term) > 1]


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_contract() -> dict[str, Any]:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def connect_db(db_path: Path) -> duckdb.DuckDBPyConnection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = duckdb.connect(str(db_path))
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR PRIMARY KEY,
          content VARCHAR NOT NULL,
          memory_type VARCHAR,
          tags_json VARCHAR,
          importance DOUBLE,
          confidence DOUBLE,
          source_ref VARCHAR NOT NULL,
          fingerprint VARCHAR NOT NULL,
          observed_at VARCHAR
        );
        CREATE TABLE IF NOT EXISTS memory_edges (
          source VARCHAR,
          target VARCHAR,
          relation VARCHAR,
          strength DOUBLE,
          properties_json VARCHAR,
          PRIMARY KEY (source, target, relation)
        );
        CREATE TABLE IF NOT EXISTS federation_nodes (
          id VARCHAR PRIMARY KEY,
          kind VARCHAR,
          domain VARCHAR
        );
        CREATE TABLE IF NOT EXISTS federation_edges (
          source VARCHAR,
          target VARCHAR,
          relation VARCHAR,
          PRIMARY KEY (source, target, relation)
        );
        CREATE TABLE IF NOT EXISTS metadata (
          key VARCHAR PRIMARY KEY,
          value VARCHAR
        );
        CREATE TABLE IF NOT EXISTS probe_runs (
          run_id VARCHAR PRIMARY KEY,
          created_at VARCHAR,
          query VARCHAR,
          domains_json VARCHAR,
          result_ids_json VARCHAR,
          gaps_json VARCHAR,
          duration_ms DOUBLE
        );
        """
    )
    return connection


def bulk_insert(
    connection: duckdb.DuckDBPyConnection,
    table: str,
    rows: list[tuple[Any, ...]],
) -> None:
    """Load generated rows in one DuckDB COPY instead of slow executemany calls."""
    if not rows:
        return
    allowed_tables = {"documents", "memory_edges", "federation_nodes", "federation_edges"}
    if table not in allowed_tables:
        raise ValueError(f"unsupported bulk insert table: {table}")
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="", suffix=".csv", delete=False
        ) as handle:
            temp_path = handle.name
            csv.writer(handle).writerows(rows)
        sql_path = temp_path.replace("'", "''")
        connection.execute(f"COPY {table} FROM '{sql_path}' (FORMAT CSV, HEADER false)")
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


def fetch_json(url: str, credential: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    if credential:
        request.add_header("Authorization", f"Bearer {credential}")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def seed_federation(connection: duckdb.DuckDBPyConnection, contract: dict[str, Any]) -> None:
    connection.execute("DELETE FROM federation_nodes")
    connection.execute("DELETE FROM federation_edges")
    bulk_insert(
        connection,
        "federation_nodes",
        [(node["id"], node["kind"], node["domain"]) for node in contract["nodes"]],
    )
    bulk_insert(
        connection,
        "federation_edges",
        [(edge["source"], edge["target"], edge["relation"]) for edge in contract["edges"]],
    )


def refresh(args: argparse.Namespace) -> dict[str, Any]:
    started = time.perf_counter()
    contract = load_contract()
    if args.snapshot_file:
        snapshot = json.loads(Path(args.snapshot_file).read_text(encoding="utf-8"))
        source = str(Path(args.snapshot_file).resolve())
    else:
        api_url = args.api_url.rstrip("/")
        credential = os.getenv("AUTOMEM_API_TOKEN") or "test-token"
        snapshot = fetch_json(f"{api_url}/graph/snapshot?limit=0", credential)
        source = f"{api_url}/graph/snapshot"

    connection = connect_db(Path(args.db))
    connection.execute("DELETE FROM documents")
    connection.execute("DELETE FROM memory_edges")

    documents = []
    for node in snapshot.get("nodes", []):
        content = str(node.get("content") or "").strip()
        if not node.get("id") or not content:
            continue
        documents.append(
            (
                str(node["id"]),
                content,
                str(node.get("type") or "Memory"),
                json.dumps(node.get("tags") or [], ensure_ascii=False),
                float(node.get("importance") or 0.5),
                float(node.get("confidence") or 0.5),
                f"automem://{node['id']}",
                fingerprint(content),
                str(node.get("updated_at") or node.get("timestamp") or ""),
            )
        )
    bulk_insert(connection, "documents", documents)

    edges = []
    for edge in snapshot.get("edges", []):
        if not edge.get("source") or not edge.get("target") or not edge.get("type"):
            continue
        edges.append(
            (
                str(edge["source"]),
                str(edge["target"]),
                str(edge["type"]).upper(),
                float(edge.get("strength") or 0.5),
                json.dumps(edge.get("properties") or {}, ensure_ascii=False),
            )
        )
    bulk_insert(connection, "memory_edges", edges)

    seed_federation(connection, contract)
    refreshed_at = now_iso()
    metadata = {
        "refreshed_at": refreshed_at,
        "source": source,
        "source_fingerprint": fingerprint(json.dumps(snapshot.get("stats") or {}, sort_keys=True)),
        "contract_version": str(contract["version"]),
    }
    for key, value in metadata.items():
        connection.execute("INSERT OR REPLACE INTO metadata VALUES (?, ?)", [key, value])
    readback = {
        "documents": connection.execute("SELECT count(*) FROM documents").fetchone()[0],
        "memory_edges": connection.execute("SELECT count(*) FROM memory_edges").fetchone()[0],
        "federation_nodes": connection.execute("SELECT count(*) FROM federation_nodes").fetchone()[0],
        "federation_edges": connection.execute("SELECT count(*) FROM federation_edges").fetchone()[0],
    }
    expected = {
        "documents": len(documents),
        "memory_edges": len(edges),
        "federation_nodes": len(contract["nodes"]),
        "federation_edges": len(contract["edges"]),
    }
    if readback != expected:
        connection.close()
        raise RuntimeError(f"refresh readback mismatch: expected={expected} actual={readback}")
    connection.close()
    return {
        "status": "OK",
        "event": "sonar_refresh",
        "documents": len(documents),
        "memory_edges": len(edges),
        "federation_nodes": len(contract["nodes"]),
        "federation_edges": len(contract["edges"]),
        "readback_verified": True,
        "refreshed_at": refreshed_at,
        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
    }


def detect_domains(query: str, contract: dict[str, Any]) -> list[str]:
    lowered = query.lower()
    domains = [
        name
        for name, config in contract["domains"].items()
        if any(keyword.lower() in lowered for keyword in config["keywords"])
    ]
    return domains or ["memory"]


def expand_aliases(query: str, contract: dict[str, Any]) -> str:
    lowered = query.lower()
    additions: list[str] = []
    for key, aliases in contract.get("aliases", {}).items():
        if key.lower() in lowered:
            additions.extend(aliases)
    return " ".join([query, *additions]).strip()


def build_probes(query: str, domains: list[str], contract: dict[str, Any]) -> list[str]:
    expanded = expand_aliases(query, contract)
    authority = " ".join(
        node
        for domain in domains
        for node in contract["domains"][domain]["required_nodes"]
    )
    probes = [query, expanded, f"{query} authority bridge provenance {authority}"]
    return list(dict.fromkeys(probe.strip() for probe in probes if probe.strip()))


def reciprocal_rank(results: list[list[int]], count: int) -> list[float]:
    scores = [0.0] * count
    for ranking in results:
        for rank, index in enumerate(ranking, start=1):
            scores[index] += 1.0 / (60.0 + rank)
    return scores


def preflight(args: argparse.Namespace) -> dict[str, Any]:
    started = time.perf_counter()
    contract = load_contract()
    connection = connect_db(Path(args.db))
    rows = connection.execute(
        "SELECT id, content, memory_type, tags_json, importance, confidence, source_ref, observed_at FROM documents"
    ).fetchall()
    if not rows:
        raise RuntimeError("Sonar index is empty; run refresh first")

    domains = detect_domains(args.query, contract)
    probes = build_probes(args.query, domains, contract)
    corpus = [tokenize(f"{row[1]} {row[3]}") for row in rows]
    bm25 = BM25Okapi(corpus)
    rankings: list[list[int]] = []
    raw_probe_results = []
    for probe in probes:
        scores = bm25.get_scores(tokenize(probe))
        ranking = sorted(range(len(rows)), key=lambda index: scores[index], reverse=True)[: args.limit]
        rankings.append(ranking)
        raw_probe_results.append(
            {
                "probe": probe,
                "results": [
                    {"id": rows[index][0], "score": round(float(scores[index]), 6)}
                    for index in ranking[:5]
                ],
            }
        )

    fused = reciprocal_rank(rankings, len(rows))
    for index, row in enumerate(rows):
        fused[index] += float(row[4] or 0.0) * 0.002
    ranked_indices = sorted(range(len(rows)), key=lambda index: fused[index], reverse=True)[: args.limit]
    selected_ids = [rows[index][0] for index in ranked_indices]

    edge_rows = []
    if selected_ids:
        placeholders = ",".join("?" for _ in selected_ids)
        edge_rows = connection.execute(
            f"""
            SELECT source, target, relation, strength
            FROM memory_edges
            WHERE source IN ({placeholders}) OR target IN ({placeholders})
            ORDER BY strength DESC
            LIMIT 100
            """,
            [*selected_ids, *selected_ids],
        ).fetchall()

    conflicts = [
        {"source": edge[0], "target": edge[1], "relation": edge[2]}
        for edge in edge_rows
        if edge[2] in {"CONTRADICTS", "INVALIDATED_BY"}
    ]
    temporal_drift = [
        {"source": edge[0], "target": edge[1], "relation": edge[2]}
        for edge in edge_rows
        if edge[2] in {"EVOLVED_INTO", "INVALIDATED_BY", "OCCURRED_BEFORE", "PRECEDED_BY"}
    ][:20]

    required_nodes = list(
        dict.fromkeys(
            node
            for domain in domains
            for node in contract["domains"][domain]["required_nodes"]
        )
    )
    federation_edges = connection.execute(
        """
        SELECT source, relation, target
        FROM federation_edges
        WHERE source IN (SELECT UNNEST(?)) OR target IN (SELECT UNNEST(?))
        ORDER BY source, relation, target
        """,
        [required_nodes, required_nodes],
    ).fetchall()
    gaps = []
    observations = []
    if any(contract["domains"][domain]["requires_live_verification"] for domain in domains):
        gaps.append("live_runtime_verification_required")
    if not conflicts:
        observations.append("no_conflict_edge_observed_in_selected_slice")

    results = []
    for index in ranked_indices:
        row = rows[index]
        results.append(
            {
                "id": row[0],
                "summary": re.sub(r"\s+", " ", row[1]).strip()[:240],
                "type": row[2],
                "tags": json.loads(row[3] or "[]")[:12],
                "score": round(fused[index], 8),
                "source_ref": row[6],
                "observed_at": row[7],
            }
        )

    run_id = f"sonar-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}"
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    output = {
        "schema_version": 1,
        "run_id": run_id,
        "status": "WARN" if gaps else "OK",
        "query": args.query,
        "domains": domains,
        "current_view": results,
        "required_bridges": [
            {"source": edge[0], "relation": edge[1], "target": edge[2]}
            for edge in federation_edges
        ],
        "conflicts": conflicts,
        "temporal_drift": temporal_drift,
        "gaps": gaps,
        "observations": observations,
        "raw_references": raw_probe_results,
        "meta": {
            "document_count": len(rows),
            "probe_count": len(probes),
            "duration_ms": duration_ms,
            "basic_memory_required": False,
            "operational_truth_checked": False,
        },
    }
    connection.execute(
        "INSERT INTO probe_runs VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            run_id,
            now_iso(),
            args.query,
            json.dumps(domains),
            json.dumps(selected_ids),
            json.dumps(gaps),
            duration_ms,
        ],
    )
    connection.close()
    write_outputs(output, Path(args.out_dir))
    return output


def markdown_output(output: dict[str, Any]) -> str:
    lines = [
        "# Local Sonar Preflight",
        "",
        f"- Run: `{output['run_id']}`",
        f"- Status: `{output['status']}`",
        f"- Domains: `{', '.join(output['domains'])}`",
        f"- Probes: `{output['meta']['probe_count']}`",
        f"- Duration: `{output['meta']['duration_ms']} ms`",
        "",
        "## Current View",
        "",
    ]
    for item in output["current_view"]:
        lines.append(f"- `{item['id']}` ({item['type']}, {item['score']}): {item['summary']}")
    lines.extend(["", "## Required Bridges", ""])
    for edge in output["required_bridges"]:
        lines.append(f"- `{edge['source']} -> {edge['relation']} -> {edge['target']}`")
    lines.extend(["", "## Conflicts", ""])
    lines.extend(
        [f"- `{edge['source']} -> {edge['relation']} -> {edge['target']}`" for edge in output["conflicts"]]
        or ["- None observed in the selected slice; this is not proof of absence."]
    )
    lines.extend(["", "## Gaps", ""])
    lines.extend([f"- `{gap}`" for gap in output["gaps"]] or ["- None."])
    lines.extend(["", "## Observations", ""])
    lines.extend([f"- `{item}`" for item in output.get("observations", [])] or ["- None."])
    return "\n".join(lines) + "\n"


def write_outputs(output: dict[str, Any], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "latest.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_dir / "latest.md").write_text(markdown_output(output), encoding="utf-8")
    with (out_dir / "runs.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(output, ensure_ascii=False) + "\n")


def status(args: argparse.Namespace) -> dict[str, Any]:
    connection = connect_db(Path(args.db))
    counts = {
        "documents": connection.execute("SELECT count(*) FROM documents").fetchone()[0],
        "memory_edges": connection.execute("SELECT count(*) FROM memory_edges").fetchone()[0],
        "federation_nodes": connection.execute("SELECT count(*) FROM federation_nodes").fetchone()[0],
        "federation_edges": connection.execute("SELECT count(*) FROM federation_edges").fetchone()[0],
        "probe_runs": connection.execute("SELECT count(*) FROM probe_runs").fetchone()[0],
    }
    metadata = dict(connection.execute("SELECT key, value FROM metadata").fetchall())
    connection.close()
    return {"status": "OK" if counts["documents"] else "WARN", "counts": counts, "metadata": metadata}


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    root.add_argument("command", choices=["refresh", "preflight", "status"])
    root.add_argument("--db", default=str(DEFAULT_DB))
    root.add_argument("--out-dir", default=str(DEFAULT_OUT))
    root.add_argument("--api-url", default=os.getenv("AUTOMEM_API_URL", "http://127.0.0.1:8001"))
    root.add_argument("--snapshot-file", default="")
    root.add_argument("--query", default="")
    root.add_argument("--limit", type=int, default=8)
    return root


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "refresh":
            output = refresh(args)
        elif args.command == "preflight":
            if not args.query.strip():
                raise ValueError("--query is required for preflight")
            output = preflight(args)
        else:
            output = status(args)
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:  # noqa: BLE001 - CLI boundary
        print(json.dumps({"status": "FAIL", "reason": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
