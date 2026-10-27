# FinOps dashboard

Grafana: <https://tealaphid71.grafana.net/d/hermes-finops> (uid `hermes-finops`, folder `ag2b9ny7raxogc`).
Tracking issue: #70.

One page for every money source, with the single rule that matters: **fact and
estimate never mix**. A number produced by multiplying our own token counts by a
price list is not a bill and must not be displayed like one.

## Source inventory

| Source | Money source | Tokens from logs | Note |
|---|---|---|---|
| DeepInfra | real billing API | yes | `provider=deepinfra` |
| Nous | remaining credits only | yes | `provider=nous`; no per-period spend |
| RunInfra | none confirmed | yes | appears as `provider=custom` |
| OpenAI / Codex | none — ChatGPT subscription | yes | `provider=openai-codex`; burns the 5h limit |
| Timeweb | MCP `get_account_finances`, rubles | n/a | infrastructure, not inference |
| BotHub | none | none in inference logs | $0 while Hindsight runs on a free model |

Only `deepinfra` and `nous` publish `log_type="billing"` streams to Loki.

## Prices used in the estimate panels

USD per 1M tokens, verified 2026-10-27 against the provider catalogues:

| Model | input | cache read | output |
|---|---:|---:|---:|
| DeepSeek V4.1 Flash 1017 @ RunInfra | 0.15 | 0.01 | 0.60 |
| DeepSeek V4.1 Flash 1017 @ Nous | 0.022 | 0.0124 | 1.21 |
| DeepSeek V4 Flash 0731 @ Nous | 0.07 | 0.014 | 0.14 |

Prices change. Re-verify before trusting a bound; a stale price silently turns a
bound into a lie.

## Why the estimate is a range

The agent log line records only the total input and how much of it hit the cache:

```
API call #1: model=X provider=Y in=112425 out=205 total=112630 latency=5.1s cache=...
```

`in` includes cached tokens, so the true cost sits between two limits:

- **lower** — every input token billed at the cache-read price;
- **upper** — every input token billed at the full input price.

The real bill is inside that interval. Output is priced exactly, so it is added
to both ends. When a per-call cache split is available, the range can collapse
into one number — that is the follow-up work in #70.

## Recreating or changing the dashboard

Queries live in the dashboard JSON in Grafana. Keep in mind:

- LogQL arithmetic is allowed: `sum(...) * 0.00000001` is a valid price multiply.
- The provider filter `|= "provider=custom in="` also captures `out=` on the same
  line, so both halves of a cost expression reuse one line filter.
- Provider aggregates use `sum by (provider)`; a per-model view is a deliberate
  next step, not a missing default.

## Per-session attribution

A provider total hides the thing that actually drains a quota: one chat carrying a
huge context. The agent log line starts with the session id, so the same `API call #`
rows can be grouped by it:

```logql
sum by (session) (sum_over_time({service_name="hermes", log_type="agent"} |= "API call #"
  | regexp "\\[(?P<session>local-[0-9a-f]+)\\].*provider=(?P<provider>[a-z0-9_-]+) in=(?P<input>[0-9]+)"
  | unwrap input [$__range]))
```

Read it together with output: input is mostly cache (cheap but still consumes
quota and time), output is what gets billed at full price. A session with 250M
input and almost no output is a chat re-reading its own history, not a chat that
produced a lot of work.

## LogQL trap: valid regex that never matches

In this stack two regex shapes parse fine and then return **zero rows** where
literal filters return plenty:

| shape | result |
|---|---|
| `\|= "provider=deepinfra" \|= "positive balance"` | 8 |
| `\|~ "402.*positive"` | 32 |
| `\|~ "(?i)402.*(positive balance\|insufficient balance)"` | 0 |
| `\| regexp "\\[(?P<s>local-[0-9a-f]{8})\\]"` | 0 |
| `\| regexp "\\[(?P<s>local-[0-9a-f]+)\\]"` | matches |

Rule: when a deployment-critical query returns no data, test it against a time
range where the event is known to exist, and fall back to literal `|=` filters or
`+` quantifiers. An alert built on a never-matching query looks healthy —
`NoData` with `no_data_state=OK` — and protects nothing.

## Access note

`GRAFANA_API_TOKEN` in this workspace is a `glc_` access-policy token: it writes
logs and reads metrics, but it is **not** valid for the Grafana HTTP API
(`/api/dashboards/db` returns 401). Dashboard edits therefore go through the
Grafana MCP server, which holds its own OAuth session.
