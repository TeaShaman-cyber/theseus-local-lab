# Codex Usage Limits Observability

Status: research memo and implemented rollout observer
Date: 2026-07-14
Scope: Codex and ChatGPT Work usage limits, credits, token activity, and local
observability. This document defines evidence and a future data contract. It
does not design or implement `usage_scout`.

## Executive conclusion

Codex already exposes enough structured signals to build a useful local usage
observatory. The strongest source is the stable app-server API, followed by
local `token_count` rollout events. The missing piece is not raw access but a
careful normalization layer.

The observatory must not estimate OpenAI's private charging formula. It should
record token activity, quota snapshots, reset times, model settings, provider
errors, and transitions, while marking derived interpretations as hypotheses.

The central schema rule is:

> Identify a quota window by `limit_id`, `window_minutes`, and observation time.
> Never assume `primary` means five hours or `secondary` means one week.

That rule is supported by both upstream protocol evolution and our local logs.

## Evidence classes

| Class | Meaning | Allowed use |
| --- | --- | --- |
| Confirmed | Current OpenAI documentation, merged code, or a local runtime measurement | May define the data contract |
| Reported | Reproducible-looking GitHub issue or maintainer discussion | May define warnings and test cases |
| Hypothesis | Interpretation not established by the public contract | May be shown only with confidence and evidence |

## Confirmed official behavior

### Limits and credits

- ChatGPT Work and Codex share pricing, credits, and usage limits.
- Similar-looking tasks can consume different amounts because model choice,
  context, reasoning, tools, retrieval, and caching all affect usage. Prompt
  length alone is not a reliable estimator.
- Local messages and cloud tasks share a five-hour window; additional weekly
  limits may apply. The published per-window message counts are ranges, not
  guarantees.
- Speed configurations consume included limits faster. Fast mode is a service
  tier multiplier for supported models; Codex-Spark is a separate model with a
  separate limit.
- Tokens and credits are distinct quantities. The published credit rate card
  weights input, cached input, and output tokens differently and also varies by
  model. Included subscription limits remain a separate product boundary.
- The usage dashboard is the documented account surface. In the CLI, `/status`
  shows session and limit information, while `/usage` can show daily, weekly,
  or cumulative account token activity and earned reset actions.

