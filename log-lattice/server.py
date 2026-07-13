#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import sqlite3
import time

DB_PATH = Path(os.environ.get("THESEUS_LOG_DB", "/data/events.sqlite"))


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            local_time TEXT,
            source TEXT NOT NULL,
            event TEXT NOT NULL,
            note TEXT,
            context_percent REAL,
            limit_percent_remaining REAL,
            tags_json TEXT,
            artifacts_json TEXT,
            metrics_json TEXT,
            raw_json TEXT NOT NULL,
            ingested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_source ON events(source)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_event ON events(event)")
    conn.commit()
    return conn


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def parse_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_event(payload):
    if not isinstance(payload, dict):
        raise ValueError("event body must be a JSON object")
    created_at = payload.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    source = str(payload.get("source") or "manual")[:80]
    event = str(payload.get("event") or "note")[:120]
    note = str(payload.get("note") or "")[:4000]
    tags = payload.get("tags") if isinstance(payload.get("tags"), list) else []
    artifacts = payload.get("artifacts") if isinstance(payload.get("artifacts"), list) else []
    metrics = payload.get("metrics") if isinstance(payload.get("metrics"), dict) else {}
    return {
        "created_at": created_at,
        "local_time": payload.get("local_time"),
        "source": source,
        "event": event,
        "note": note,
        "context_percent": parse_float(payload.get("context_percent")),
        "limit_percent_remaining": parse_float(payload.get("limit_percent_remaining")),
        "tags": tags,
        "artifacts": artifacts,
        "metrics": metrics,
        "raw": payload,
    }


def insert_event(payload):
    event = normalize_event(payload)
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO events (
                created_at, local_time, source, event, note,
                context_percent, limit_percent_remaining,
                tags_json, artifacts_json, metrics_json, raw_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event["created_at"],
                event["local_time"],
                event["source"],
                event["event"],
                event["note"],
                event["context_percent"],
                event["limit_percent_remaining"],
                json.dumps(event["tags"], ensure_ascii=False),
                json.dumps(event["artifacts"], ensure_ascii=False),
                json.dumps(event["metrics"], ensure_ascii=False),
                json.dumps(event["raw"], ensure_ascii=False),
            ),
        )
        conn.commit()
        return cursor.lastrowid


def query_events(params):
    limit = min(int(params.get("limit", ["50"])[0]), 500)
    filters = []
    values = []
    for key in ("source", "event"):
        value = params.get(key, [""])[0]
        if value:
            filters.append(f"{key} = ?")
            values.append(value)
    since = params.get("since", [""])[0]
    if since:
        filters.append("created_at >= ?")
        values.append(since)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT id, created_at, local_time, source, event, note,
                   context_percent, limit_percent_remaining,
                   tags_json, artifacts_json, metrics_json, ingested_at
            FROM events
            {where}
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            [*values, limit],
        ).fetchall()
    return [dict(row) for row in rows]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            json_response(self, 200, {"ok": True, "db": str(DB_PATH)})
            return
        if parsed.path == "/events":
            try:
                json_response(self, 200, {"events": query_events(parse_qs(parsed.query))})
            except Exception as exc:
                json_response(self, 400, {"ok": False, "error": str(exc)})
            return
        json_response(self, 404, {"ok": False, "error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/events":
            json_response(self, 404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            row_id = insert_event(payload)
            json_response(self, 201, {"ok": True, "id": row_id})
        except Exception as exc:
            json_response(self, 400, {"ok": False, "error": str(exc)})


if __name__ == "__main__":
    connect().close()
    server = ThreadingHTTPServer(("0.0.0.0", 8768), Handler)
    print(f"log-lattice listening on 0.0.0.0:8768 db={DB_PATH}", flush=True)
    server.serve_forever()

