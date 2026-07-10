import argparse
import datetime as dt
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request


DB_PATH = os.environ.get("STATE_DB_PATH", "/data/state.db")
PACKET_DIR = os.environ.get("STATE_PACKET_DIR", "/outputs/state_packets")
LOOP_INTERVAL_SECONDS = int(os.environ.get("OBSERVATORY_INTERVAL_SECONDS", "900"))
AUTOMEM_HEALTH_URL = os.environ.get(
    "AUTOMEM_HEALTH_URL", "http://host.docker.internal:8001/health"
)

ENDPOINTS = {
    "noaa_scales": "https://services.swpc.noaa.gov/products/noaa-scales.json",
    "noaa_alerts": "https://services.swpc.noaa.gov/products/alerts.json",
    "openai_status": "https://status.openai.com/api/v2/summary.json",
    "automem_health": AUTOMEM_HEALTH_URL,
}


def utc_now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def iso_now():
    return utc_now().isoformat().replace("+00:00", "Z")


def connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("pragma journal_mode=wal")
    conn.execute(
        """
        create table if not exists observations (
            id integer primary key autoincrement,
            ts_utc text not null,
            source text not null,
            signal_type text not null,
            value_num real,
            value_text text,
            unit text,
            location text,
            confidence real not null default 0.8,
            label text,
            raw_ref text,
            raw_json text,
            created_at text not null
        )
        """
    )
    conn.execute(
        """
        create table if not exists source_health (
            id integer primary key autoincrement,
            ts_utc text not null,
            source text not null,
            status text not null,
            latency_ms integer,
            error_text text,
            created_at text not null
        )
        """
    )
    conn.commit()
    return conn


def fetch_json(name, url, timeout=15):
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            payload = response.read()
        latency_ms = int((time.perf_counter() - started) * 1000)
        return json.loads(payload.decode("utf-8")), latency_ms, None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        return None, latency_ms, f"{type(exc).__name__}: {exc}"


def record_health(conn, source, status, latency_ms=None, error_text=None):
    now = iso_now()
    conn.execute(
        """
        insert into source_health
        (ts_utc, source, status, latency_ms, error_text, created_at)
        values (?, ?, ?, ?, ?, ?)
        """,
        (now, source, status, latency_ms, error_text, now),
    )


