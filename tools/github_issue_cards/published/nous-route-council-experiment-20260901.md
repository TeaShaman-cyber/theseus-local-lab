---
card_id: ISSUE-20260901-NOUS-ROUTE-COUNCIL-EXPERIMENT
status: READ_BACK_VERIFIED
operation: create
issue_number: 7
issue_url: "https://github.com/TeaShaman-cyber/theseus-model-usage-lab/issues/7"
verified_at: 2026-09-01
observed: "GitHub issue #7 read back with matching title/body, state OPEN, zero comments, and no labels."
project: theseus-model-usage-lab
repository: TeaShaman-cyber/theseus-model-usage-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "Create one public research issue for a bounded multi-model council experiment on the practical Nous route diagnostic task."
issue_type: research_experiment
purpose: "Measure whether model-family rotation and isolated mask-board passes improve the design of a correct, redaction-safe Nous route diagnostic tool."
duplicate_check: "model-usage-lab#5 defines the generic mask-board protocol; local-lab#4 defines the diagnostic tool contract; this issue measures the council on that concrete task."
body:
  title: "Experiment: multi-model council for a correct Nous route diagnostic"
  body: |
    ## Research question

    Does a sequential, provider-stratified council of independent model passes
    materially improve a practical Nous route diagnostic design compared with a
    single parent analysis? Which failure classes, controls, and operational
    hazards are found only by particular model families?

    This is a concrete trial of the mask-board protocol in
    [model-usage-lab#5](https://github.com/TeaShaman-cyber/theseus-model-usage-lab/issues/5),
    applied to the diagnostic-tool contract in
    [theseus-local-lab#4](https://github.com/TeaShaman-cyber/theseus-local-lab/issues/4).

    ## Task packet given to every pass

    Design a bounded diagnostic for the Nous route that can distinguish:

    ```text
    Python/TLS fingerprint failure
      != VPN or IP block
      != invalid OAuth credential
      != unavailable model
      != provider overload
      != Hermes proxy failure
    ```

    The design must require:

    - `curl.exe`/Schannel as the primary positive-control client on Windows;
    - Python `urllib` only as a labeled negative/control comparison, never as a
      provider verdict;
    - a real `/chat/completions` semantic probe, not `/models` alone;
    - `max_tokens >= 200` and response-body parsing, including HTTP 200 bodies
      containing an embedded provider error;
    - redaction-safe evidence: no OAuth bearer, API key, cookie, account ID, or
      raw prompt/response in logs or artifacts;
    - explicit separation of client, credential, endpoint, proxy, provider,
      model, and Hindsight read-path failures.

    Every pass receives the same task packet and the same verified facts. A pass
    must not see the parent baseline, another pass's result, or a prior verdict.

    ## Council protocol

    Use the five isolated masks from #5:

    1. **Archivist** — recover the prior `1010`/`curl`/`urllib` evidence and
       prevent regression to the already-refuted interpretation.
    2. **Practitioner** — design a command that can actually run on this Windows
       plus Docker setup without leaking credentials.
    3. **Systems engineer** — separate route layers, ownership, retry policy,
       exit codes, and machine-readable output.
    4. **Newcomer** — test whether an operator can understand and use the result
       without confusing a client artifact with provider health.
    5. **Skeptic** — identify falsifiers, false-positive paths, unsafe retries,
       and claims not established by the proposed probe.

    Executor routes are rotated **between passes**, never mixed inside one pass:

    ```text
    Pass A — every distinct live free route found in the bounded provider inventory
    Pass B — paid opencode-go subscription route(s)
    Pass C — paid OpenAI Sol subscription route, last
    ```

    The inventory must record exact provider/model identifiers, deduplicate only
    evidenced aliases, and reconcile requested/completed/failed/skipped counts.
    A catalog listing is not availability evidence. A candidate is `LIVE` only
    after a bounded semantic completion probe; `NOT_RUN` and `UNKNOWN` must be
    explicit when a route cannot be tested safely.

    Because Hermes delegation currently has one global child route, each pass
    must read back `delegation.provider` and `delegation.model` before dispatch,
    rotate only within the approved candidate list, and restore the original
    delegation pin after the experiment. No child may mutate Hermes config,
    Hindsight, AutoMem, GitHub, Docker, or provider state.

    ## Required result schema

    Do not publish raw child transcripts. Produce a compact sanitized record per
    mask and pass:

    ```yaml
    pass_id:
    executor_provider:
    executor_model:
    mask:
    verdict:
    confidence:
    facts:
    assumptions:
    missing:
    unique_findings:
    failure_classes:
    what_would_change_my_mind:
    weakest_point:
    ```

    ## Measurement plan

    Compare a parent baseline prepared before seeing council results with the
    council aggregate on:

    - convergence and meaningful divergence by pass and by mask;
    - unique verified findings contributed by each executor family;
    - failure classes and negative controls covered by the final design;
    - false positives, unsupported assumptions, and unsafe operational advice;
    - actionable acceptance criteria and semantic postconditions;
    - route failures versus runner/instruction-following failures;
    - wall time, child count, route availability, and free/paid usage.

    A dissent is useful only when it either exposes a verified hazard or is
    falsified by the listed evidence. A majority is not proof by itself.

    ## FACT / INFERENCE / UNKNOWN

    **FACT:** the prior session found Cloudflare `1010` from Python `urllib` while
    `curl` from the same egress passed; the current Hindsight trace contains
    successful Solar calls; `delegate_task` uses one global model/provider pin.

    **INFERENCE:** isolated passes from different model families may cover
    different operational blind spots and improve the diagnostic contract.

    **UNKNOWN:** whether additional model families add verified value beyond the
    existing five-mask protocol; whether provider diversity improves the final
    tool rather than only increasing noise; which free routes are live at run
    time; whether the best probe can be run through the internal Docker proxy
    without a direct bearer-handling path.

    ## Acceptance criteria

    - [ ] Parent baseline is recorded before council results are revealed.
    - [ ] Bounded live inventory identifies every in-scope free provider route and
          reconciles every candidate as `LIVE`, `FAILED`, `NOT_RUN`, or `UNKNOWN`.
    - [ ] The same sanitized task packet is used for every pass.
    - [ ] All five masks complete for each dispatched executor pass, or missing
          results are explicit and explained.
    - [ ] Free passes run before paid opencode-go, and Sol runs last.
    - [ ] Delegation provider/model is read back before each pass and the original
          pin is restored afterward.
    - [ ] No credentials, raw transcripts, working-memory writes, or external
          mutations are introduced by the experiment.
    - [ ] Results distinguish candidate, route, runner, and aggregation failures.
    - [ ] Final synthesis reports convergence, divergence, unique verified facts,
          false leads, cost, and whether the council improved the diagnostic
          contract over the baseline.

    ## Falsifiers / stop conditions

    Stop a route batch on an auth failure, plan gate, quota warning, repeated
    transport failure, or missing result requiring a new decision. Do not retry
    a dead model identifier blindly. Reject the council benefit hypothesis if
    the aggregate adds no verified findings, increases false confidence, or
    cannot preserve route/client distinctions.

    ## Public/private boundary

    Public: protocol, sanitized schemas, model-family/provider labels, aggregate
    outcomes, verified failure classes, and reproducible non-secret commands.

    Private: credentials, OAuth state, account metadata, VPN identity, raw
    sessions, raw prompts/responses, private runtime paths, and unredacted logs.

    ## Next distinguishing probe

    Prepare the parent baseline and bounded free-route inventory, then dispatch
    the first isolated free pass. Do not use the parent baseline as context for
    any child; synthesize only after all selected passes return.
