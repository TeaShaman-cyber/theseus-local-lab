#!/usr/bin/env python3
"""Persistent, read-only MCP facade for the local Sonar preflight."""

from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from mcp.server.fastmcp import FastMCP

import sonar_local


SERVER_NAME = "Theseus Local Sonar"
DEFAULT_MAX_AGE_SECONDS = 300
QUERY_LIMIT = 4000
LOCK = threading.RLock()

mcp = FastMCP(
    SERVER_NAME,
    instructions=(
        "Read-only federation preflight over AutoMem. Use it to retrieve a small "
        "evidence slice, authority bridges, conflicts, temporal drift, and explicit "
        "gaps. Sonar never overrides user intent or live operational verification."
    ),
)


def index_age_seconds(metadata: dict[str, Any]) -> float | None:
    value = metadata.get("refreshed_at")
    if not value:
        return None
    try:
        observed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if observed.tzinfo is None:
            observed = observed.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - observed).total_seconds())
    except ValueError:
        return None


def status_args() -> SimpleNamespace:
    return SimpleNamespace(db=str(sonar_local.DEFAULT_DB))


def refresh_args() -> SimpleNamespace:
    return SimpleNamespace(
        snapshot_file="",
        api_url=os.getenv("AUTOMEM_API_URL", "http://127.0.0.1:8001"),
        db=str(sonar_local.DEFAULT_DB),
    )


def preflight_args(query: str, limit: int) -> SimpleNamespace:
    return SimpleNamespace(
        query=query,
        limit=limit,
        db=str(sonar_local.DEFAULT_DB),
        out_dir=str(sonar_local.DEFAULT_OUT),
    )


def ensure_fresh(max_age_seconds: int) -> dict[str, Any] | None:
    current = sonar_local.status(status_args())
    age = index_age_seconds(current.get("metadata", {}))
    if current["counts"]["documents"] and age is not None and age <= max_age_seconds:
        return None
    return sonar_local.refresh(refresh_args())


def compact_packet(output: dict[str, Any], refresh_event: dict[str, Any] | None) -> dict[str, Any]:
    gaps = output.get("gaps", [])
    return {
        "status": output["status"],
        "query": output["query"],
        "domains": output["domains"],
        "evidence": [
            {
                "id": item["id"],
                "type": item["type"],
                "summary": item["summary"][:180],
                "score": item["score"],
                "source_ref": item["source_ref"],
            }
            for item in output["current_view"][:5]
        ],
        "required_bridges": output["required_bridges"][:8],
        "conflicts": output["conflicts"][:5],
        "temporal_drift": output["temporal_drift"][:5],
        "temporal_drift_count": len(output["temporal_drift"]),
        "gaps": gaps,
        "observations": output.get("observations", []),
        "recommendation": "verify_live_runtime" if gaps else "continue_with_route",
        "receipt": str(Path(sonar_local.DEFAULT_OUT) / "latest.json"),
        "meta": {
            "run_id": output["run_id"],
            "document_count": output["meta"]["document_count"],
            "probe_count": output["meta"]["probe_count"],
            "duration_ms": output["meta"]["duration_ms"],
            "index_refreshed": refresh_event is not None,
            "basic_memory_required": False,
            "operational_truth_checked": False,
        },
    }


@mcp.tool()
def sonar_status() -> dict[str, Any]:
    """Return index health, counts, age, and the local authority boundary."""
    with LOCK:
        current = sonar_local.status(status_args())
    current["server"] = SERVER_NAME
    current["index_age_seconds"] = index_age_seconds(current.get("metadata", {}))
    current["authority"] = {
        "semantic_memory": "AutoMem",
        "episodic_memory": "MemPalace",
        "index": "DuckDB rebuildable cache",
        "operational_truth": "live runtime, Git, files, and tests",
        "basic_memory_required": False,
    }
    return current


@mcp.tool()
def sonar_refresh() -> dict[str, Any]:
    """Refresh the rebuildable DuckDB index from the authenticated AutoMem snapshot."""
    with LOCK:
        return sonar_local.refresh(refresh_args())


@mcp.tool()
def sonar_preflight(
    query: str,
    limit: int = 5,
    refresh_if_stale: bool = True,
    max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS,
) -> dict[str, Any]:
    """Retrieve a compact route/evidence packet without executing or mutating the route."""
    clean_query = " ".join(query.split())
    if not clean_query:
        raise ValueError("query must not be empty")
    if len(clean_query) > QUERY_LIMIT:
        raise ValueError(f"query exceeds {QUERY_LIMIT} characters")
    safe_limit = max(3, min(int(limit), 8))
    safe_age = max(30, min(int(max_age_seconds), 86400))
    with LOCK:
        refresh_event = ensure_fresh(safe_age) if refresh_if_stale else None
        output = sonar_local.preflight(preflight_args(clean_query, safe_limit))
    return compact_packet(output, refresh_event)


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