def record_observation(
    conn,
    source,
    signal_type,
    value_num=None,
    value_text=None,
    unit=None,
    location=None,
    confidence=0.8,
    label=None,
    raw_ref=None,
    raw_json=None,
):
    now = iso_now()
    conn.execute(
        """
        insert into observations
        (ts_utc, source, signal_type, value_num, value_text, unit, location,
         confidence, label, raw_ref, raw_json, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            now,
            source,
            signal_type,
            value_num,
            value_text,
            unit,
            location,
            confidence,
            label,
            raw_ref,
            json.dumps(raw_json, ensure_ascii=False) if raw_json is not None else None,
            now,
        ),
    )


def as_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def collect_noaa_scales(conn, payload):
    current = payload.get("0", {}) if isinstance(payload, dict) else {}
    forecast = payload.get("1", {}) if isinstance(payload, dict) else {}
    for key in ("R", "S", "G"):
        item = current.get(key, {}) or {}
        record_observation(
            conn,
            "noaa_swpc",
            f"{key}_scale_current",
            value_num=as_float(item.get("Scale")),
            value_text=item.get("Text"),
            unit="NOAA scale",
            confidence=0.95,
            label="space_weather",
            raw_ref=ENDPOINTS["noaa_scales"],
            raw_json=item,
        )
    for key in ("R", "S"):
        item = forecast.get(key, {}) or {}
        prob_key = "MinorProb" if key == "R" else "Prob"
        record_observation(
            conn,
            "noaa_swpc",
            f"{key}_forecast_probability",
            value_num=as_float(item.get(prob_key)),
            value_text=item.get(prob_key),
            unit="percent",
            confidence=0.9,
            label="space_weather_forecast",
            raw_ref=ENDPOINTS["noaa_scales"],
            raw_json=item,
        )


def collect_noaa_alerts(conn, payload):
    if not isinstance(payload, list):
        return
    record_observation(
        conn,
        "noaa_swpc",
        "alert_count",
        value_num=len(payload),
        value_text=str(len(payload)),
        unit="count",
        confidence=0.9,
        label="space_weather_alerts",
        raw_ref=ENDPOINTS["noaa_alerts"],
    )
    for alert in payload[:5]:
        message = alert.get("message") or alert.get("product_id") or "alert"
        record_observation(
            conn,
            "noaa_swpc",
            "alert_recent",
            value_text=message[:500],
            confidence=0.75,
            label="space_weather_alert",
            raw_ref=ENDPOINTS["noaa_alerts"],
            raw_json=alert,
        )


def collect_openai_status(conn, payload):
    status = payload.get("status", {}) if isinstance(payload, dict) else {}
    components = payload.get("components", []) if isinstance(payload, dict) else []
    degraded = [
        c for c in components
        if c.get("status") not in (None, "operational")
    ]
    record_observation(
        conn,
        "openai_status",
        "overall_status",
        value_text=status.get("description"),
        confidence=0.95,
        label=status.get("indicator"),
        raw_ref=ENDPOINTS["openai_status"],
        raw_json=status,
    )
    record_observation(
        conn,
        "openai_status",
        "degraded_component_count",
        value_num=len(degraded),
        value_text=str(len(degraded)),
        unit="count",
        confidence=0.95,
        label="vendor_status",
        raw_ref=ENDPOINTS["openai_status"],
        raw_json=degraded[:20],
    )


def collect_automem_health(conn, payload):
    if not isinstance(payload, dict):
        return
    for key in ("memory_count", "vector_count"):
        record_observation(
            conn,
            "automem_local",
            key,
            value_num=as_float(payload.get(key)),
            value_text=str(payload.get(key)),
            unit="count",
            confidence=0.95,
            label="local_memory",
            raw_ref=AUTOMEM_HEALTH_URL,
        )
    for key in ("status", "sync_status", "falkordb", "qdrant"):
        record_observation(
            conn,
            "automem_local",
            key,
            value_text=str(payload.get(key)),
            confidence=0.95,
            label="local_memory",
            raw_ref=AUTOMEM_HEALTH_URL,
            raw_json=payload.get(key),
        )


def collect_once(conn):
    handlers = {
        "noaa_scales": collect_noaa_scales,
        "noaa_alerts": collect_noaa_alerts,
        "openai_status": collect_openai_status,
        "automem_health": collect_automem_health,
    }
    for name, url in ENDPOINTS.items():
        payload, latency_ms, error = fetch_json(name, url)
        if error:
            record_health(conn, name, "error", latency_ms, error)
            continue
        record_health(conn, name, "ok", latency_ms, None)
        handlers[name](conn, payload)
    conn.commit()


def latest_observations(conn, limit=30):
    return conn.execute(
        """
        select ts_utc, source, signal_type, coalesce(value_text, value_num),
               unit, label, confidence
        from observations
        order by id desc
        limit ?
        """,
        (limit,),
    ).fetchall()


def latest_health(conn, limit=12):
    return conn.execute(
        """
        select ts_utc, source, status, latency_ms, error_text
        from source_health
        order by id desc
        limit ?
        """,
        (limit,),
    ).fetchall()


def compact_text(value, limit=220):
    if value is None:
        return ""
    text = " ".join(str(value).split())
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def write_packet(conn):
    os.makedirs(PACKET_DIR, exist_ok=True)
    stamp = utc_now().strftime("%Y-%m-%d_%H%M%SZ")
    path = os.path.join(PACKET_DIR, f"{stamp}.md")
    observations = latest_observations(conn)
    health = latest_health(conn)
    lines = [
        "# Local State Packet",
        "",
        f"Generated: {iso_now()}",
        "",
        "## Source Health",
        "",
    ]
    for row in health:
        ts, source, status, latency_ms, error_text = row
        latency = f"{latency_ms} ms" if latency_ms is not None else "n/a"
        tail = f" - {compact_text(error_text, 180)}" if error_text else ""
        lines.append(f"- {ts} `{source}`: {status}, {latency}{tail}")
    lines.extend(["", "## Latest Observations", ""])
    for row in observations:
        ts, source, signal, value, unit, label, confidence = row
        unit_text = f" {unit}" if unit else ""
        label_text = f" [{label}]" if label else ""
        lines.append(
            f"- {ts} `{source}/{signal}`: {compact_text(value)}{unit_text}{label_text}, confidence {confidence}"
        )
    lines.extend(
        [
            "",
            "## Interpretation Guardrails",
            "",
            "- Treat this as telemetry, not proof.",
            "- Promote only cross-checked DIFFs into AutoMem.",
            "- Keep raw time series in SQLite to reduce context pressure.",
        ]
    )
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    print(path)


def run_loop(conn):
    print(
        f"stateful-agent-net loop started: interval={LOOP_INTERVAL_SECONDS}s",
        flush=True,
    )
    while True:
        started = time.time()
        try:
            collect_once(conn)
            write_packet(conn)
        except Exception as exc:
            print(f"collector loop error: {type(exc).__name__}: {exc}", flush=True)
        elapsed = time.time() - started
        sleep_for = max(5, LOOP_INTERVAL_SECONDS - int(elapsed))
        time.sleep(sleep_for)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["collect", "packet", "once", "loop"])
    args = parser.parse_args()
    conn = connect()
    if args.command == "loop":
        run_loop(conn)
        return
    if args.command in ("collect", "once"):
        collect_once(conn)
    if args.command in ("packet", "once"):
        write_packet(conn)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
