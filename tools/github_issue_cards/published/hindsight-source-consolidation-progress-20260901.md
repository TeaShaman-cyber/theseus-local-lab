---
card_id: ISSUE-20260901-HINDSIGHT-SOURCE-CONSOLIDATION-PROGRESS
status: READ_BACK_VERIFIED
operation: comment
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "research-project workflow: append one verified source-consolidation progress update to issue #3"
issue_number: 3
issue_url: "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/3"
comment_url: "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/3#issuecomment-5500065340"
verified_at: 2026-09-01
observed: "Progress comment read back with body_match=true and comments_total=1."
issue_type: progress_update
purpose: "Record the verified migration of Hindsight Compose source into Git while keeping runtime state external."
duplicate_check: "Issue #2 tracks proxy lifecycle; issue #3 tracks Hindsight source ownership and split-brain prevention."
labels: []

draft:
  body: |
    ## Source consolidation progress — 2026-09-01

    The Hindsight deployment source is now part of the canonical
    `theseus-local-lab` repository.

    ### Verified

    - Canonical Compose source is tracked at `deploy/hindsight/docker-compose.yml`.
    - Git-owned Compose config validates with the real external runtime env file,
      without printing or storing credentials.
    - The existing `hindsight-cloud` project was force-recreated from the Git
      source; Docker labels now point to the repository Compose file.
    - The existing pg0 bind mount remains `D:/hindsight/pg0`.
    - OAuth state remains in the existing named volume
      `theseus-hermes-proxy-data`; `/opt/data/auth.json` remains mode `600`.
    - Hindsight health returned HTTP 200 and a read-only recall returned 4 results.
    - The former `D:/hindsight/docker-compose.yml` was moved reversibly to
      `D:/theseus-archive/hindsight/docker-compose-legacy-20260901.yml`, so the
      runtime root no longer contains a second active Compose source.
    - No Hindsight bank data, credentials, OAuth state, logs, model files, or
      generated OpenAPI artifacts were copied into Git.

    ### Current limitation

    - The proxy process is healthy, but current Nous `/v1/models` and Solar
      `/v1/chat/completions` probes return Cloudflare error 1010 from
      `inference-api.nousresearch.com`. This is recorded as a current data-plane
      caveat, not misreported as a source-migration failure; historical successful
      Solar route evidence remains preserved in the registry and issue #2.

    The registry and README now point to the Git-owned source. The remaining
    cold-boot reliability probe is intentionally not performed as part of this
    migration.
