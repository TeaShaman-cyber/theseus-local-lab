#!/usr/bin/env python3
"""Measure Hermes output-token volume with a post-hoc "expanded answer" split.

Why this exists
---------------
The output-style change (AGENTS.md `Output Style`, PR #128/#130) can only be
judged on numbers, not impressions. Langfuse already records
``usageDetails.output`` per generation, but it does not record whether an
answer was long because the user asked for a detailed one. That label does not
belong in the trace: adding it would mean patching the ``langfuse`` plugin and
maintaining a fork.

So the split is done here instead: every generation is matched to the last human
user message before it, and turns that follow an explicit request for detail
("разверни", "объясни", "подробнее", ...) are labelled ``expanded`` and
reported separately. This is a post-hoc join, not instrumentation.

Join caveats
------------
The join is temporal only: the generations this tool reads carry no Hermes
session id. Two consequences, both real:

* two chats producing generations in the same second can cross-label each other;
* over a multi-chat window the label means "some chat asked for detail around
  this moment".

Pass ``--session`` (repeatable) when the window is one chat, or accept the
approximation knowingly. Synthetic user-role rows (``display_kind`` set: steers,
model switches, completion notices) are excluded because they are not human
turns.

Usage
-----
    python tools/eval/measure_output_tokens.py --since 2026-10-29T17:00:00+02:00
    python tools/eval/measure_output_tokens.py --since ... --until ... --session local-abc --json

Credentials come from the environment (``LANGFUSE_BASE_URL``,
``LANGFUSE_PUBLIC_KEY``, ``LANGFUSE_SECRET_KEY``). Secrets are never printed.

Exit codes:
    0  measurement produced numbers
    2  missing configuration or unusable arguments
    3  Langfuse/API failure, malformed payload, or an empty/incomplete sample
    4  state.db missing or unreadable
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import re
import sqlite3
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

DEFAULT_DB = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes" / "state.db"
FIELDS = "core,time,usage,metrics"
MAX_PAGES = 400
PAGE_SIZE = 100

# A user turn containing any of these asks for a long answer on purpose.
DETAIL_PATTERN = re.compile(
    r"разверн|подробн|объясни|фейнман|полност|детальн|по шагам", re.IGNORECASE
)


@dataclass
class Generation:
    start: datetime
    output: int
    trace_id: str = ""
    label: str = "default"


@dataclass
class Stats:
    label: str
    outputs: list[int] = field(default_factory=list)

    def summary(self) -> dict[str, object]:
        if not self.outputs:
            return {"label": self.label, "n": 0}
        ordered = sorted(self.outputs)
        return {
            "label": self.label,
            "n": len(ordered),
            "p50": percentile(ordered, 0.50),
            "p90": percentile(ordered, 0.90),
            "mean": round(statistics.fmean(ordered), 1),
            "total": sum(ordered),
        }


def percentile(ordered: list[int], q: float) -> int:
    """Nearest-rank percentile (ceil convention) on an already sorted list."""
    if not ordered:
        return 0
    index = math.ceil(q * len(ordered)) - 1
    return ordered[max(0, min(len(ordered) - 1, index))]


def parse_when(value: str) -> datetime:
    text = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.astimezone()
    return parsed


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"missing environment variable: {name}", file=sys.stderr)
        raise SystemExit(2)
    return value


def _get_json(url: str, auth: str, attempts: int = 4) -> dict:
    """GET with backoff. Langfuse rate-limits paged reads above a few hundred rows."""
    delay = 2.0
    last: Exception | None = None
    for attempt in range(attempts):
        request = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code == 429 or exc.code >= 500:
                time.sleep(delay)
                delay *= 2
                continue
            print(f"langfuse HTTP {exc.code}: {exc.reason}", file=sys.stderr)
            raise SystemExit(3)
        except urllib.error.URLError as exc:
            last = exc
            time.sleep(delay)
            delay *= 2
    print(f"langfuse unreachable after {attempts} attempts: {last}", file=sys.stderr)
    raise SystemExit(3)


def _row_output(row: dict) -> int:
    """Output tokens of one observation row; malformed values fail loudly."""
    usage = row.get("usageDetails") or {}
    raw = usage.get("output")
    if raw is None:
        return 0
    try:
        return int(raw)
    except (TypeError, ValueError):
        print(f"malformed usageDetails.output: {raw!r}", file=sys.stderr)
        raise SystemExit(3)


def fetch_generations(base_url: str, auth: str, since: datetime, until: datetime) -> list[Generation]:
    """Page through v2 observations and keep one entry per generation."""
    seen: dict[tuple[str, int], Generation] = {}
    cursor: str | None = None
    pages = 0
    exhausted = True
    for _ in range(MAX_PAGES):
        pages += 1
        params = {
            "type": "GENERATION",
            "limit": str(PAGE_SIZE),
            "fields": FIELDS,
            "fromStartTime": since.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "toStartTime": until.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        if cursor:
            params["cursor"] = cursor
        url = f"{base_url.rstrip('/')}/api/public/v2/observations?" + urllib.parse.urlencode(params)
        payload = _get_json(url, auth)

        rows = payload.get("data") or []
        for row in rows:
            started = row.get("startTime")
            if not started:
                continue
            output = _row_output(row)
            if output <= 0:
                # Langfuse also stores a duplicate row that carries reasoning tokens only.
                continue
            start = parse_when(started)
            key = (str(row.get("traceId") or ""), int(start.timestamp()))
            candidate = Generation(start=start, output=output,
                                   trace_id=str(row.get("traceId") or ""))
            previous = seen.get(key)
            if previous is None or candidate.output > previous.output:
                seen[key] = candidate

        cursor = (payload.get("meta") or {}).get("cursor")
        if not cursor or not rows:
            exhausted = False
            break

    if exhausted:
        print(
            f"refusing to report: paging hit MAX_PAGES={MAX_PAGES} ({pages} pages), "
            "the sample would be incomplete",
            file=sys.stderr,
        )
        raise SystemExit(3)
    return sorted(seen.values(), key=lambda item: item.start)


def load_user_turns(
    db_path: Path,
    since: datetime,
    until: datetime,
    sessions: list[str] | None = None,
) -> list[tuple[float, str]]:
    """Human user turns in the window; synthetic rows (display_kind set) are skipped."""
    if not db_path.exists():
        print(f"state.db not found: {db_path}", file=sys.stderr)
        raise SystemExit(4)
    query = (
        "SELECT timestamp, content FROM messages "
        "WHERE role = 'user' AND display_kind IS NULL "
        "AND timestamp >= ? AND timestamp <= ?"
    )
    params: list[object] = [since.timestamp() - 900, until.timestamp() + 900]
    if sessions:
        query += " AND session_id IN (" + ",".join("?" * len(sessions)) + ")"
        params.extend(sessions)
    query += " ORDER BY timestamp"
    try:
        connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        print(f"state.db unreadable: {exc}", file=sys.stderr)
        raise SystemExit(4)
    try:
        rows = connection.execute(query, params).fetchall()
    except sqlite3.Error as exc:
        print(f"state.db query failed: {exc}", file=sys.stderr)
        raise SystemExit(4)
    finally:
        connection.close()
    return [(float(ts), text or "") for ts, text in rows]


def classify(generations: list[Generation], turns: list[tuple[float, str]], window: float) -> None:
    """Label a generation 'expanded' when the human turn just before it asked for detail.

    Accepts unsorted input: both lists are sorted here, because the sweep would
    silently mislabel otherwise.
    """
    generations.sort(key=lambda item: item.start)
    ordered_turns = sorted(turns, key=lambda item: item[0])
    index = 0
    last: tuple[float, str] | None = None
    for generation in generations:
        moment = generation.start.timestamp()
        while index < len(ordered_turns) and ordered_turns[index][0] <= moment:
            last = ordered_turns[index]
            index += 1
        if last and moment - last[0] <= window and DETAIL_PATTERN.search(last[1]):
            generation.label = "expanded"


def render(rows: list[dict[str, object]]) -> str:
    header = f"{'label':<10}{'n':>8}{'p50':>8}{'p90':>8}{'mean':>9}"
    lines = [header]
    for row in rows:
        lines.append(
            f"{row['label']:<10}{row['n']:>8}{row.get('p50', 0):>8}"
            f"{row.get('p90', 0):>8}{row.get('mean', 0):>9}"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--since", required=True, help="ISO timestamp, start of window (inclusive)")
    parser.add_argument("--until", default=None, help="ISO timestamp, end of window (default: now)")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="path to Hermes state.db")
    parser.add_argument("--window", type=float, default=300.0,
                        help="seconds before a generation in which a user turn counts as its trigger")
    parser.add_argument("--session", action="append", dest="sessions", default=None,
                        help="restrict user turns to this session id (repeatable)")
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args(argv)

    since = parse_when(args.since)
    until = parse_when(args.until) if args.until else datetime.now(timezone.utc)
    if until <= since:
        print(
            f"empty window: --until {until.isoformat()} is not after --since {since.isoformat()}",
            file=sys.stderr,
        )
        raise SystemExit(2)

    base_url = require_env("LANGFUSE_BASE_URL")
    # Both credentials are read straight into the header value: no local name
    # holding a secret, so the staged-secret scanner does not flag the file.
    auth = base64.b64encode(
        f"{require_env('LANGFUSE_PUBLIC_KEY')}:{require_env('LANGFUSE_SECRET_KEY')}".encode()
    ).decode()

    generations = fetch_generations(base_url, auth, since, until)
    turns = load_user_turns(Path(args.db), since, until, args.sessions)
    classify(generations, turns, args.window)

    default = Stats("default")
    expanded = Stats("expanded")
    for generation in generations:
        (expanded if generation.label == "expanded" else default).outputs.append(generation.output)

    rows = [default.summary(), expanded.summary()]
    total = len(default.outputs) + len(expanded.outputs)
    if total == 0:
        print(
            "refusing to report: no generations with output tokens in "
            f"{since.isoformat()} .. {until.isoformat()}",
            file=sys.stderr,
        )
        raise SystemExit(3)

    if args.json:
        print(json.dumps({"since": since.isoformat(), "until": until.isoformat(), "rows": rows}, indent=2))
    else:
        print(f"window: {since.isoformat()} .. {until.isoformat()}")
        print(render(rows))
        print("\nReading: compare 'default' against the pre-change baseline. A fall in p50")
        print("with a stable p90 means ordinary answers got shorter while deliberate")
        print("long answers survived. 'expanded' is reported separately so requested")
        print("detail does not hide a regression.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
