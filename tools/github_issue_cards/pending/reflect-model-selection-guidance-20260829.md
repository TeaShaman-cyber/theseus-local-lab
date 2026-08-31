card_id: ISSUE-20260829-001
status: READ_BACK_VERIFIED

project: "Hindsight"
repository: "vectorize-io/hindsight"
repository_source: "user_contract"
target_confirmation: "user_confirmed"
issue_number: 3870
issue_url: "https://github.com/vectorize-io/hindsight/issues/3870"
operation: "create"

purpose: "Feature/configuration guidance request: document and validate the model capability contract for Hindsight reflect after generic tool/JSON probes passed but real bank-backed reflect failed."
duplicate_check: "completed: no exact duplicate; complementary issues #3647, #3825, #3865, and #3494 reviewed"
evidence:
  - "Hindsight self-host image is pinned to ghcr.io/vectorize-io/hindsight:0.8.6 in the local test stand."
  - "Sanitized OpenRouter, Nous, BotHub, and Ollama Cloud probes tested forced tool calls, tool-result continuation, and strict JSON Schema without touching the Hindsight bank."
  - "OpenRouter probe: Gemma 4 26B and Nemotron 3 Super passed both generic probes; Dots passed JSON but not the tool-result canary; Laguna passed the tool loop but not strict JSON; other outcomes included provider errors and length truncation."
  - "Nous probe: Solar Pro 4 and LongCat 2.0 passed both generic probes; Step passed the tool loop but had an output-budget/negation concern; Hy3 had a second-round 400 and length-truncated structured output."
  - "BotHub direct availability and paid-model matrix included Gemma 4 26B, GLM-4.7 Flash, Qwen3-32B, and Mistral Small 3.2 24B; results included 403 route gates, tool-only success, and JSON/tool component mismatches."
  - "BotHub availability sweep tested 20 free/experimental IDs: 13 returned 403 access gates, one returned 400, six returned 200, and only four of those six had non-empty basic completion content."
  - "Both paid BotHub Gemma 4 26B and paid BotHub Mistral Small 3.2 24B passed full Hindsight reflect-tool disposable probes in 2/2 runs, yet real bank-backed reflect failed for both candidates with no usable tool call."
  - "Full Hindsight reflect-tool disposable probes and real bank-backed reflect did not produce the same result: a model can pass generic and disposable tool/JSON checks yet fail to emit usable message.tool_calls under the real reflect path."
  - "The real reflect attempt with the separate BotHub Mistral route returned HTTP 500 / no usable tool call; before/after Hindsight bank counts were unchanged."
  - "No credentials, raw prompts, private transcripts, or provider keys are included in this card."

