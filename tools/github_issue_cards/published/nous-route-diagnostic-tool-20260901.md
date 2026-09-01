---
card_id: ISSUE-20260901-NOUS-ROUTE-DIAGNOSTIC-TOOL
status: READ_BACK_VERIFIED
operation: create
issue_number: 4
issue_url: "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/4"
verified_at: 2026-09-01
observed: "GitHub issue #4 read back with matching title/body, state open, zero comments, and no labels."
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "research-project workflow: create one issue for a correct, redaction-safe diagnostic tool for the Nous route"
issue_type: research-design
purpose: "Replace misleading Python-only Nous probes with a deterministic diagnostic that distinguishes client/TLS fingerprinting, credential, model, provider, proxy, and Hindsight-route failures."
duplicate_check: "Issue #2 covers Docker-owned Hermes Subscription Proxy lifecycle; issue #3 covers Hindsight source ownership and split-brain prevention; this issue covers diagnostic semantics and probe implementation."
body:
  title: "Research: build a correct diagnostic tool for the Nous route"
  body: |
    ## Research question

    Can we provide one deterministic, redaction-safe diagnostic tool for the
    Nous route that validates the actual `/chat/completions` data plane without
    misclassifying a Python/TLS fingerprint block as provider or VPN failure?

    This issue is complementary to:

    - [#2](https://github.com/TeaShaman-cyber/theseus-local-lab/issues/2) —
      Docker-owned Hermes Subscription Proxy lifecycle;
    - [#3](https://github.com/TeaShaman-cyber/theseus-local-lab/issues/3) —
      repository ownership of the Hindsight Compose source.

    ## FACT

    - A historical Python `urllib` probe against
      `inference-api.nousresearch.com` returned HTTP 403 with Cloudflare error
      1010.
    - A probe through the Windows `curl.exe`/Schannel stack from the same egress
      path returned HTTP 200 for the Nous model catalog.
    - With the OAuth `agent_key` handled in memory and never printed, a correct
      `curl.exe` chat probe previously returned HTTP 200, non-empty content,
      and `finish_reason=stop` for `upstage/solar-pro4:free` and other Nous
      free models.
    - The current Hindsight LLM trace contains successful Solar completions,
      while a recent Python-only probe through the Docker path returned a
      Cloudflare 1010 page. Therefore that probe is not sufficient evidence
      that Solar is unavailable.
    - The Hermes Subscription Proxy intentionally accepts a client placeholder
      bearer and attaches the real OAuth credential internally. The diagnostic
      must not copy, display, or persist that credential.

    ## INFERENCE

    The primary probe must use the client stack that has already passed the
    route (`curl.exe`, explicitly, not an ambiguous `curl` alias). Python
    `urllib` can remain a labelled negative control for detecting a client/TLS
    fingerprint artifact, but its 403/1010 result must never become a provider
    death verdict.

    A `/models` success is only catalog evidence. Acceptance requires a bounded
    `/chat/completions` call with a fixed model, `max_tokens >= 200`, parsed JSON,
    non-empty assistant content, and a finish reason. HTTP status alone is not
    enough because wrapped providers can return HTTP 200 with an embedded error.

    ## UNKNOWN

    - Whether the Cloudflare result is stable for the current Docker-owned proxy
      process or varies with egress/client fingerprint over time.
    - Whether the safest implementation should run on the Windows host with
      `curl.exe`, as a one-shot curl container on the Compose network, or as a
      small read-only wrapper around the existing Hindsight trace endpoint.
    - Whether the Nous proxy can expose enough non-secret metadata to diagnose
      credential refresh separately from upstream Cloudflare filtering.

    ## Proposed diagnostic contract

    ```mermaid
    flowchart LR
      A[diagnostic command] --> B[Windows curl.exe / Schannel]
      B --> C[Hermes proxy or direct Nous route]
      C --> D[bounded chat completion]
      D --> E[JSON classifier]
      E --> F[success / CF-1010 / auth / model / overload / proxy]
      F --> G[optional Hindsight trace read-back]
    ```

    The tool should emit compact JSON and a human summary with at least:

    - route target and client stack;
    - stage (`dns`, `tls`, `auth`, `models`, `chat_completion`, `hindsight_trace`);
    - HTTP status, provider/model label, latency, finish reason, and content
      presence;
    - a stable classification such as `SUCCESS`,
      `CLIENT_TLS_FINGERPRINT_BLOCK`, `AUTH_FAILURE`, `MODEL_NOT_FOUND`,
      `UPSTREAM_OVERLOAD`, `PROXY_UNREACHABLE`, `TIMEOUT`, or
      `WRAPPED_PROVIDER_ERROR`;
    - evidence pointers and timestamps, never raw bearer headers, request
      bodies, response bodies, OAuth state, or provider keys.

    ## Acceptance criteria

    - [ ] A versioned diagnostic tool exists under the repository's tooling
      boundary and has a documented invocation for the current Windows/Docker
      setup.
    - [ ] The primary route uses explicit `curl.exe`/Schannel or another
      verified equivalent; Python `urllib` is labelled only as a negative
      control.
    - [ ] The tool exercises `/chat/completions` with a fixed model and
      `max_tokens >= 200`, parses the response body, and rejects empty content
      or embedded `{error: ...}` payloads even when HTTP is 200.
    - [ ] Fixture/unit tests cover 200 success, 401, 403/Cloudflare 1010, 404
      free-period/model death, 429, 502 overload, timeout, connection failure,
      wrapped HTTP-200 errors, malformed JSON, and empty content.
    - [ ] A live bounded probe produces a redacted machine-readable result and
      never prints or persists credentials; the probe does not retain to or
      mutate Hindsight memory.
    - [ ] When Hindsight is part of the test, the tool performs a read-only
      trace read-back and distinguishes `proxy`, `provider`, `model`, and
      `Hindsight` postcondition failures.
    - [ ] The result is linked from the model-helper triage/chronology docs and
      includes a falsifier for the claim that Solar is unavailable.

    ## Next distinguishing probe

    Implement the smallest fixture-backed classifier first. Then run one live
    no-write matrix: `curl.exe` control path, Python negative control, internal
    Hermes proxy `/health`, one Solar `/chat/completions`, and a bounded
    Hindsight trace read-back. Compare classifications rather than collapsing
    every 403 into "Nous/VPN blocked".

    ## Boundary

    This issue does not change Hindsight weights, OAuth state, Hermes config,
    VPN settings, provider credentials, or the active Compose stack. It does not
    publish credentials or raw provider responses.

    Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering
    agent and engineering partner. Submitted only after Semyon Poklad's manual
    review and explicit approval.
