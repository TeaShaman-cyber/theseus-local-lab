card_id: ISSUE-20260823-001
status: READ_BACK_VERIFIED

project: "Hermes Agent"
repository: "NousResearch/hermes-agent"
repository_source: "user_contract"
target_confirmation: "user_confirmed"
issue_number: 92570
issue_url: "https://github.com/NousResearch/hermes-agent/issues/92570"
operation: "create"

purpose: "Report a Desktop/TUI session.compress contract bug: /compress --preview is forwarded as a raw focus_topic and performs real in-place compression instead of a side-effect-free preview"
duplicate_check: "checked_live_github; related_cluster_found_but_exact_session_compress_preview_bug_not_found"
evidence:
  - "Upstream #3243 and merged PR #57029 define --preview/--dry-run as zero-write preview semantics for /compress on CLI and gateway paths"
  - "Observed runtime: context compression started with focus='--preview', then committed messages=789->262 and rough_tokens=~201,903"
  - "Current upstream main: apps/desktop/src/app/session/hooks/use-prompt-actions/slash.ts forwards ctx.arg.trim() as focus_topic to session.compress"
  - "Current upstream main: tui_gateway/methods_session.py reconstructs /compress from raw focus_topic; no extract_compress_flags call"
  - "Current upstream main: tui_gateway/server.py::_compress_session_history uses parse_partial_compress_args, not preview/dry-run flag extraction"
  - "Current upstream tests cover gateway/CLI preview and TUI partial-compression routing, but no session.compress --preview no-write invariant"

observed_runtime:
  hermes_version: "Hermes Agent v0.20.5 (2026.8.19)"
  os: "Windows 11 10.0.26200"
  python: "3.11.15"
  node: "v24.18.0"
  debug_report: "https://paste.rs/VM7LJ"
  agent_log: "https://paste.rs/O84Tx"
  gateway_log: "https://paste.rs/GT9UC"
  gui_log: "https://paste.rs/4c6wy"
  desktop_log: "https://paste.rs/chllG"

