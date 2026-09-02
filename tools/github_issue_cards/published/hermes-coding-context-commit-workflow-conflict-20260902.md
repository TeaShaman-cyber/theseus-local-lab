---
card_id: ISSUE-20260902-HERMES-CODING-COMMIT-WORKFLOW-CONFLICT
status: READ_BACK_VERIFIED
operation: create
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "Create one upstream Hermes bug report for the deterministic conflict between CODING_AGENT_GUIDANCE and project-authorized local checkpoint commits; include the existing bug label and perform exact read-back."
issue_number: 100973
issue_url: "https://github.com/NousResearch/hermes-agent/issues/100973"
issue_type: bug
purpose: "Report that the coding posture says project AGENTS.md wins over defaults while also imposing an absolute no-commit/no-push-unless-asked rule that conflates local checkpoints with remote publication."
duplicate_check: "Exact searches for coding_context plus don't commit, AGENTS.md commit/push, and checkpoint commit found no exact issue. #29652 is a broad behavioral-constraints report; #25833 concerns self-created skill guarantees; #91419 concerns one model violating rules. All are complementary, not duplicates."
labels: [bug]
actual_labels: []
label_outcome: "The create operation succeeded, but GitHub did not apply label bug. The label exists; TeaShaman-cyber lacks upstream push/triage permission (collaborator permission read returned 403). No label retry was attempted."
requested_at: 2026-09-02
human_review: "User explicitly requested that this diagnosed Hermes bug be filed upstream."
packet: "tools/github_issue_cards/published/hermes-coding-context-commit-workflow-conflict-20260902.json"
diagram: "tools/github_issue_cards/published/hermes-coding-context-commit-workflow-conflict-20260902.mmd"
audit: "tools/github_issue_cards/published/hermes-coding-context-commit-workflow-conflict-20260902.audit.json"
readback:
  required: true
  expected: "One new OPEN issue in NousResearch/hermes-agent with exact normalized title/body, label bug, and TeaShaman-cyber as author."
  observed: "Issue #100973 is OPEN at https://github.com/NousResearch/hermes-agent/issues/100973. Author TeaShaman-cyber; normalized title and body match exactly. Requested label bug was not applied because the reporter lacks upstream triage permission; no retry was attempted."
  verified_at: 2026-09-02T07:30:42+02:00

draft:
  title: "[Bug]: coding posture contradicts AGENTS.md on checkpoint commits"
  body: |
    ## Bug Description

    The coding posture injects two incompatible instructions into the same stable
    prompt block:

    1. project instruction files already in context win over the coding defaults;
    2. the agent must not commit **or push** unless the user separately asks.

    This makes a project-authorized local checkpoint ambiguous or effectively
    forbidden. In projects where `AGENTS.md` defines a completed bounded workflow
    as `implement -> verify -> local checkpoint commit`, models repeatedly finish
    the deliverable but leave the worktree dirty or ask for an additional commit
    approval. The issue also conflates a reversible local commit with a remote push.

    The conflict is present on current upstream `main` in
    `agent/coding_context.py` inside `CODING_AGENT_GUIDANCE`.

    ## Steps to Reproduce

    Deterministic prompt reproduction:

    1. Inspect `CODING_AGENT_GUIDANCE` on current `main`.
    2. Observe the project-precedence instruction:

       ```text
       AGENTS.md / CLAUDE.md / .cursorrules already in context win over your defaults.
       ```

    3. Observe the later absolute instruction in the same block:

       ```text
       Respect the user's repo: don't commit, push, or rewrite history unless asked.
       ```

    Behavioral reproduction:

    1. Start Hermes Desktop or CLI in a Git repository with
       `agent.coding_context: auto` (the default).
    2. Put a project rule in `AGENTS.md` stating that a complete, verified bounded
       deliverable receives one local checkpoint commit, while push is evaluated
       separately by downstream effect.
    3. Ask Hermes to complete that bounded workflow without repeating the literal
       word `commit` in the final turn.
    4. The model can complete verification but leave the coherent change set dirty
       or create a pending "commit after explicit approval" step.
    5. A second message explicitly saying `commit` makes it proceed.

    ## Expected Behavior

    The coding posture should preserve repository safety without overriding an
    explicitly approved project workflow:

    - local commit and remote push are separate effects;
    - a project `AGENTS.md` or active bounded workflow may authorize a local
      checkpoint commit;
    - push follows the workflow's destination/downstream-effect gate;
    - force-push and history rewrite remain separately protected.

    ## Actual Behavior

    The shipped absolute `don't commit, push ... unless asked` sentence competes
    with the earlier project-precedence sentence. Because it is categorical and
    groups commit with push/history rewrite, models tend to choose the most
    conservative interpretation and ignore the project's checkpoint contract.

    ```mermaid
    flowchart TD
      A[Hermes coding posture] --> B[AGENTS.md wins over defaults]
      A --> C[No commit or push unless separately asked]
      D[Project bounded workflow] --> E[Verified local checkpoint commit]
      B --> F{Effective instruction}
      C --> F
      E --> F
      F -->|conservative resolution| G[Leave completed worktree dirty]
      F -->|extra user message| H[Commit proceeds]
    ```

    ## Affected Component

    - Agent Core: prompt assembly / coding posture
    - Configuration: `agent.coding_context = auto | on | focus`
    - Surfaces: Desktop, CLI, TUI, and ACP coding workspaces

    ## Environment

    - Operating system: Windows 11, build 26200
    - Python: 3.11.15
    - Hermes: 0.21.0
    - Current upstream source checked: `main`, 2026-09-02
    - Local install contains carried commits, so it was not updated in place;
      the conflicting text was independently verified against current upstream raw source.

    ## Debug Report

    Not uploaded. This is a deterministic source/prompt contradiction and does
    not require private configuration or recent logs to reproduce. No consent was
    given to publish a general debug bundle containing unrelated local metadata.

    ## Root Cause Analysis

    `CODING_AGENT_GUIDANCE` is injected automatically when the coding posture is
    active. It first describes `AGENTS.md` as higher-priority than its defaults,
    then adds an unconditional commit/push prohibition. Both strings occupy the
    stable coding prompt tier, so project workflow authorization is not expressed
    unambiguously.

    `agent.coding_instructions` is appended later and can add another instruction,
    but it does not remove the contradictory shipped sentence. Disabling
    `agent.coding_context` removes the whole useful coding posture and is too broad
    as a workaround.

    ## Proposed Fix

    Replace the combined absolute sentence with workflow-aware wording, for example:

    ```text
    Do not commit or push outside the user-approved workflow. Project instructions
    may authorize a local checkpoint commit for a complete verified deliverable.
    Treat push separately according to destination and downstream effects. Never
    force-push or rewrite history without explicit authorization for that action.
    ```

    Add regression coverage in `tests/agent/test_coding_context.py` that:

    - rejects an absolute combined commit/push prohibition;
    - requires explicit separation of local commit, push, and history rewrite;
    - requires the guidance to respect project/workflow authorization.

    ## Non-goals

    - This is not a request to auto-push every completed task.
    - This does not bypass Git hooks, staging scans, approvals, or protected branches.
    - This does not require changing memory providers or project instruction files.
    - This report is separate from historical-memory supersession behavior.

    ## Related Issues

    - #29652 documents prompt/tool/architecture enforcement generally.
    - #25833 concerns mechanism-level guarantees for self-created skills.
    - #91419 concerns unauthorized actions by one model.

    None describes this exact deterministic conflict in `CODING_AGENT_GUIDANCE`.

    Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent
    and engineering partner. Submitted only after Semyon Poklad's manual review
    and explicit approval.
