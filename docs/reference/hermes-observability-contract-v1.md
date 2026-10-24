# Hermes Observability Contract v1

Status: reference draft, prepared from the official Hermes observer/gateway-monitoring documentation and the verified local Langfuse route.

## 1. Purpose

This contract answers one question before any dashboard or metric is trusted:

> What exactly does this signal describe, where does it come from, and what does it not prove?

The production baseline is intentionally small:

```text
Hermes core monitoring  -> content-free gateway/cron health
Official Langfuse      -> run-level traces, generations and tool observations
Langfuse CLI/MCP        -> read-back and analysis
Hindsight OTEL         -> separate memory-service traces in the existing project
```

Community telemetry plugins are not production dependencies unless a separate experiment proves isolation, privacy, rollback and read-back.

## 2. Feynman model

Think of the system as four instruments:

- **Health monitor** — a smoke alarm: is the gateway, scheduler or connector alive?
- **Trace recorder** — a black box: what turn, model call and tool call happened?
- **Cost ledger** — a meter: how many tokens and what estimated price were recorded?
- **Evidence/read-back** — the mechanic's inspection: can we retrieve the exact record and check its meaning?

A dashboard is only a display. It is not evidence until the underlying record and field semantics are verified.

Example:

```text
one user turn
  -> one run/trace
  -> one or more LLM generations/API attempts
  -> zero or more tool observations
  -> terminal status and usage
```

`one trace` does not mean `one LLM call`, and `one generation` does not mean `one tool call`.

## 3. Signal ownership and semantics

| Object | Source of truth | Measures | Does not prove |
|---|---|---|---|
| Gateway health | Hermes core monitoring | gateway state, active work, scheduler/cron health, bounded diagnostics | model quality, prompt content, per-run spend |
| Turn trace | official Langfuse plugin | one run/turn boundary and final status | that every child observation is causal or complete |
| LLM generation | Langfuse child generation / API observation | model/provider, input/output/cache/reasoning usage, latency, finish/error | provider invoice or BotHub CAPS unless pricing is verified |
| Tool observation | Langfuse tool observation / observer hook | tool name, duration, status, error | why the model chose the tool |
| Hindsight generation | Hindsight OTEL -> Langfuse | memory-service operation, model and usage where present | Hermes-agent behavior |
| Provider billing | provider dashboard/export/API | actual provider charge/quota | Langfuse estimated USD unless reconciled |
| Human attention | Theseus multi-budget analysis | context switches, rework, unresolved WIP, recovery time | a precise monetary value without an explicit model |

## 4. Usage fields

Never collapse these fields into one number:

- `input_tokens`: input/context consumption for that generation;
- `output_tokens`: generated output;
- `cached_tokens`: provider/cache accounting, only meaningful with its provider semantics;
- `reasoning_tokens`: reasoning bucket when the provider exposes it;
- `total`: provider/runtime-reported total usage, not automatically `input + output`;
- `cost`: estimated or ingested price; missing cost is `UNKNOWN`, not zero;
- `latency`: observation or span duration; summed child latency is not wall-clock time because spans may overlap.

Every report must state the time window, denominator, source, and whether the number is incremental or cumulative.

## 5. Privacy boundary

Default export posture:

```text
core health: content-free
Langfuse: metadata/usage according to official plugin configuration
Hindsight: separate service boundary
```

Prompts, responses, tool arguments/results, credentials, private URLs and hidden reasoning are not exported unless a separate experiment explicitly enables and verifies content capture. Read-back must inspect the decoded payload, not only the exporter status line.

## 6. Read-back routes

- Current Langfuse observations: Langfuse CLI or authenticated Langfuse MCP.
- Core health posture: `hermes monitoring status`.
- Hermes observer contract: official `observer-hooks.md`.
- Hindsight operation hierarchy: Langfuse child `GENERATION` observations, not only parent spans.
- Provider CAPS: provider-owned dashboard/export, separately from Langfuse.

A successful HTTP export, plugin installation, or `healthy` response is not sufficient proof of complete telemetry. Require an exact read-back of the expected object and fields.

## 7. Current disposition

- Official Langfuse plugin: enabled and used for run-level read-back.
- Hermes core gateway monitoring: available, content-free, currently not exported.
- `hermes_otel`: tested with metadata-only Langfuse export, then disabled to reduce runtime entropy; candidate config retained only for rollback/reference.
- `hermes-telemetry`: rejected as a production dependency because of local shared storage, default enforcement behavior, and unverified profile isolation.
- Generic marketplace observability skills: reference material only until source, scope and privacy are verified.

## 8. Acceptance gate for future monitoring changes

Before enabling any new route:

1. Identify its owner and signal semantics.
2. Prove content/privacy settings from the effective runtime, not a candidate file.
3. Prove storage location and retention.
4. Run one bounded synthetic canary.
5. Read back the exact trace/metric/log and verify expected fields plus absence of forbidden content.
6. Compare against the existing official Langfuse route.
7. Define rollback and confirm that the default gateway/session remains unaffected.

## Official references

- Hermes gateway monitoring: https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-monitoring
- Hermes observer hooks: https://hermes-agent.nousresearch.com/docs/developer-guide/observer-hooks
- Langfuse plugin: https://github.com/NousResearch/hermes-official-plugins/tree/main/langfuse
- Theseus multi-budget model: https://github.com/TeaShaman-cyber/theseus-research/issues/89
