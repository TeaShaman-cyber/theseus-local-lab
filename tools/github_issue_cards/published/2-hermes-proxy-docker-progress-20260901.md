---
card_id: ISSUE-20260901-HERMES-PROXY-DOCKER-PROGRESS
status: READ_BACK_VERIFIED
operation: comment
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "research-project workflow: append one verified Docker-owned Hermes Subscription Proxy POC progress update to issue #2"
issue_number: 2
issue_url: "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/2"
comment_url: "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/2#issuecomment-5499304388"
verified_at: 2026-09-01
observed: "Live read-back verified progress comment on issue #2: comment body matches after LF/CRLF normalization; issue body unchanged; comments_total=2."
issue_type: progress_update
purpose: "Record verified runtime evidence and limitations without credentials or private auth state."
duplicate_check: "Existing comment is a cross-project auth note; this is the runtime POC update."
labels: []

draft:
  body: |
    ## POC progress — 2026-09-01

    The Docker-owned proxy POC reached a runtime-verified state.

    ### Verified

    - Official `nousresearch/hermes-agent` image pulled successfully (digest recorded locally).
    - Dedicated named volume `theseus-hermes-proxy-data` initialized by one manual Nous OAuth login; Desktop `auth.json` was not copied or bind-mounted.
    - `hermes-proxy` runs as a Compose sibling with `restart: unless-stopped`, no host-published proxy port, and healthy internal listener.
    - From `hindsight-api`, `http://hermes-proxy:8645/v1/models` returned HTTP 200 and included `upstage/solar-pro4:free`.
    - Bounded Solar completion through the proxy returned HTTP 200 with non-empty content, including after proxy recovery.
    - Hindsight was recreated with `LLM_2_BASE_URL=http://hermes-proxy:8645/v1` and weights `[3,1,1]`.
    - Hindsight LLM trace contains successful `upstage/solar-pro4:free` `retain_extract_facts` calls, proving the internal route.
    - Hindsight API health and read-only recall returned HTTP 200 after recreation.

    ### Limitations

    - Docker Engine cold-boot/start-after-host-reboot was not tested; it remains the next distinguishing probe.
    - Optional Hindsight bank LLM-health endpoint is disabled and was not enabled for this experiment.
    - A no-persistence dry-run exceeded 180 seconds while existing Nemotron backlog work was active; it was not retried and is not classified as Solar failure.
    - Existing pending retain operations were left intact; no memory or operation records were deleted.

    Registry is promoted from `planned-poc` to runtime-verified with these limitations. No Windows Run key, Task Scheduler, VBS launcher, static API key, or Hermes Desktop process owns the proxy.
