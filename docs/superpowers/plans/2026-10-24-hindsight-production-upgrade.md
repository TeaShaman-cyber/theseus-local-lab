# Hindsight Production Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the production Hindsight service from `0.8.6` to a reviewed supported release without losing the `hermes` bank, retain path, exact model routes, or rollback capability.

**Architecture:** Treat the upgrade as a staged operational change, not an image-tag edit. First capture a read-only baseline, then rehearse migration and recall on an isolated runtime and disposable bank, then prepare a narrowly scoped compose/registry change. Production promotion is a separate gate after Codex review and explicit human approval.

**Tech Stack:** Docker Compose, Hindsight HTTP API, embedded pg0, Hermes proxy, Node.js read-only verification helper, GitHub draft PR, Codex review connector.

**Spec:** `docs/superpowers/specs/2026-10-24-hindsight-upgrade-design.md`

## Global Constraints

- Keep production bank `hermes`, `D:/hindsight/pg0`, and Docker volume `theseus-hermes-proxy-data` unchanged during planning and disposable rehearsal.
- Keep Hindsight `retain` enabled; keep Hermes automatic recall/prefetch disabled.
- Preserve the exact general route: `upstage/solar-mini4:free` through `hermes-proxy` primary and `mistral-medium-3-5` fallback.
- Do not change the separate reflect route in this upgrade.
- Do not copy provider keys, OAuth state, raw memory, or exported production content into Git, the PR, or memory.
- Do not edit SQLite or mutate production operation rows directly.
- Treat `health=200` as insufficient; require API read, recall, retain, consolidation, and route read-back.
- Do not run `docker compose down -v`, delete pg0, delete banks, invalidate memories, or re-enable auto-recall.
- Use explicit paths and stage only files owned by this plan.
- Run `node tools/git_safety/scan_staged.mjs` before every commit.

## Review Focus

- Existing pg0 migration state: startup migration must not crash-loop or silently create an empty store; verify the documented explicit migration path from upstream #2602.
- Recall temporal extraction: a simple query must not hang in `dateparser`/temporal analysis; verify the upstream #3452 prefilter is present in the candidate.
- Route identity: Solar/Mistral general members and the separate reflect member must remain distinct and exact.
- Retain/consolidation semantics: retain must remain enabled, completed operations must drain, and a failed provider call must not be mistaken for a successful memory write.
- Rollback boundary: an unsuccessful candidate must return to the pinned `0.8.6` image without deleting production data or proxy OAuth state.

---

### Task 1: Freeze the baseline and create the read-only verification contract

**Files:**
- Create: `tools/hindsight_upgrade/verify_hindsight.mjs`
- Test: `tools/hindsight_upgrade/verify_hindsight.test.mjs`
- Create: `docs/runbooks/hindsight-production-upgrade.md`

**Interfaces:**
- `probeHindsight({ baseUrl, bankId, timeoutMs, fetchImpl }) -> Promise<Receipt>`: performs only GET requests for health, version, bank list, bank stats, memory list, and operations.
- `probeRecall({ baseUrl, bankId, query, queryTimestamp, timeoutMs, fetchImpl }) -> Promise<RecallReceipt>`: performs one bounded POST to the read-only recall endpoint and records timeout/error distinctly; it never calls retain, consolidate, retry, delete, or reflect.
- CLI: `node tools/hindsight_upgrade/verify_hindsight.mjs --base-url http://localhost:8888 --bank-id hermes --mode baseline`.
- CLI: `node tools/hindsight_upgrade/verify_hindsight.mjs --base-url http://localhost:8888 --bank-id disposable-upgrade --mode recall --query "Hindsight model provider route" --query-timestamp 2026-10-24T10:00:00Z`.

- [ ] **Step 1: Write failing contract tests**

Cover:

1. a successful read receipt contains version, bank id, counts, endpoint statuses, and `mutated=false`;
2. a timeout is reported as `RECALL_TIMEOUT`, not as an empty result or success;
3. non-200 responses preserve endpoint and status without printing response bodies unboundedly;
4. the helper never sends POST to retain/consolidate/delete paths;
5. the output omits authorization headers, environment values, memory text, and raw provider errors.

- [ ] **Step 2: Run the focused test before implementation**

Run: `node --test tools/hindsight_upgrade/verify_hindsight.test.mjs`

Expected: FAIL because the verifier is absent.

- [ ] **Step 3: Implement the bounded read-only verifier**

