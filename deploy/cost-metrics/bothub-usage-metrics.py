#!/usr/bin/env python3
"""BotHub per-model spend -> Prometheus textfile metrics.

BotHub's official usage report (/api/v2/transaction/usage-report) returns an
xlsx where every row is one request with its charged CAPS, model_id, provider
and token counts. That makes per-model spend a provider FACT, not our estimate.

Parsed with the standard library only (xlsx is a zip of XML), so the scheduled
task needs no extra packages. The API token is read from the Hermes .env and is
never printed.
"""

from __future__ import annotations

import collections
import datetime as dt
import os
import pathlib
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
import io

ENV = pathlib.Path(os.path.expanduser("~")) / "AppData/Local/hermes/.env"
OUT = pathlib.Path(r"C:\Apps\theseus-metrics\bothub-models.prom")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def read_key() -> str:
    for line in ENV.read_text(encoding="utf-8", errors="ignore").splitlines():
        for name in ("BOTHUB_API_KEY=", "HINDSIGHT_BOTHUB_KEY="):
            if line.startswith(name):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("no BotHub key in .env")


def fetch_report(key: str, days: int = 7) -> bytes:
    now = dt.datetime.now(dt.UTC).replace(tzinfo=None)
    start = now - dt.timedelta(days=days)
    url = (
        "https://bothub.chat/api/v2/transaction/usage-report"
        f"?from={start.strftime('%Y-%m-%dT%H:%M:%S')}Z&to={now.strftime('%Y-%m-%dT%H:%M:%S')}Z"
    )
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + key,
                                               "User-Agent": "theseus-metrics"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(t.text or "" for t in si.iter(NS + "t")) for si in root.findall(NS + "si")]


def col_index(ref: str) -> int:
    letters = "".join(c for c in ref if c.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def parse_rows(data: bytes) -> list[dict[str, str]]:
    zf = zipfile.ZipFile(io.BytesIO(data))
    strings = shared_strings(zf)
    sheets = [n for n in zf.namelist() if n.startswith("xl/worksheets/sheet")]
    root = ET.fromstring(zf.read(sorted(sheets)[0]))

    rows: list[list[str]] = []
    for row in root.iter(NS + "row"):
        values: dict[int, str] = {}
        for cell in row.findall(NS + "c"):
            idx = col_index(cell.get("r", "A1"))
            v = cell.find(NS + "v")
            if v is None:
                values[idx] = ""
                continue
            if cell.get("t") == "s":
                values[idx] = strings[int(v.text)] if v.text else ""
            else:
                values[idx] = v.text or ""
        if values:
            width = max(values) + 1
            rows.append([values.get(i, "") for i in range(width)])

    if not rows:
        return []
    header = [h.strip() for h in rows[0]]
    out = []
    for r in rows[1:]:
        out.append({header[i]: (r[i] if i < len(r) else "") for i in range(len(header))})
    return out


def main() -> None:
    key = read_key()
    rows = parse_rows(fetch_report(key))

    caps = collections.Counter()
    prompt = collections.Counter()
    completion = collections.Counter()
    cached = collections.Counter()
    requests = collections.Counter()

    for r in rows:
        model = (r.get("model_id") or "unknown").strip() or "unknown"
        try:
            c = float(r.get("CAPS") or 0)
        except ValueError:
            c = 0.0
        caps[model] += c
        requests[model] += 1
        for src, dst in (("Prompt tokens", prompt), ("Completion Tokens", completion), ("Cached Tokens", cached)):
            try:
                dst[model] += float(r.get(src) or 0)
            except ValueError:
                pass

    lines = [
        "# HELP bothub_caps_spent CAPS charged by BotHub per model over the report window",
        "# TYPE bothub_caps_spent gauge",
    ]
    for m, v in caps.most_common():
        lines.append(f'bothub_caps_spent{{model="{m}"}} {v:.4f}')
    lines += [
        "# HELP bothub_requests Requests charged by BotHub per model",
        "# TYPE bothub_requests gauge",
    ]
    for m, v in requests.most_common():
        lines.append(f'bothub_requests{{model="{m}"}} {v}')
    lines += [
        "# HELP bothub_prompt_tokens Prompt tokens per model",
        "# TYPE bothub_prompt_tokens gauge",
    ]
    for m, v in prompt.most_common():
        lines.append(f'bothub_prompt_tokens{{model="{m}"}} {v:.0f}')
    lines += [
        "# HELP bothub_completion_tokens Completion tokens per model",
        "# TYPE bothub_completion_tokens gauge",
    ]
    for m, v in completion.most_common():
        lines.append(f'bothub_completion_tokens{{model="{m}"}} {v:.0f}')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".prom.tmp")
    # The Prometheus text format requires a trailing newline; without it the
    # textfile collector fails with "unexpected end of input stream".
    tmp.write_text("\n".join(lines) + "\n", encoding="ascii")
    tmp.replace(OUT)
    print(f"bothub-models.prom: {len(rows)} rows, {len(caps)} models, "
          f"total caps {sum(caps.values()):.2f}")


if __name__ == "__main__":
    main()
