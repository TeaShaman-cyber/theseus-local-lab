---
card_id: ISSUE-20260902-DEVOPS-SKILL-PORTFOLIO
status: READ_BACK_VERIFIED
operation: create
issue_number: 5
issue_url: "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/5"
verified_at: 2026-09-02T09:00:52+02:00
observed: "Issue #5 read back with matching title/body, state open, author TeaShaman-cyber, zero comments, and no labels."
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "User identified this DevOps Skill Hub review as a research issue for the current project."
issue_type: research-design
purpose: "Curate a context-aware DevOps skill portfolio for Theseus without source bias, mass installation, or duplicated operational routes."
duplicate_check: "No matching issue found for DevOps skills, Skill Hub portfolio, or observability/SRE skills."
body:
  title: "Research: curate a context-aware DevOps skill portfolio for Theseus"
  body: |
    ## Research question

    Which Hermes Skill Hub DevOps skills add durable value to Theseus beyond
    its existing tools, without expanding secret access, destructive autonomy,
    infrastructure duplication, or false routing?

    ## Why this is a research issue

    Theseus already has repository-specific Docker control, recovery,
    observability, GitHub, IaC, cloud-placement, and diagnostic routes. A broad
    DevOps search can easily install impressive but redundant or incompatible
    skills. Registry provenance matters, but it is not a verdict: official and
    community skills must pass the same content, capability, and overlap review.

    ## Baseline evidence

    - 715 unique candidates were collected from 32 source-neutral Hub queries.
    - Ten candidates were inspected across observability, SRE, networking,
      monitoring, security, FinOps, CI/CD, Hermes containers, and watchers.
    - Official skills can also trigger `DANGEROUS` scan verdicts, so source
      trust is only one signal.
    - `docker-management` and `rest-graphql-debug` are installed and enabled.
    - Existing local executors include `docker_control_plane`,
      `workshop_recovery`, `tool_policy`, `session_timeline`, `log-lattice`,
      `backup-lattice`, GitHub workflows, and infrastructure registries.

    ## Initial candidate map

    | Candidate | Source | Incremental value | Current finding |
    |---|---|---|---|
    | `logging-observability` | ClawHub | Structured logs, RED/USE, OpenTelemetry, PII scrubbing | Promising; full-source scan pending |
    | `sre-practices` | ClawHub | SLI/SLO, error budgets, toil | Useful method, possibly too heavy for a hobby lab |
    | `watchers` | official | RSS/JSON/GitHub polling with watermarks | Good implementation, but overlaps blogwatcher, cron monitor, and GitHub watch tools |
    | `hermes-s6-container-supervision` | official | Hermes Docker internals | Useful only when modifying or debugging the Hermes image |
    | `dns-networking` | ClawHub | DNS/TLS/proxy troubleshooting | Inspect exposed metadata but no SKILL.md preview; evidence incomplete |
    | `infra-watchdog` | ClawHub | HTTP/TCP/SSL/Docker/DNS monitoring | Requires another OpenClaw runtime, cron, and messaging; duplicates local services |
    | `agent-security-monitor` | ClawHub | Skill, secret, SSH, log, and history scanning | Capability surface is too broad for current secret boundaries |
    | `cicd-pipeline` | ClawHub | GitHub Actions templates | Substantially overlaps installed GitHub skills |
    | `finops` | ClawHub | Cloud-cost framework | Framework-heavy; partially overlaps free-first and cloud-placement policy |
    | `oss-forensics` | official | Evidence-first supply-chain forensics | Requires delegation/multi-agent workflow; defer to incident scope |

    ## Review method

    ```mermaid
    flowchart LR
      H[Skill Hub inventory] --> I[Inspect content and files]
      I --> M[One Sol, three masks]
      M --> S[SRE value]
      M --> D[DevSecOps risk]
      M --> W[Windows and Docker fit]
      S --> G[Install, defer, reject, or adopt ideas]
      D --> G
      W --> G
    ```

    The mask review stays inside one context-rich Sol session. It is not a
    subagent council and does not fan out tools, providers, or sandboxes.

    ## Acceptance criteria

    - [ ] Preserve a source-neutral candidate inventory and duplicate map.
    - [ ] Inspect full SKILL.md, linked scripts, dependencies, and permissions
      for every install candidate.
    - [ ] Record the Hub security-scan verdict and classify false positives
      rather than treating `official` or `community` as automatic decisions.
    - [ ] Compare each candidate with installed skills, project tools, runtime
      ownership, and Windows/Docker boundaries.
    - [ ] Produce separate SRE, DevSecOps, and Windows/Docker mask verdicts plus
      one consolidated decision.
    - [ ] Classify candidates as `install`, `defer`, `reject`, or `adopt ideas`.
    - [ ] Install at most one reviewed skill per explicit approval; verify its
      exact files and enabled inventory before continuing.
    - [ ] Run one bounded representative task before declaring an installed
      skill useful.
    - [ ] Record any accepted durable routing change without copying secrets,
      credentials, private transcripts, or runtime data.

    ## Boundary

    This issue does not authorize bulk installs, subagent councils, new Docker
    stacks, cloud resources, secrets access, monitoring agents, cron jobs, or
    config changes. Every install or runtime mutation remains a separate gate.

    Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering
    agent and engineering partner. Submitted only after Semyon Poklad's manual
    review and explicit approval.
---