Use built-in Node modules and injectable `fetchImpl`. Bound each request and each diagnostic field. Return structured statuses `PASS`, `TIMEOUT`, `HTTP_ERROR`, `SCHEMA_ERROR`, or `UNKNOWN`. Do not add retries in the first version; repeated recall hangs must remain visible.

- [ ] **Step 4: Run the focused test**

Run: `node --test tools/hindsight_upgrade/verify_hindsight.test.mjs`

Expected: PASS with all contract cases.

- [ ] **Step 5: Write the runbook from the verified interfaces**

Document baseline, disposable project naming, migration commands, candidate gates, rollback, cleanup, and evidence fields. The runbook must state that `retain` stays enabled and automatic Hermes recall stays disabled.

- [ ] **Step 6: Commit the verifier and runbook only**

```text
git add tools/hindsight_upgrade/verify_hindsight.mjs tools/hindsight_upgrade/verify_hindsight.test.mjs docs/runbooks/hindsight-production-upgrade.md
node tools/git_safety/scan_staged.mjs
git commit -m "test: add bounded Hindsight upgrade verifier"
```

### Task 2: Capture a fresh production baseline without changing production

**Files:**
- Modify: `docs/audits/hindsight-upgrade-baseline-2026-10-24.md`

- [ ] **Step 1: Run the verifier against the live API**

Run the baseline mode against `http://localhost:8888`, bank `hermes`, with a bounded timeout. Record only counts, versions, statuses, operation summaries, and route/model identifiers from the existing read-only ledger. Do not include memory text, provider account identifiers, keys, or raw traces.

- [ ] **Step 2: Run one bounded recall probe**

Use an explicit timestamp and a simple observation-only query. Record `PASS` or `RECALL_TIMEOUT` with elapsed time. Do not retry indefinitely and do not call retain.

- [ ] **Step 3: Verify the baseline artifact**

Run `git diff --check` and a local redaction check that rejects secret-looking values, raw authorization headers, and unbounded memory text. Expected: bounded evidence only.

- [ ] **Step 4: Commit the baseline evidence**

Stage only the audit artifact, run the staged secret scanner, and commit with a reference to #24. This commit must not contain runtime config or exported bank data.

### Task 3: Rehearse migration on an isolated runtime and disposable bank

**Files:**
- Modify: `docs/runbooks/hindsight-production-upgrade.md`
- Create: `docs/audits/hindsight-upgrade-rehearsal-<run-id>.md` outside the production data root or as a sanitized checked-in summary

- [ ] **Step 1: Prepare an isolated data boundary**

Use a unique disposable Compose project and a new pg0 root outside `D:/hindsight/pg0`. Prefer supported Hindsight export/import or a verified stopped-runtime copy; do not copy live pg0 while it is running. If production content must be copied for schema rehearsal, obtain a separate explicit approval and keep the copy local, temporary, and excluded from Git.

- [ ] **Step 2: Verify candidate image metadata**

Test the exact pinned image digest for `v0.9.2` first and `v1.1.0` second. Confirm the candidate contains the temporal prefilter from upstream #3452. If the image cannot reach readiness, classify it as `BENCHMARK_INFRA_BLOCKED`, not as a model failure.

- [ ] **Step 3: Run the explicit pg0 migration path**

Keep startup migration behavior aligned with the known pg0 workaround from upstream #2602. Inspect the candidate's `hindsight-admin --help`, run the documented migration command against the disposable pg0 only, and read back schema readiness before starting the API. Do not run migrations against production.

- [ ] **Step 4: Run candidate API gates**

For each candidate, verify health, version, bank list, stats, memory list, and operations. Then run the bounded recall probe. A timeout or dateparser stack trace blocks the candidate.

- [ ] **Step 5: Run a fixed sanitized retain/consolidation/recall fixture**

Retain a small deterministic fixture with stable `document_id`, explicit timestamp, context, and tags. Wait for pending operations to drain. Read back the retained fact and run recall against it. Record provider/model/usage traces separately from semantic quality. Do not use production memory text as the fixture.

- [ ] **Step 6: Verify route separation**

Read back the candidate LLM request ledger and confirm exactly the approved general members and the unchanged reflect member. A successful generic HTTP completion is not sufficient.

- [ ] **Step 7: Clean up the disposable runtime**

