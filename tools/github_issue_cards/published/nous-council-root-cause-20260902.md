---
card_id: ISSUE-20260902-NOUS-COUNCIL-ROOT-CAUSE
status: READ_BACK_VERIFIED
operation: comment
project: theseus-model-usage-lab
repository: TeaShaman-cyber/theseus-model-usage-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "Publish exactly one sanitized complementary follow-up comment on research issue #7 recording the advisory-versus-execution runtime root cause and the prevention rule; then perform read-back."
issue_number: 7
issue_url: "https://github.com/TeaShaman-cyber/theseus-model-usage-lab/issues/7"
comment_url: "https://github.com/TeaShaman-cyber/theseus-model-usage-lab/issues/7#issuecomment-5504475796"
issue_type: experiment_root_cause
purpose: "Explain why the implementation-proposal council drifted into tool execution and define the separation required before any future council."
duplicate_check: "Issue #7 already records the observed boundary violation; this complementary comment records the architectural root cause and prevention contract, without opening another issue."
labels: []
requested_at: 2026-09-02
human_review: "User explicitly approved recording this root cause in issue #7 before skill sanitation."
readback:
  required: true
  expected: "Issue #7 remains OPEN and contains exactly one new TeaShaman-cyber comment whose normalized body matches the Draft comment below."
  observed: "Issue #7 remains OPEN. Exactly one comment was published at https://github.com/TeaShaman-cyber/theseus-model-usage-lab/issues/7#issuecomment-5504475796 by TeaShaman-cyber; normalized body matches the approved Draft comment exactly; comments_total=5."
  verified_at: 2026-09-02T06:41:26+02:00

draft:
  body: |
    ## Root cause: advisory council was sent to an execution runtime — 2026-09-02

    The stopped run exposed a more fundamental failure mode than an incomplete
    prompt. We asked for an **advisory implementation proposal**, but dispatched
    it through a full Hermes subagent runtime designed to execute engineering
    work.

    ### The mismatch

    ```text
    intended:
      model -> text-only proposal -> parent compares artifacts

    actual:
      agent -> inherited tools -> inspect repo -> write/validate files
    ```

    A delegated child is not merely a second opinion. It is an autonomous agent
    with the parent's enabled toolsets. A sentence such as “filesystem: none” or
    “do not use tools” is task metadata and a behavioral instruction, not a hard
    capability boundary. The child therefore followed the execution-shaped
    interpretation of the task: it tried to create and validate proposal files.

    This is a substrate mismatch, not evidence of bad faith or model quality.
    The council was sent to the wrong kind of runtime.

    ### Prevention contract

    Future work must separate the modes explicitly:

    - **Text-only council:** pure model completions in a fresh locked-down
      process/profile with `terminal`, `file`, `code_execution`, and unrelated
      network tools disabled; verify the actual tool inventory before fan-out.
    - **Builder:** a tool-enabled agent only in an isolated workspace or
      ephemeral sandbox, never in the operational repository by default.
    - **Verifier:** a fixture/read-only runtime with only the capabilities needed
      for the acceptance checks.
    - **Facilitator:** the parent process enforces convergence, artifact
      requirements, stop conditions, and phase transitions; it does not replace
      capability isolation.

    The preflight validator remains useful for the semantic packet, but it cannot
    remove tools from `delegate_task`. Until a real locked-down advisory runtime
    is verified, no further subagent council should be dispatched for this
    experiment.

    The experiment is therefore closed as a successful diagnosis of an
    orchestration-design gap, but not as evidence that the council produced an
    implementation solution.

    Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent
    and engineering partner. Submitted only after Semyon Poklad's manual review
    and explicit approval.
