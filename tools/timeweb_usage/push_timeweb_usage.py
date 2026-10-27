"""Timeweb Cloud account finance -> Loki. Rubles, never converted to dollars."""
from __future__ import annotations

import argparse
import base64
import json
import math
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools' / 'deepinfra_usage'))
from push_deepinfra_usage import loki_credentials  # noqa: E402

API = 'https://api.timeweb.cloud/api/v1/account/finances'
TIMEOUT = 30

# field in the API response -> metric suffix
FIELDS = {
    'balance': 'balance_rub',
    'total_balance': 'total_balance_rub',
    'monthly_cost': 'monthly_cost_rub',
    'hourly_cost': 'hourly_cost_rub',
    'hours_left': 'hours_left',
    'total_paid': 'total_paid_rub',
}


def hermes_home() -> Path:
    return Path(os.environ.get('HERMES_HOME', str(Path(os.environ['LOCALAPPDATA']) / 'hermes')))


def env_value(key: str) -> str:
    """Environment first, then the Hermes .env file. Never logs the value."""
    value = os.environ.get(key, '').strip()
    if value:
        return value
    env_file = hermes_home() / '.env'
    if not env_file.exists():
        return ''
    for raw in env_file.read_text(encoding='utf-8', errors='ignore').splitlines():
        line = raw.strip()
        if line.startswith(f'{key}=') and '=' in line:
            return line.split('=', 1)[1].strip().strip('"').strip("'")
    return ''


def build_lines(payload, now):
    """Turn the API payload into logfmt metrics. Missing numbers stay unknown."""
    lines = [f'metric=sample_timestamp_seconds value={now}']
    finances = None
    if isinstance(payload, dict):
        finances = payload.get('finances')
    ok = isinstance(finances, dict)
    lines.append(f'metric=read_ok value={int(ok)}')
    if not ok:
        return lines
    lines.append(f'metric=last_success_timestamp_seconds value={now}')
    for field, metric in FIELDS.items():
        value = finances.get(field)
        known = type(value) in (int, float) and math.isfinite(value)
        lines.append(f'metric={metric}_known value={int(known)}')
        if known:
            lines.append(f'metric={metric} value={value:.4f}')
    return lines


def fetch(token: str) -> dict:
    request = urllib.request.Request(API, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.load(response)


def push(lines: list[str]) -> int:
    url, user, password = loki_credentials()
    payload = {'streams': [{
        'stream': {'service_name': 'timeweb', 'log_type': 'billing', 'job': 'timeweb-account'},
        'values': [[str(time.time_ns()), line] for line in lines],
    }]}
    auth_value = base64.b64encode(f'{user}:{password}'.encode()).decode()
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode(), method='POST',
        headers={'Content-Type': 'application/json', 'Authorization': f'Basic {auth_value}'},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.status


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    creds = env_value('TW_API_KEY')
    payload, error = None, ''
    if not creds:
        error = 'missing TW_API_KEY'
    else:
        try:
            payload = fetch(creds)
        except urllib.error.HTTPError as exc:
            error = f'http_{exc.code}'
        except Exception as exc:  # noqa: BLE001 - any transport failure is "no reading"
            error = type(exc).__name__

    lines = build_lines(payload, int(time.time()))
    log_path = hermes_home() / 'cache' / 'timeweb_usage.log'
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open('a', encoding='utf-8') as log:
        log.write(('account_read_error=%s\n' % error) if error else 'account_read_ok\n')

    if args.dry_run:
        print('\n'.join(lines))
    else:
        try:
            print(f'loki={push(lines)} lines={len(lines)}')
        except Exception as exc:  # noqa: BLE001
            print(f'loki_error={type(exc).__name__}', file=sys.stderr)
            return 4
    return 0 if payload else 3


if __name__ == '__main__':
    raise SystemExit(main())