Delete only the disposable bank/runtime after the evidence artifact is saved, and verify its absence through the supported API. Do not touch `hermes`, `D:/hindsight/pg0`, or the proxy volume.

- [ ] **Step 8: Commit only the sanitized rehearsal summary**

Run redaction, `git diff --check`, and the staged secret scanner. The summary must contain exact image digests, statuses, metrics, verdict, limitations, and rollback result, but no raw memory or credentials.

### Task 4: Prepare the implementation change after the rehearsal passes

**Files:**
- Modify: `deploy/hindsight/docker-compose.yml`
- Modify: `docs/reference/infrastructure-registry.yaml`
- Modify: `deploy/hindsight/README.md`
- Modify: `docs/observations/hindsight-llm-wiring-2026-08-31.md` only if the currentness contract requires a replacement observation rather than editing history

- [ ] **Step 1: Select the candidate from evidence**

Use the first candidate that passes all gates. Prefer `v1.1.0` if it passes; otherwise stop and report the exact blocked gate rather than promoting `v0.9.2` by assumption.

- [ ] **Step 2: Pin the image and preserve route values**

Change only the Hindsight image tag/digest and migration comments required by the verified candidate. Preserve Solar primary, Mistral fallback, reflect route, timeout/concurrency values, external env files, pg0 mount, and proxy volume unless the candidate evidence explicitly requires a separately reviewed change.

- [ ] **Step 3: Update the infrastructure registry from live evidence**

Replace stale route/image claims only after read-back. Keep the runtime root, data root, external secret boundary, consumer ownership, and recovery warning explicit. Do not rewrite historical audit files to make them look current.

- [ ] **Step 4: Run source QA**

Run:

```text
docker compose -f deploy/hindsight/docker-compose.yml config --quiet
git diff --check
node tools/hindsight_upgrade/verify_hindsight.mjs --base-url http://localhost:8888 --bank-id hermes --mode baseline
```

Expected: Compose config passes; the verifier reports the actual pre-promotion state; no claim of production upgrade is made yet.

### Task 5: Promote only after independent Codex review and explicit approval

**Files:**
- Modify only the files approved by the implementation diff and #24.

- [ ] **Step 1: Open or update the narrow issue evidence**

Add candidate matrix, exact image digests, migration result, recall result, route read-back, rollback result, and unresolved risks to #24. Keep `UNKNOWN` and `BLOCKED` explicit.

- [ ] **Step 2: Request Codex review on the implementation draft**

Use a separate branch and draft PR. The PR body must state that it is advisory, does not authorize merge/deploy, names #24, lists exact files, and includes verification/rollback evidence. Comment:

```text
@codex review

Review this Hindsight upgrade against #24 and the linked design/plan. Focus on pg0 migration safety, recall/dateparser regression coverage, exact model-route preservation, secret/data boundaries, and rollback. Do not implement changes or treat this draft as merge authorization.
```

- [ ] **Step 3: Resolve review findings**

Fix Critical/Important findings, re-run all relevant verification, and update the PR with the exact read-back. Minor findings remain explicitly tracked rather than silently ignored.

- [ ] **Step 4: Ask for the promotion decision**

Only after Codex review and fresh verification, ask Semyon Poklad whether to apply the live upgrade. A draft PR review is not approval to mutate production.

- [ ] **Step 5: Promote and verify live state**

During the approved window, apply the bounded compose change without deleting volumes. Verify container version, health, bank list, stats, list read, recall, retain/consolidation behavior, route traces, and unchanged proxy/pg0 boundaries. Keep auto-recall disabled.

- [ ] **Step 6: Roll back on any failed gate**

Restore the exact `0.8.6` image/config, restart only the Hindsight stack using the documented route, and verify the production bank and read path. Do not erase failed-operation evidence or delete data to make the check green.

### Final verification checklist

- [ ] Codex review is visible on the draft PR and all Important findings are resolved or explicitly accepted.
- [ ] Candidate image and digest are recorded.
- [ ] pg0 migration was rehearsed on a disposable boundary.
- [ ] Recall no longer hangs on the bounded observation-only probe.
- [ ] Retain remains enabled and consolidation drains.
- [ ] Exact general and reflect routes are read back.
- [ ] Production bank/data/proxy volume were not deleted.
- [ ] Auto-recall remains disabled.
- [ ] Rollback path was tested or the untested portion is marked `UNKNOWN`.
- [ ] Only after all gates pass: explicit human promotion decision is recorded.
