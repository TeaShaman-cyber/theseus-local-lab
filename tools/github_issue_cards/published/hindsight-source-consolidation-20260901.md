---
card_id: ISSUE-20260901-HINDSIGHT-SOURCE-CONSOLIDATION
status: READ_BACK_VERIFIED
operation: create
issue_number: 3
issue_url: "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/3"
verified_at: 2026-09-01
observed: "GitHub issue #3 read back with matching title/body, state OPEN, and zero comments before the progress update."
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "research-project workflow: create one issue tracking consolidation of Hindsight deployment source into the private lab repository while keeping runtime data, secrets, and OAuth state outside Git"
issue_type: research
purpose: "Make the Hindsight deployment source part of the GitHub-managed Theseus system instead of leaving D:/hindsight as an unversioned source island."
duplicate_check: "issue #2 covers proxy lifecycle; this issue covers source ownership, data boundary, and split-brain prevention"
body:
  title: "Research: make Hindsight deployment source part of theseus-local-lab"
  body: |
    ## Research question

    Can the Hindsight deployment source become part of the private
    `theseus-local-lab` Git repository, while runtime state remains safely
    outside Git?

    This is complementary to issue #2 (Docker-owned Hermes Subscription Proxy)
    and `theseus-research#6` (GitHub Free as cross-project infrastructure).

    ## Current facts

    - `D:/hindsight/docker-compose.yml` is the current Compose source but is not
      inside a Git repository.
    - `docs/reference/infrastructure-registry.yaml` is versioned in the main lab
      but currently points Hindsight at the unversioned D: root.
    - `D:/hindsight` mixes Compose source, probes, generated files, secrets,
      OAuth state, embedded pg0 data, and historical backups.

    ## Proposed boundary

    ```text
    theseus-local-lab/deploy/hindsight/
      docker-compose.yml   # canonical desired configuration
      README.md             # ownership, commands, recovery, boundaries
      .env.example          # non-secret path template

    D:/hindsight/
      .env, pg0/, logs       # runtime state; never committed

    Docker volume
      theseus-hermes-proxy-data  # OAuth state; never committed
    ```

    ## Acceptance criteria

    - [ ] Canonical Compose source is tracked under `deploy/hindsight/`.
    - [ ] Registry points to the Git source and records external env/data/auth roots.
    - [ ] Secrets, OAuth state, pg0, logs, generated OpenAPI, and credentials are
      absent from Git.
    - [ ] Git-owned Compose validates and reads back the existing Hindsight and
      proxy services without changing the bank.
    - [ ] The old unversioned Compose source is removed or explicitly archived
      after verification, preventing split-brain configuration.
    - [ ] A local checkpoint is committed and pushed to this private repo.

    ## Non-goals

    - Do not migrate or re-embed the Hindsight bank.
    - Do not copy Desktop `auth.json` or the proxy OAuth volume into Git.
    - Do not add Notion synchronization or automatic publication here.

    ## Next distinguishing probe

    Run the same Compose project from the Git-owned file, compare effective
    non-secret configuration and live postconditions, then retire the duplicate
    external Compose source.
