# Timeweb Cloud account monitor

`push_timeweb_usage.py` reads `GET https://api.timeweb.cloud/api/v1/account/finances`
and pushes Ruble metrics to the existing Grafana Loki endpoint.

Runs as Windows Task Scheduler task `Theseus Timeweb billing`, every 30 minutes,
using Hermes' Python environment:

`%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\python.exe`

## Metrics (`{service_name="timeweb", log_type="billing", job="timeweb-account"}`)

| metric | meaning |
|---|---|
| `balance_rub` | money left on the shared account wallet |
| `total_balance_rub` | same wallet including bonuses, as the API reports it |
| `monthly_cost_rub` | current fixed monthly subscription cost |
| `hourly_cost_rub` | hourly burn of that subscription |
| `hours_left` | hours the balance covers at the current burn |
| `total_paid_rub` | lifetime top-ups |
| `read_ok` | 1 = last read succeeded, 0 = data stale, do not trust the balance |

Each `*_rub` metric is paired with `<name>_known`, because a missing field in the
API response must stay unknown instead of silently becoming zero.

## Rubles stay rubles

The dashboard shows Timeweb in `currencyRUB` and never converts to USD. A
converted number would depend on the exchange rate at render time and would
quietly invite comparison with dollar-priced inference providers.

## Infrastructure and AI share the wallet

The balance is one wallet. `monthly_cost_rub` is the infrastructure
subscription. AI token spend from the same wallet shows up only as a faster
drop in balance — it is not a separate line.

Splitting AI from infrastructure is **not possible through the API today**:

- `https://api.timeweb.ai/v1` is OpenAI-compatible and serves `GET /models`,
  but `/usage`, `/balance`, `/tokens`, `/account`, `/limits` all return 404;
- the Cloud API has no `ai/*` endpoints (`/api/v1/ai/...` → 404).

So the split requires the Timeweb console or the invoice for a billing period.
Do not fake it by subtracting `monthly_cost_rub` from a balance delta: top-ups
and AI spend land in the same number.

## Credentials

`TW_API_KEY` is read from the environment first, then from
`%LOCALAPPDATA%\hermes\.env`. The value is never logged.

## Verify

```bash
python tools/timeweb_usage/push_timeweb_usage.py --dry-run
python -m pytest -q tools/timeweb_usage/test_push_timeweb_usage.py
```
