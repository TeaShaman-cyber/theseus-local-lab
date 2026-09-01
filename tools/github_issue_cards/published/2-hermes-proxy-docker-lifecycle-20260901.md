---
card_id: ISSUE-20260901-HERMES-PROXY-DOCKER
status: READ_BACK_VERIFIED
operation: create
project: theseus-local-lab
repository: TeaShaman-cyber/theseus-local-lab
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "research-project workflow: create one complementary issue tracking a Docker-owned Hermes Subscription Proxy proof-of-concept without Hermes Desktop, Windows Run, Task Scheduler, or registry ownership"
issue_number: 2
issue_url: "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/2"
verified_at: 2026-09-01
observed: "Live read-back verified issue #2 OPEN in TeaShaman-cyber/theseus-local-lab: title and body match the approved card after LF/CRLF normalization; labels=[]; comments=0."
issue_type: research
purpose: "Track the bounded research and operational contract for running Hermes Subscription Proxy as a Docker Compose sibling service so Hindsight can use Nous OAuth-backed Solar without coupling proxy lifecycle to Hermes Desktop or copying static credentials."
duplicate_check: "completed: issue #1 covers monolith-vs-split repository structure; this issue is complementary and has a distinct runtime ownership, authentication, recovery, and acceptance boundary"
evidence:
  - "Official Hermes CLI contract: hermes proxy start runs a foreground OpenAI-compatible proxy and has no built-in service-install subcommand."
  - "The local Hindsight stack already has a compose source at D:/hindsight/docker-compose.yml and hindsight-api uses restart: unless-stopped."
  - "A live disposable probe previously verified that hindsight-api can reach a host proxy through host.docker.internal:8645 and receive HTTP 200; this is routing evidence, not proof of durable lifecycle."
  - "Nous Solar access requires the Hermes-managed OAuth credential path in the observed environment; static API-key probes did not establish Solar compatibility."
  - "No credentials, OAuth state, private transcripts, or raw tokens are included in this card."
labels: []

draft:
  title: "Research: Docker-owned Hermes Subscription Proxy lifecycle independent of Hermes Desktop"
  body: |
    ## Research question

    Can the Hermes Subscription Proxy run as a durable Docker Compose sibling service,
    independent of Hermes Desktop and without Windows Run, Task Scheduler, registry
    entries, or copied static Nous credentials, while serving Hindsight's Solar route
    reliably after restart and proxy failure?

    This is complementary to issue #1 (repository structure): #1 addresses when a
    research line should split into another repository; this issue addresses ownership
    and recovery of one runtime service inside the existing infrastructure boundary.

    ## Current facts

    - `hermes proxy start` is a foreground OpenAI-compatible server. The current CLI
      exposes `start`, `status`, and `providers`; it does not expose a native
      service-install or daemon command.
    - Hindsight is already operated as a Docker Compose stack with
      `restart: unless-stopped` and a registered compose source at
      `D:/hindsight/docker-compose.yml`.
    - A host-owned proxy was reachable from `hindsight-api` through
      `host.docker.internal:8645` during a disposable probe. That proves the network
      path can work when a proxy process is manually alive; it does not prove
      restart ownership or authentication durability.
    - In the observed Nous environment, Solar access is available through the
      Hermes-managed OAuth credential path, while static API-key tests did not
      establish a working Solar route.

    ## Inference to test

    A sibling container with a persistent, dedicated Hermes auth profile and
    `restart: unless-stopped` should provide a cleaner ownership boundary than a
    process launched by Hermes Desktop. Hindsight should use the Compose service
    name (for example, `hermes-proxy:8645`) rather than a host loopback or a
    host-published port.

    This remains an inference until the complete disposable workflow passes.

    ## Unknowns

    - Whether the current Hermes proxy can be packaged and run in a supported
      Linux container without relying on the Windows Hermes installation.
    - Whether first-time Nous OAuth login can be completed safely into a dedicated
      persistent proxy profile without copying the Desktop `auth.json`.
    - Whether Docker Desktop startup/recovery behavior is sufficient for the
      existing Hindsight stack after a host reboot.
    - Whether a minimal healthcheck can distinguish a listening proxy from a
      usable Nous/Solar data path.
    - Whether the proxy refresh path remains reliable after container recreation
      and after the OAuth credential approaches expiry.

    ## Bounded proof-of-concept

    1. Build or select a pinned Hermes proxy runtime for a disposable Compose
       service; do not alter the production route yet.
    2. Create a dedicated persistent Hermes home for the proxy. Do not bind-mount
       the Desktop auth store and do not put credentials in Git or the registry.
    3. Complete one manual OAuth login into that dedicated profile.
    4. Run the proxy on an internal Compose network with no host port publication.
    5. Verify `/health` (or the smallest equivalent), `/v1/models`, and a bounded
       `upstage/solar-pro4:free` completion.
    6. Verify Hindsight's read-only route to the service, then kill and recreate
       only the proxy container and verify automatic recovery.
    7. Verify the Hindsight data-plane postcondition with a bounded no-loss check;
       do not treat Docker health as proof of memory read/retain correctness.
    8. Record the result and rollback path in the infrastructure registry and the
       model/helper chronology.

    ```mermaid
    flowchart LR
      D[Docker Engine] --> P[hermes-proxy sibling]
      P --> N[Nous OAuth / agent_key refresh]
      H[hindsight-api] -->|internal hermes-proxy:8645| P
      H --> M[bounded memory-route verification]
      P --> R{kill and restart}
      R --> P
    ```

    ## Non-goals

    - No Hermes Desktop child process as proxy owner.
    - No Windows Run key, Task Scheduler task, VBS launcher, or equivalent
      unreviewed startup mutation.
    - No copying of the Windows Desktop `auth.json` into a Linux container.
    - No claim that LongCat is an equivalent replacement for Solar; model quality
      equivalence is outside this lifecycle issue.
    - No upstream Hermes feature request is implied until the proof-of-concept
      identifies a reusable product gap.

    ## Acceptance criteria

    - [ ] Proxy process ownership is Docker Compose, not Hermes Desktop.
    - [ ] No registry, Task Scheduler, VBS launcher, or host-published proxy port
          is required.
    - [ ] Dedicated auth state persists across container recreation and contains
          no repository-tracked secret.
    - [ ] `hermes-proxy` health and `/v1/models` checks pass.
    - [ ] Solar completion passes through the proxy with a non-empty response.
    - [ ] Hindsight reaches the proxy over the internal Compose network.
    - [ ] A forced proxy-container failure is automatically recovered and
          read-back verified.
    - [ ] Registry and dated chronology evidence identify the compose source,
          runtime owner, auth boundary, recovery policy, and verification status.

    ## Rollback

    Stop and remove only the disposable proxy service and restore Hindsight's
    previous direct route or disabled Solar member before any production restart.
    Do not delete auth volumes or Hindsight data without a separate explicit
    decision.

    Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent
    and engineering partner. Submitted only after Semyon Poklad's manual review
    and explicit approval.