draft:
  title: "[Bug]: session.compress --preview/--dry-run mutates context in Desktop/TUI paths"
  body: |
    ## Bug Description

    `/compress --preview` is documented and implemented as a side-effect-free
    preview: it should report what would be compressed and make no transcript,
    session, model, or persistence changes.

    In the Desktop/TUI `session.compress` path, the same argument is forwarded
    as a raw `focus_topic`. The backend then treats `--preview` as an ordinary
    focus string and performs a real in-place compression.

    This is related to #3243/#57029 (the preview flag contract) and the
    Desktop compression routing cluster #68218/#68229, but it is a separate
    runtime path: the existing preview tests cover CLI/gateway flag extraction,
    while `session.compress`/Desktop/TUI flag extraction is not covered.

    ## Steps to Reproduce

    1. Run Hermes Desktop on a session with at least four messages.
    2. Record the current visible message count (and, if backend instrumentation
       is available, the session `history_version`).
    3. Enter `/compress --preview` in the chat composer.
    4. Wait for the command to finish.
    5. Verify that no preview report is shown and compare the message count and
       `history_version` with the values recorded before the command.
    6. Inspect `agent.log` for `focus='--preview'` and a committed compression
       attempt.

    ## Expected Behavior

    The command should return a preview similar to:

    ```text
    Preview — no changes made.
    Would compress N of M message(s) (~X tokens currently in context).
    Run the command again without --preview to apply.
    ```

    It must not:

    - call the auxiliary compression model;
    - call `_compress_context`;
    - rewrite or rotate the transcript/session;
    - change token/context state except for read-only reporting.

    `--dry-run` should have identical semantics.

    ## Actual Behavior

    No preview report was shown. The command performed real compression.

    Sanitized runtime evidence:

    ```text
    context compression started: ... focus='--preview'
    context compression done: ... messages=789->262 rough_tokens=~201,903
    compression_attempt: commit_status="committed", split_status="in_place_committed"
    ```

    The same run was later accepted by the provider with a much smaller input
    context, confirming that the transcript had been changed rather than only
    inspected.

    ## Affected Component

    - Agent Core (conversation loop, context compression)
    - Other: Desktop/TUI `session.compress` RPC and slash-command routing

    ## Messaging Platform

    - N/A (Desktop/TUI chat)

    ## Debug Report

    A debug bundle was collected with the user's explicit consent. The raw
    paste links are intentionally not included in this public issue body:
    the bundle contains local filesystem paths and session identifiers, and
    the paste links expire after six hours. The raw links remain in the local
    issue card for maintainer follow-up if requested.

    Sanitized runtime evidence is included inline instead:

    ```text
    context compression started: ... focus='--preview'
    context compression done: ... messages=789->262 rough_tokens=~201,903
    compression_attempt: commit_status="committed", split_status="in_place_committed"
    ```

    ## Environment

    - Operating System: Windows 11 10.0.26200
    - Hermes Version: v0.20.5 (2026.8.19)
    - Python: 3.11.15
    - Node: v24.18.0
    - Surface: Hermes Desktop, TUI gateway-backed session

    ## Root Cause Analysis

    The merged preview implementation in #57029 adds
    `extract_compress_flags()` and `summarize_compress_preview()` to the CLI
    and `gateway/slash_commands.py` paths.

    The current Desktop path is different:

    1. `apps/desktop/src/app/session/hooks/use-prompt-actions/slash.ts`
       forwards `ctx.arg.trim()` as `focus_topic` to `session.compress`.
    2. `tui_gateway/methods_session.py` reads the raw `focus_topic` and rebuilds
       `/compress <focus_topic>`.
    3. `tui_gateway/server.py::_compress_session_history()` calls
       `parse_partial_compress_args()`, which handles boundary forms such as
       `here [N]` but does not extract `--preview` or `--dry-run`.
    4. The raw `--preview` value therefore becomes a focus topic and the normal
       compression path runs.

    The TUI slash mirror is implemented in
    `tui_gateway/methods_tools.py`; it passes `arg.strip()` directly to
    `_compress_session_history()` and has no `extract_compress_flags()` or
    `summarize_compress_preview()` branch.

    The compute-host branch in `tui_gateway/methods_session.py` also rebuilds
    a raw `/compress <focus_topic>` command and forwards it through
    `_send_compute_host_control()`. `tui_gateway/compute_host.py` strips the
    command prefix and passes the remaining raw value back as `focus_topic`.
    This branch therefore needs the same typed flag boundary, or an explicit
    test proving that preview flags are handled before forwarding.

    ## Proposed Fix

    Establish one typed flag-parsing boundary shared by CLI, gateway, TUI, and
    Desktop `session.compress`:

    - extract `--preview`/`--dry-run` before treating remaining text as a focus
      topic;
    - return a structured preview result before constructing an agent or calling
      `_compress_context`;
    - keep preview and dry-run side-effect free;
    - preserve `here [N]`/`--keep N`/focus-topic behavior after flag extraction;
    - add regression tests for `session.compress`, compute-host forwarding,
      command.dispatch/TUI mirror, and the Desktop action;
    - assert that preview makes zero calls to transcript rewrite/update,
      `_compress_context`, and the auxiliary compression model.

    The no-write invariant matters because `/undo` does not universally restore
    pre-compaction history across an in-place compaction boundary (#81130).

    ## Related Issues

    - #3243 — preview/dry-run command contract
    - #57029 — merged implementation for CLI/gateway paths
    - #46686 / #50303 — TUI/Desktop before/after compression feedback
    - #68218 / #68229 — Desktop `session.compress` routing and transcript update
    - #81130 — in-place compaction is not universally reversible with `/undo`

    This is a new route-parity bug, not a duplicate of #3243/#57029: those
    changes cover CLI/gateway flag extraction, while the Desktop/TUI
    `session.compress` path still lacks the same no-write branch.

    ## Scope / Non-goals

    - No change to normal `/compress` semantics.
    - No change to the model or provider used for actual compression.
    - No aggressive hard-truncation behavior.
    - No secrets are included in this report.

    ---

    Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering
    agent and engineering partner. Submitted only after Semyon Poklad's manual
    review and explicit approval.
  labels: ["type/bug", "comp/agent", "comp/desktop", "area/compression", "P2", "sweeper:risk-session-state"]

human_review:
  requested_at: "2026-08-23T01:03:34+02:00"
  approved_at: "2026-08-23T01:35:50+02:00"
  approval_scope: "Create exactly one issue in NousResearch/hermes-agent for the reviewed session.compress --preview/--dry-run route-parity bug; no PR, no extra GitHub mutations."
  approver: "user"

readback:
  required: true
  expected: "After creation, receive a new issue number, URL, title, OPEN state, and body matching this approved draft"
  observed: "Created #92570; state OPEN; author TeaShaman-cyber; title and body match the approved card exactly after LF normalization. Initial read-back saw no labels, but a later read-back confirmed all six requested labels were applied: type/bug, comp/agent, comp/desktop, area/compression, P2, sweeper:risk-session-state."
  verified_at: "2026-08-23T01:45:13+02:00"

notes: "Issue published and fully verified after delayed label propagation. Three independent Nous cold reviews agreed the technical bug is real and novel; Solar was interrupted after a repeated GitHub code-search loop and was not counted as a valid review. Raw debug links were uploaded after explicit user permission and remain card-local only. The hermes debug share uploader was stopped after upload because its Windows PTY process stayed alive after printing the final URLs."
