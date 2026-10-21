---
card_id: ISSUE-20260902-PROVIDER-QUOTA-MONITOR
status: READ_BACK_VERIFIED
operation: create
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: new
purpose: "Research and design a provider/subscription quota monitor plugin for Hermes, covering paid and free routes without exposing secrets or silently spending balance."
approval_scope: "Create one research issue; record the verified opencode-go HTTP 429 incident and investigate provider usage/quota/route observability. No provider balance changes, credential changes, model purchases, fallback activation, or production scheduler changes."
duplicate_check: "No existing issue is dedicated to provider subscription quota monitoring; #4 covers Nous route diagnostics, #6 guardrails implementation, and #7 council container architecture."
labels: ["research", "infrastructure"]
actual_labels: ["research"]
verified_at: 2026-09-02T17:52:00+02:00
verified_by: "GitHub REST API read-back of TeaShaman-cyber/theseus-local-lab#8"
observed: "Issue #8 is open at https://github.com/TeaShaman-cyber/theseus-local-lab/issues/8; title, research label, and full 7575-character body match the approved card."
issue_title: "Research: provider subscription quota monitoring and safe fallback plugin for Hermes"
issue_body: |
  ## Research question

  Can Theseus/Hermes provide a provider-neutral monitoring plugin that detects subscription quotas, weekly/monthly limits, rate limits, balance/credit exhaustion, authentication failures, and route drift before scheduled work fails — while covering all relevant Hermes providers (including `opencode-go`) and never silently spending balance or changing provider credentials?

  The first incident is the `Svarog Social Life` cron job pinned to `glm-5.3-flash @ opencode-go`, which failed with `HTTP 429: Weekly usage limit reached. Resets in 4 days.` The job was subsequently routed to a verified OpenRouter free model, but the historical failure exposed that Hermes had no clear provider/quota dashboard or preflight warning.

  ## Why this is a separate research line

  This extends but does not redefine:

  - #2 — Docker-owned Hermes Subscription Proxy lifecycle;
  - #4 — correct diagnostic tool for the Nous route;
  - #6 — bounded-workflow guardrails;
  - #7 — one Hermes profile per container and external council room.

  The focus here is provider usage observability and safe routing policy, not a new model gateway, credential store, or autonomous spending mechanism.

  ## Hypotheses

  - **H1 — Provider APIs differ.** No single generic quota endpoint will cover OpenRouter, `opencode-go`, OpenAI/Codex Subscription, Anthropic, Google, Nous, and other Hermes providers; the plugin needs provider-specific adapters plus an honest `UNKNOWN` state.
  - **H2 — Error telemetry is useful but late.** HTTP 429/error bodies can identify exhausted quota after failure, but a monitor needs preflight snapshots and reset timestamps where providers expose them.
  - **H3 — Route drift is a separate failure class.** A working model/provider pair can still be the wrong route for a scheduled job; the monitor must report provider, model, route, credential source, and fallback policy separately.
  - **H4 — Safe fallback requires explicit policy.** A monitor may recommend a free fallback, but it must not change a job, enable balance spending, rotate credentials, or publish without an approved policy.
  - **H5 — The smallest reliable core is deterministic.** Provider status parsing, reset windows, rate-limit classification, and alert thresholds should be deterministic; an LLM may summarize but must not be the source of truth.

  ## Evidence classes

  - **FACT:** On 2026-09-02, `Svarog Social Life` failed on `opencode-go` with HTTP 429 and a provider-reported weekly usage reset in four days.
  - **FACT:** The job's prior provider/model pin was `opencode-go` + `glm-5.3-flash`.
  - **FACT:** A live OpenRouter `/v1/models` probe returned HTTP 200 and 18 `:free` models; `minimax/minimax-m3:free` returned the exact bounded smoke response `READY`.
  - **FACT:** The existing job was repaired by changing only its explicit provider/model pin and route instructions; its schedule and identity were preserved.
  - **INFERENCE:** A provider-neutral quota monitor should have surfaced this as `quota_exhausted(provider=opencode-go, scope=weekly, reset_at=...)` before the next scheduled run.
  - **UNKNOWN:** Which quota/usage APIs are available and authoritative for each paid Hermes provider; whether provider dashboards expose reset timestamps programmatically; whether a given “free” route has independent fair-use limits.

  ## Required provider coverage

  The research must include, at minimum:

  - `opencode-go`;
  - `openrouter`;
  - `openai-codex` / ChatGPT Subscription route;
  - Anthropic;
  - Google/Gemini;
  - Nous/Portal;
  - DeepSeek, xAI, ZAI/GLM, MiniMax, Kimi, Alibaba, Hugging Face, and other configured Hermes providers where a usage or quota surface exists.

  “Covered” means the plugin can report a verified status or an explicit `UNKNOWN`; it does not mean inventing a quota number from a model catalog or a single successful completion.

  ## Proposed monitoring contract

  ```text
  provider_probe_started
    → route_resolved(provider, model, endpoint, credential_source)
    → quota_observed / quota_unknown / auth_failed / provider_unreachable
    → policy_decision(allow | warn | block | ask)
    → probe_finished
  ```

  Suggested normalized record:

  ```json
  {
    "provider": "opencode-go",
    "model": "glm-5.3-flash",
    "scope": "weekly",
    "status": "exhausted",
    "remaining": null,
    "reset_at": "2026-09-06T...Z",
    "source": "provider_error_body",
    "confidence": "verified",
    "spend_allowed": false,
    "fallback_candidate": null,
    "observed_at": "..."
  }
  ```

  The plugin must never store API keys, print tokens, or infer spend permission from `HTTP 200`, model discovery, or a successful `hermes mcp test` alone.

  ## Bounded investigation stages

  1. Inventory configured Hermes providers, models, credentials sources, and existing status/usage commands without printing secrets.
  2. Read official provider documentation for usage, limits, reset windows, rate-limit headers, and account endpoints.
  3. Reproduce classification against sanitized fixtures: quota exhausted, rate limited, auth failed, endpoint unavailable, model unavailable, and provider route drift.
  4. Run live read-only probes only where the provider explicitly supports them; record latency and evidence source.
  5. Compare scheduler behavior before/after a simulated `provider_blocked` result; no live fallback writes.
  6. Design the minimal plugin boundary: deterministic probe/normalizer + Hermes dashboard/cron adapter + optional model summarizer.
  7. Define alert delivery and human approval gates; no automatic balance enablement or route mutation.

  ## Acceptance criteria

  - A provider matrix covers all configured paid Hermes providers, including `opencode-go`, with FACT/UNKNOWN evidence for each.
  - The original 429 incident is represented as a normalized, verified fixture.
  - The monitor distinguishes runner, route, model, authentication, quota, and network failures.
  - It can report reset windows and remaining quota only when the provider supplies authoritative evidence.
  - It emits a safe `provider_blocked` state before a scheduled job retries an exhausted route where preflight is possible.
  - It never prints or persists secrets and never silently spends balance.
  - A free fallback is a recommendation requiring explicit policy, not an automatic side effect.
  - The design remains compatible with Hermes Desktop, gateway, cron, Codex, and future containerized profiles.

  ## Non-goals and stop conditions

  - No provider balance top-up or subscription change.
  - No credential rotation or reauthentication.
  - No automatic provider/model/job edits in this research phase.
  - No probing private dashboards through undocumented endpoints.
  - Stop if a provider requires a paid API call merely to read quota, if identity/authorization is unclear, or if a live probe could spend balance.

  ## Privacy boundary

  Never publish API keys, tokens, cookies, account identifiers, private dashboard URLs, exact personal usage beyond the normalized incident, or private chat transcripts. Provider responses should be sanitized to status, scope, reset evidence, and stable non-secret metadata.

  ## Deliverable

  A cited provider matrix, normalized status schema, bounded probe test plan, safe fallback policy, and implementation recommendation for a small Hermes monitoring plugin.

  Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
verified_at: ""
verified_by: ""
observed: ""
---
