# Hindsight Production Upgrade Design

Status: proposed; review-only draft
Tracking issue: `TeaShaman-cyber/theseus-local-lab#24`

## Problem

The production Hindsight runtime is pinned to `ghcr.io/vectorize-io/hindsight:0.8.6` from 2026-07-29. The API health, bank listing, memory listing, and stats paths respond, but two bounded production recall probes timed out. The container log points at `dateparser` language detection in the temporal extraction path. The production bank also contains newly retained current-session facts, including assistant-generated summaries, while Hermes automatic recall/prefetch remains disabled.

The upstream Hindsight fix `#3452` was merged on 2026-08-13 and adds a temporal-extraction prefilter and related performance/correctness tests. Upstream issue `#5645` describes the same recall-path contention class and was closed after the prefilter was present on current `main`. Upstream latest release observed during planning is `v1.1.0` (2026-10-21). The existing pg0 migration caveat is tracked upstream as `#2602`.

## Goal

Prepare a reviewed, reversible upgrade path from Hindsight `0.8.6` to a supported release that restores bounded recall behavior and preserves the production bank, retain path, exact model routes, and rollback capability.

## Invariants

- Production bank `hermes`, `D:/hindsight/pg0`, and the `theseus-hermes-proxy-data` volume are not deleted or modified during planning or disposable rehearsal.
- Hindsight `retain` remains enabled. Hermes `auto-recall/prefetch` remains disabled until its separate audit gate is satisfied.
- General route remains exactly two members: Nous Solar Mini through `hermes-proxy` primary and BotHub Mistral fallback. No gpt-oss or new model is introduced.
- Reflect route remains separate and unchanged unless a later issue explicitly authorizes it.
- Provider keys, OAuth state, raw memory, and exported production content remain outside Git and outside PRs.
- No direct SQLite editing or unsupported database transfer is used.
- Production `hermes` bank reads and recall probes are executed by a Hermes-owned executor or the human operator, who returns sanitized evidence; a Codex worker does not read or query that bank.
- A consistent pre-upgrade pg0 checkpoint exists and its restore was rehearsed with the pinned `0.8.6` image before any promotion, because reverting the image does not revert the database.
- The upgrade-window write policy is declared in advance: either the candidate is migrated and verified while retain continues, or retain is stopped for a stated window with the accepted loss boundary recorded.
- A Docker health result is never accepted as proof of a working Hindsight read or model route.
- Promotion to the live stack requires successful disposable rehearsal, fresh read-back, Codex review, and Semyon Poklad's explicit approval.

## Candidate matrix

- `v0.9.2`: first practical candidate after the temporal prefilter and several retain/recall fixes; use as an intermediate compatibility probe if direct latest upgrade is not safe.
- `v1.1.0`: current upstream latest observed during planning; preferred target only after migration and route compatibility gates pass.
- `0.8.6`: rollback baseline; preserve exact image and digest evidence before any candidate test.

## Acceptance contract

A candidate must pass all of the following on an isolated runtime and disposable bank:

1. candidate starts from a baseline-format `0.8.6` store, and image/version plus the explicit migration complete without touching production pg0;
2. API health, bank list, stats, and memory list read back;
3. date-free, absolute-date, and relative-date recall cases return within the declared bound with correct temporal constraints;
4. retain remains successful and consolidation drains to zero pending work;
5. recall can retrieve the retained fixture and no request hangs in temporal extraction;
6. current general and reflect route identities are visible in Hindsight request traces;
7. failed operations, provider errors, and rollback behavior are recorded separately;
8. disposable data and runtime are removed only after an absence read-back;
9. the pre-upgrade checkpoint restores under the pinned `0.8.6` image and returns the same bank identities and a sample read.

The live promotion gate repeats the read-path and route checks against production, but does not require production writes beyond the user-approved migration and upgrade operations. The migration runs as its own approved step behind the verified checkpoint, before the candidate API starts, because `HINDSIGHT_API_RUN_MIGRATIONS_ON_STARTUP=false` in `deploy/hindsight/docker-compose.yml`.

## Non-goals

- no production bank cleanup, invalidation, reprocess, or delete;
- no automatic recall re-enable;
- no model benchmark expansion before the upgrade compatibility gate;
- no community plugin or observability change;
- no merge, release, or deployment as part of the review draft.