Sources: [Codex pricing](https://learn.chatgpt.com/docs/pricing),
[Codex speed](https://learn.chatgpt.com/docs/agent-configuration/speed), and
[Codex CLI slash commands](https://learn.chatgpt.com/docs/cli/slash-commands).

### Stable app-server surfaces

The current app-server contract exposes two complementary reads:

1. `account/rateLimits/read` returns quota state. A snapshot can include
   `limitId`, `limitName`, one or more windows, credit state, an effective
   monthly individual limit, plan type, the backend-classified reached-limit
   type, and earned reset-credit metadata.
2. `account/usage/read` returns account token activity: lifetime tokens, peak
   daily tokens, longest-running turn, streak fields, and optional daily token
   buckets.

Rate-limit updates are sparse notifications. Clients must merge them into the
last complete read or refetch; a null account field in a sparse notification
does not necessarily clear prior state. Reset-credit details are snapshot-only,
and a read should be repeated after redemption.

Sources: [app-server account API](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#account-api),
[rate-limit response schema](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/GetAccountRateLimitsResponse.ts),
[token usage response schema](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/GetAccountTokenUsageResponse.ts),
and [token usage summary schema](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/AccountTokenUsageSummary.ts).

### Rollout events

Local rollout JSONL files can contain `event_msg.token_count` records with:

- session-cumulative and last-event input, cached-input, output, reasoning, and
  total token counts;
- the model context window;
- a nullable rate-limit snapshot;
- separate `turn_context` records containing model and reasoning effort.

The upstream type deliberately models rate limits as optional. Therefore,
`rate_limits: null` means unknown or unavailable, not zero usage.

Sources: [TokenCountEvent and RateLimitSnapshot](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/protocol.rs)
and [issue #14880](https://github.com/openai/codex/issues/14880), which documents
a real client/version where UI state existed but persisted rollout snapshots
were null.

## Relevant merged changes

| Change | Engineering consequence |
| --- | --- |
| [PR #18227](https://github.com/openai/codex/pull/18227) propagated `rateLimitReachedType` | Preserve backend failure class instead of collapsing all blocks into quota exhaustion |
| [PR #24812](https://github.com/openai/codex/pull/24812) exposed monthly individual credit limits | Limits can include rolling windows and a separate monthly spend-control boundary |
| [PR #28143](https://github.com/openai/codex/pull/28143) exposed earned reset credits | Reset availability is structured state, not a UI-only message |
| [PR #28154](https://github.com/openai/codex/pull/28154) added reset redemption to `/usage` | `/usage` is now the account-activity and reset action surface |
| [PR #28793](https://github.com/openai/codex/pull/28793) fixed stale reset state and account changes | Cache entries must be account-bound and refreshed after mutations |
| [PR #30395](https://github.com/openai/codex/pull/30395) added reset-credit details | Available count is authoritative; detail rows can be absent, partial, or capped |
| [PR #30488](https://github.com/openai/codex/pull/30488) added expiry-aware reset selection | Reset IDs, expiry, scope, and idempotency belong in one atomic action flow |
| [PR #24314](https://github.com/openai/codex/pull/24314) labeled compact percentages as `left` | Wire `usedPercent` and UI remaining percent have inverse semantics |
| [PR #19990](https://github.com/openai/codex/pull/19990) skips memory startup near limits | Background agent features can consume quota and should be represented as workload contributors |

## Reported failure classes

These are field reports, not proof of OpenAI's internal accounting formula.

| Failure class | Evidence | Required observatory response |
| --- | --- | --- |
| Binding-cap ambiguity | [#31214](https://github.com/openai/codex/issues/31214): weekly exhausted while five-hour window still appears available | Compute an explicit `binding_limit` interpretation from one atomic snapshot |
| Credit vs included-limit conflict | [#27598](https://github.com/openai/codex/issues/27598): workspace out of credits despite visible 5h/7d capacity | Display credits and rolling windows as independent gates |
| Upgrade or purchased-credit desynchronization | [#27097](https://github.com/openai/codex/issues/27097) | Record plan/account snapshot changes and freshness; never merge across identity changes |
| Bucket or reset-time switching | [#23190](https://github.com/openai/codex/issues/23190) and [#31195](https://github.com/openai/codex/issues/31195) | Alert when a same-duration window changes reset time backwards or changes after service-tier switch |
| Opaque cost-weight change | [#28879](https://github.com/openai/codex/issues/28879) compares token events with quota deltas before and after a regression | Preserve raw token and limit deltas, but label causal attribution unconfirmed |
| Missing persisted state | [#14880](https://github.com/openai/codex/issues/14880) | Track source completeness and fall back to a live app-server read |
| Stale or incomplete status surface | [#24080](https://github.com/openai/codex/issues/24080) | Pin percent, reset time, duration, and plan to one observation timestamp |
| Usage-limit terminal stop | [#21073](https://github.com/openai/codex/issues/21073) | Record `resets_at` and stop reason; auto-resume is a later policy decision |

## Local Theseus measurement

A read-only scan of the active Codex rollout on 2026-07-14 found:

- 3,877 `token_count` events;
- 3,873 events with rate-limit data and 4 with `rate_limits: null`;
- from 2026-07-08 through early 2026-07-12, the usual shape was a 300-minute
  `primary` window plus a 10,080-minute `secondary` window;
- from later 2026-07-12 onward, the observed shape became one 10,080-minute
  `primary` window with `secondary: null` and `plan_type: plus`;
- `turn_context` independently recorded model and effort, including the switch
  from GPT-5.5 Medium to GPT-5.6 Sol Medium for this research pass.

This proves that hardcoding `primary = five-hour` would already mislabel our
current data. It does not prove why the server changed the shape.

The same research turn also exposed a harness-level model-switch regression:
Sol initially returned to ad hoc PowerShell routing for nested WSL/JSON work.
The project shell skill corrected the path after the first quoting failure and
the scan completed with a streaming Node reader. This is evidence that skills
must act as executable preflight gates; merely loading their text does not make
their route a reliable reflex across model switches.

## Minimal future event contract

The event should preserve source data and derived interpretations separately.

```json
{
  "schema_version": 1,
  "observed_at": "ISO-8601",
  "source": "rollout|app_server_read|app_server_update|usage_error|manual",
  "source_freshness_ms": 0,
  "codex": {
    "cli_version": null,
    "desktop_version": null,
    "thread_id_hash": null,
    "turn_id": null,
    "model": null,
    "reasoning_effort": null,
    "service_tier": null
  },
  "tokens": {
    "scope": "last_event|session_cumulative|account_daily|account_lifetime",
    "input": null,
    "cached_input": null,
    "output": null,
    "reasoning_output": null,
    "total": null
  },
  "limits": [
    {
      "limit_id": null,
      "limit_name": null,
      "wire_slot": "primary|secondary|bucket",
      "window_minutes": null,
      "used_percent": null,
      "remaining_percent_derived": null,
      "resets_at": null
    }
  ],
  "credits": {
    "has_credits": null,
    "unlimited": null,
    "balance": null,
    "individual_limit": null,
    "reset_credits_available": null
  },
  "account": {
    "plan_type": null,
    "identity_epoch": null
  },
  "stop": {
    "rate_limit_reached_type": null,
    "error_class": null,
    "resets_at": null
  },
  "derived": {
    "binding_limit_key": null,
    "burn_rate_observed": null,
    "confidence": "none|low|medium|high",
    "evidence": []
  },
  "quality": {
    "complete_snapshot": false,
    "stale": false,
    "shape_changed": false,
    "warnings": []
  }
}
```

Privacy rule: do not store email, access tokens, raw account IDs, raw user IDs,
prompts, tool output, or transcript text. Use a local identity epoch or salted
hash only if account-change separation becomes necessary.

## Dashboard indicators

The first dashboard should answer six questions:

1. Which gate is binding now: rolling quota, weekly quota, monthly individual
   limit, workspace credits, provider capacity, or unknown?
2. How fresh and complete is the latest snapshot?
3. When does each observed window reset?
4. What model, effort, and speed tier produced the latest token event?
5. What was the observed token mix and quota-percent delta, without claiming a
   private cost formula?
6. Did the schema, reset time, plan, identity epoch, or source availability
   change unexpectedly?

Recommended visual states:

- one row per normalized window, labelled by duration and backend name;
- `used` and `left` shown together to prevent inverse-semantic mistakes;
- a binding-gate badge with confidence and evidence;
- snapshot age and source (`live RPC`, `rollout`, or `fallback`);
- a shape-change marker for missing/added windows;
- a discontinuity alert for backward reset time, unexplained percentage jump,
  null-after-present, or plan/service-tier transition;
- token activity chart kept separate from limit consumption chart;
- provider failures shown as availability failures, not quota consumption.

## What must not be inferred

- Do not derive the private included-limit formula from token counts.
- Do not treat session-cumulative tokens as billable credits or weekly usage.
- Do not assume the same model has stable weighting over time.
- Do not assume `primary` and `secondary` have fixed durations or meanings.
- Do not treat null, omitted, or sparse fields as zero.
- Do not combine percent and reset time from different reads.
- Do not treat a UI percentage as authoritative without knowing whether it is
  `used` or `remaining`.
- Do not assume a percentage jump was caused by the immediately preceding turn;
  other surfaces and background features may share the same allowance.
- Do not infer that an active turn will always finish after a limit is reached;
  the official statement remains subject to fair use.
- Do not turn a dashboard score into a reward signal. Any later routing policy
  needs causal evidence, a postcondition, and regression observation.

## Research decision

A future `usage_scout` is justified, but its first version should be an
observer, not an optimizer. The preferred source order is:

1. complete `account/rateLimits/read` snapshot;
2. `account/usage/read` token activity;
3. sparse app-server updates merged against the last complete snapshot;
4. local rollout events for per-turn history and recovery;
5. structured usage-limit errors;
6. UI/manual evidence only as a cross-check.

The first implementation is `tools/usage_scout/usage_scout.mjs`. It reads only
the tail of the active rollout, preserves token activity and quota snapshots as
separate signals, writes changed observations to local JSONL history, and feeds
the workshop dashboard. The Stop hook refreshes this cache automatically.

This is intentionally the rollout fallback layer, not the final live source.
The next implementation stage should add a read-only app-server client only
after one live `account/rateLimits/read` and `account/usage/read` call is proven
without exposing credentials or account identifiers.
