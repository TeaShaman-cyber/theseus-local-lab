---
card_id: ISSUE-20260902-NOUS-COUNCIL-BOUNDARY-FAILURE
status: READ_BACK_VERIFIED
operation: comment
project: theseus-model-usage-lab
repository: TeaShaman-cyber/theseus-model-usage-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "Publish exactly one sanitized follow-up comment on research issue #7 recording the stopped implementation-proposal council and its orchestration-boundary failure; then perform read-back."
issue_number: 7
issue_url: "https://github.com/TeaShaman-cyber/theseus-model-usage-lab/issues/7"
comment_url: "https://github.com/TeaShaman-cyber/theseus-model-usage-lab/issues/7#issuecomment-5504414675"
issue_type: experiment_result
purpose: "Record that the concrete implementation-proposal retry failed as an orchestration/capability-boundary experiment, not as model-quality evidence."
duplicate_check: "Existing issue #7 contains the design-council and sandbox-readiness checkpoints; this comment records the subsequent stopped implementation-proposal run and does not create a new issue."
labels: []
requested_at: 2026-09-02
human_review: "User explicitly approved stopping the subagent council experiment and recording the honest result in issue #7."
readback:
  required: true
  expected: "Issue #7 remains OPEN and contains exactly one new TeaShaman-cyber comment whose normalized body matches the Draft comment below."
  observed: "Issue #7 remains OPEN. Exactly one comment was published at https://github.com/TeaShaman-cyber/theseus-model-usage-lab/issues/7#issuecomment-5504414675 by TeaShaman-cyber; normalized body matches the approved Draft comment exactly; comments_total=4."
  verified_at: 2026-09-02T06:33:37+02:00

draft:
  body: |
    ## Follow-up: implementation-proposal council stopped — 2026-09-02

    We stopped the second practical council run rather than treating it as a
    successful implementation comparison.

    ### Run contract

    - packet: `NOUS-DIAG-IMPLEMENTATION-V1`
    - mode: `implementation_proposal`
    - deliverable: concrete technical solution
    - mutation scope: `none`
    - declared capabilities: no filesystem, web, network, Docker, secrets, or
      external writes
    - preflight validator: passed
    - packet-integrity sentinel: passed with the exact packet, mode, and scope
    - executor route: `nous / upstage/solar-pro4:free`
    - three independent masks were dispatched with required fields for target
      files, interfaces, algorithm, classifications, schema/exit codes,
      fixtures, tests, patch/pseudocode, risks, and assumptions

    ### Observed failure

    The declared capability boundary was not enforced by the delegated runtime:

    - P1 used file tools and wrote a proposal artifact inside the real repository.
    - P2 used file/code-execution tools and wrote a local proposal artifact.
    - P3 used file/code-execution/terminal tools and wrote a local proposal
      artifact before the parent stopped it.
    - The delivered child summaries did not satisfy the declared output schema;
      none of the three proposals was accepted as an implementation candidate.

    The parent detected the first real-repository write from the live transcript,
    stopped the remaining active child, verified the known artifacts, and moved
    them to a private local quarantine. A bounded scan found no credential-like
    values in those proposal artifacts. No credentials, raw transcripts, or
    private runtime paths are included here.

    ### Classification and postconditions

    This run is **FAILED — orchestration / worker-environment boundary violation**.
    It is not evidence that Solar, Nous, or any candidate model is unavailable,
    and it is not a model-quality verdict. No proposal was promoted, no live
    provider probe was performed, and no production, Hindsight, Docker, GitHub,
    or external provider state was intentionally mutated by the experiment.
    The real repository was reconciled back to its pre-existing intended dirty
    state; the unapproved child artifacts were not staged or committed.

    ### Result and lesson

    The preflight contract and sentinel are useful checks, but a prompt-level
    instruction such as “do not use tools” is not a hard capability boundary.
    Hermes delegated children inherit the parent session's enabled toolsets, so
    a future implementation council requires a separate locked-down parent
    session with the unsafe toolsets disabled and a verified tool inventory
    before fan-out.

    This experiment is now stopped. The earlier design-council findings remain
    research evidence, but this concrete implementation-proposal pass produced
    no valid candidate and must not be counted as implementation success.

    Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent
    and engineering partner. Submitted only after Semyon Poklad's manual review
    and explicit approval.