draft:
  title: "Feature request / guidance: define and validate the model contract for Hindsight reflect"
  body: |
    ## Use case

    We run a self-hosted Hindsight instance and want to use a separate LLM route
    for `reflect`, while keeping the existing model routing for retain and
    consolidation. The goal is reliable long-term memory consolidation without
    changing the working memory bank during model-selection experiments.

    Our test instance is pinned to:

    ```text
    ghcr.io/vectorize-io/hindsight:0.8.6
    ```

    The reflect route is OpenAI-compatible and is configured separately from the
    general LLM route. We are looking for maintainer guidance on which model
    capabilities are actually required for `reflect`, and how to validate them
    before putting a candidate on a real bank.

    ## Problem statement

    We initially assumed that a model passing small OpenAI-compatible probes
    would be a good candidate for Hindsight `reflect`. That assumption was not
    reliable.

    The generic probes were intentionally read-only and did not touch Hindsight:

    1. force a named tool call;
    2. return a synthetic tool result;
    3. verify that the model used the result;
    4. request strict `json_schema` output;
    5. check valid JSON, fact count, negation preservation, and source fields.

    ```mermaid
    flowchart LR
      A[Candidate catalog] --> B[Generic tool-call probe]
      B --> C[Tool-result canary]
      C --> D[Strict JSON Schema probe]
      D --> E[Full Hindsight reflect-tool probe]
      E --> F[Disposable station]
      F --> G[Real bank-backed reflect]
      G --> H{Usable message.tool_calls?}
      H -->|yes| I[Reflect can continue]
      H -->|no| J[HTTP 500 / no usable tool call]
    ```

    ### Candidate search and generic probe results

    We tested candidates through more than one OpenAI-compatible route and kept
    provider/runner failures separate from model-format failures.

    **OpenRouter host route** (read-only, no Hindsight writes):

    - `google/gemma-4-26b-a4b-it:free`: tool loop and strict JSON passed;
    - `nvidia/nemotron-3-super-120b-a12b:free`: tool loop and strict JSON passed;
    - `dots-studio/dots-3-note-preview:free`: strict JSON passed, but the
      tool-result canary was not reliably used;
    - `poolside/laguna-s-2.1:free`: tool loop passed, strict JSON failed;
    - `openai/gpt-oss-20b:free`: named tool request returned a provider 400 and
      strict JSON was invalid;
    - `nvidia/nemotron-nano-9b-v2:free`: tool request returned a provider 502
      and the structured response was length-truncated.

    **Nous authenticated route** (read-only, no Hindsight writes):

    - `upstage/solar-pro4:free`: both generic probes passed in direct host
      execution;
    - `meituan/longcat-2.0:free`: both generic probes passed;
    - `stepfun/step-3.7-flash:free`: tool loop passed and JSON parsed, but the
      output ended by length and the negation check failed;
    - `tencent/hy3:free`: first tool call passed, second round returned 400, and
      the structured output was length-truncated.

    **BotHub direct route** (`https://openai.bothub.chat/v1`):

    We first ran a live availability sweep and then targeted paid-model matrix
    probes. The sweep was useful for separating route availability from model
    behavior: many candidates returned 403 access gates, while some 200
    responses still failed the structured-output postconditions.

    Targeted paid-model results were:

    - `gemma-4-26b-a4b-it`: the paid model previously returned valid JSON and a
      real tool call; the `:free` alias was not a comparable candidate (BotHub
      returned 403 and the OpenRouter route returned 429);
    - `glm-4.7-flash`: tool calls succeeded in 2/2 runs, but JSON completion
      returned empty content with `finish_reason=stop`/`length` and no valid
      JSON object;
    - `qwen3-32b`: both JSON and tool tasks returned 403 in 2/2 runs, so this is
      a route/access result, not a model-quality result;
    - `mistral-small-3.2-24b-instruct`: JSON completion returned valid
      JSON-in-content in 2/2 runs and the tool task emitted a valid
      `search_mental_models` call in 2/2 runs.

    The paid Gemma result was initially sufficiently promising to justify a
    reflect-only route: it passed the complete Hindsight tool contract in 2/2
    independent disposable-station runs, but the first real bank-backed
    reflect attempt still returned HTTP 500 because no usable tool call was
    emitted.

    We then tested paid BotHub Mistral Small 3.2 24B. It also passed the
    complete Hindsight tool contract in 2/2 independent disposable stations,
    so we tried it as a separate reflect-only route. It failed in the same
    real bank-backed scenario. This repeated result is why we are asking for
    guidance on the actual operation-specific model contract rather than
    simply asking for another model name.

    We also tested additional candidates through Ollama Cloud. `nemotron-3-ultra`
    returned HTTP 200 but failed the canary and strict JSON postconditions;
    `qwen3.5:397b` was plan-gated with HTTP 403. These were not treated as
    equivalent failures.

    ### Generic success did not predict real reflect success

    We then tested the full Hindsight reflect tool loop in disposable stations.
    The paid **BotHub Mistral Small 3.2 24B** route passed the JSON/full-tool
    disposable check in 2/2 independent runs, so we configured a separate
    reflect-only route with a 300-second timeout and one concurrent request.

    However, when the candidates were used against a real Hindsight bank, the
    operation returned an HTTP 500 with no usable tool call. The model produced
    ordinary assistant content instead of the tool-call structure required for
    the reflect loop. Changing prompt shaping and reasoning effort (`none` and
    `low`) did not make the real operation reliable.

    ```mermaid
    sequenceDiagram
      participant H as Hindsight reflect
      participant M as Candidate model
      participant T as Reflect tools
      participant B as Memory bank

      H->>M: system + corpus + tool definitions
      M-->>H: assistant content without usable tool_calls
      H->>H: cannot continue reflect tool loop
      H-->>B: no memory mutation
      H-->>H: HTTP 500

      Note over H,M: The disposable canary had passed
      Note over H,B: Real bank-backed execution failed
    ```

    The important distinction is:

    ```text
    generic tool/JSON compatibility
      !=
    Hindsight reflect compatibility
    ```

    We observed related failures with other candidates as well: some returned
    JSON in `message.content` instead of `message.tool_calls`, while others
    passed a simple tool canary but failed under the multi-tool reflect loop.

    ### Failure classification

    ```mermaid
    flowchart TD
      R[Runner / orchestration] --> R1[Did the intended test actually run?]
      P[Provider / route] --> P1[HTTP status, access gate, timeout, upstream error]
      M[Model behavior] --> M1[Tool choice, continuation, schema, length]
      H[Hindsight integration] --> H1[Tool loop, parsing, error reporting, bank postconditions]

      R1 --> X[Only compare model quality after runner passes]
      P1 --> X
      M1 --> Y[Candidate capability result]
      H1 --> Z[Operation compatibility result]
    ```

    We want to avoid reporting a provider 403/502 or an isolated delegated-worker
    filesystem failure as evidence that a model is unsuitable. Conversely, a
    model returning valid JSON in a generic test should not be treated as proven
    suitable for the real Hindsight reflect contract.

    ## How this feature/guidance would help

    A documented and testable reflect capability contract would let users:

    - choose a model based on the actual Hindsight operation rather than a
      generic OpenAI-compatible smoke test;
    - distinguish tool-calling support from strict JSON Schema support;
    - validate multi-step, multi-tool continuation before touching a real bank;
    - configure a separate reflect model with known timeout/concurrency behavior;
    - diagnose whether a failure is in the runner, provider route, model, or
      Hindsight integration;
    - avoid accidentally accepting a candidate that silently places structured
      data in `message.content` instead of producing `message.tool_calls`.

    ## Proposed solution

    We would appreciate maintainer guidance on the preferred shape, but a useful
    solution could include some combination of:

    1. **A documented reflect model contract**

       Please specify which of the following are mandatory:

       - named tool choice;
       - multiple reflect/retrieval tools;
       - iterative tool-call continuation;
       - preservation of tool-call IDs and roles;
       - strict JSON Schema or another structured-output mode;
       - a final explicit `done`/completion tool;
       - minimum output budget or context requirements.

    2. **An operation-specific readiness probe**

       A dry-run or disposable probe using the same tool definitions and control
       flow as `reflect`, with no memory writes. Ideally it would report compact,
       non-sensitive diagnostics such as:

       ```text
       provider, model, Hindsight version
       tool definitions loaded
       tool_choice accepted
       tool_calls emitted
       tool result accepted
       continuation completed
       final structured result parsed
       ```

    3. **Known-good model/provider examples**

       A small compatibility matrix would be valuable. The provider route matters
       as much as the model name because gateways differ in tool-call and schema
       translation.

    4. **Actionable failure reporting**

       If a model returns ordinary content where a tool call is required, could
       Hindsight return a structured error identifying the failed stage instead
       of a generic HTTP 500? We do not expect raw prompts, credentials, or
       sensitive memory contents in the error.

    5. **Clarification of fallback behavior**

       Should Hindsight reject content-encoded pseudo-tool calls, or is there a
       supported compatibility path? We prefer an explicit, documented behavior
       rather than silently parsing an unsafe or ambiguous format.

    ## Alternatives considered

    - Selecting a model from a provider catalog based only on a `structured_outputs`
      flag. This was insufficient because catalog metadata did not predict the
      complete Hindsight tool loop.
    - Selecting the largest or most capable-looking model. This does not account
      for route-specific tool/schema behavior, provider errors, latency, or
      output truncation.
    - Using a generic tool-call canary as the only gate. This produced false
      positives for the real bank-backed reflect operation.
    - Falling back to free/local models without a controlled contract test. The
      local CPU Gemma route could not complete `retain()` in acceptable time, and
      several cloud candidates passed one interface test but failed another.

    ## Scope / priority

    This is a feature/configuration guidance request, not a claim that one
    provider or model is universally broken. The immediate need is Important:
    the reflect route is a blocking part of our long-term memory workflow, and we
    do not want to experiment directly against a working bank without a reliable
    preflight.

    ## Scope / non-goals

    This issue is only about selecting, validating, and diagnosing the model
    used by Hindsight `reflect`. The separate research project about the
    **context-compression model** that compresses an active chat context is
    intentionally out of scope here:
    it has a different objective, contract, corpus, and evaluation criteria.
    This issue also does not request a change to Hindsight's memory lifecycle or
    supersession data model; that is the separate discussion in issue #3509.

    ## Questions for maintainers

    1. What is the exact model/provider capability contract for `reflect` in
       Hindsight 0.8.6 and current releases?
    2. Which models and OpenAI-compatible routes have you tested successfully for
       the full multi-tool reflect loop?
    3. Is there a recommended disposable or dry-run procedure that exercises the
       real reflect code path without committing memory changes?
    4. Is the HTTP 500 on “no usable tool call” expected behavior, or should it be
       exposed as a more specific integration error?
    5. Are separate operation-specific reflect model settings supported and
       expected to differ from retain/consolidation settings?
    6. Which parameters have the greatest effect on reliability: timeout,
       reasoning effort, temperature, max output tokens, tool choice, or prompt
       format?

    ## Additional context

    All candidate-selection probes were designed as read-only tests and did not
    modify the Hindsight bank. The real reflect failure was verified with a
    before/after bank-count check; counts were unchanged.

    No API keys, credentials, raw memory dumps, private transcripts, or local
    filesystem paths are included here. We can provide a smaller sanitized
    reproducer or additional logs if maintainers indicate which part of the
    contract they would like to inspect.

    Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering
    agent and engineering partner. Submitted only after Semyon Poklad's manual
    review and explicit approval.
  comment: ""
  labels: ["enhancement"]

human_review:
  requested_at: "2026-08-29"
  approved_at: "2026-08-29T00:58:27+02:00"
  approval_scope: "Create exactly this drafted feature/configuration guidance issue in vectorize-io/hindsight; no comments, PR, labels beyond the drafted labels, or other external writes."
  approver: "user"

readback:
  required: true
  expected: "Read back issue number, URL, title, state, labels, and body after the one approved create operation."
  observed: "Created #3870; state OPEN; URL and title match; label enhancement present; comments=0; body matches the approved draft after normalizing LF/CRLF line endings."
  verified_at: "2026-08-29T01:04:46+02:00"

notes: "Published and read-back verified. Exact duplicate check found no duplicate; complementary issues #3647, #3825, #3865, and #3494 were reviewed. Compression-model research remains intentionally out of scope."
