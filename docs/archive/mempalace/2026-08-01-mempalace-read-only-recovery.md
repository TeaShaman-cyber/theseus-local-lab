# MemPalace Read-Only Recovery Implementation Plan

> **Historical archive — superseded 2026-08-27.** MemPalace is already an
> active, routinely used service. This document is retained for provenance only
> and is not an active instruction. Do not execute its Docker, volume, profile,
> or configuration steps.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore MemPalace to Windows-native Codex through a verified read-only MCP profile without risking the original `theseus-mempalace-clean` volume or changing AutoMem, hooks, or Lad identity.

**Architecture:** Build a separate candidate image from the checked-in MemPalace source, copy the original named volume into a disposable clone, and run the candidate server with native `mcp --read-only`. Validate its MCP tool surface and bounded read calls before adding a separate `mempalace_ro` profile. Only after a user checkpoint may the profile move from the clone to the original volume, with the existing HTTP service quiesced or explicitly switched to read-only.

**Tech Stack:** Node.js 24, Docker Desktop on Windows, Docker Compose, MemPalace MCP JSON-RPC over stdio, Codex TOML configuration, Node's built-in test runner, existing Theseus probes and recovery contracts.

## Global Constraints

- Never delete, prune, rename, or recreate `theseus-mempalace-clean`.
- Never run `docker compose down -v` for the MemPalace stack.
- Never test a new image against the original volume before a restorable copy and clone manifest pass.
- Keep the current `theseus-mempalace:pilot` image reference available for rollback.
- The first Codex profile must expose only MemPalace read-only tools.
- Keep AutoMem, `memory_reflex.mjs`, all existing hooks, and Lad identity/continuity artifacts unchanged.
- Do not mine, checkpoint, add, update, delete, sync, write diary entries, change hook settings, or reconnect through MemPalace in the first stage.
- Store generated backups outside tracked project files and reject any backup path that is inside the repository.
- Use `path.join(os.homedir(), ".codex", "config.toml")` for the Codex config path, never a hardcoded user path in code.
- Stop at every gate if the observed runtime differs from the contract; do not stack speculative fixes.

---

### Task 1: Add the read-only MCP contract and tool-surface tests

**Files:**
- Create: `tools/mempalace_recovery/readonly_contract.mjs`
- Create: `tools/mempalace_recovery/readonly_contract.test.mjs`

**Interfaces:**
- `readonly_contract.mjs` exports `READ_ONLY_TOOLS`, `MUTATING_TOOLS`, and `validateToolList(toolNames)`.
- `validateToolList(toolNames)` returns `{ ok, admitted, mutating, unknown, required }`; `required` contains `mempalace_status` and `mempalace_search`.
- A tool is admitted only when it is in the explicit read set. Unknown tools fail closed.

- [ ] **Step 1: Write the failing contract tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateToolList } from "./readonly_contract.mjs";

test("accepts the minimum read-only surface", () => {
  const result = validateToolList(["mempalace_status", "mempalace_search"]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.mutating, []);
  assert.deepEqual(result.unknown, []);
});

test("rejects every mutating tool", () => {
  const result = validateToolList([
    "mempalace_status",
    "mempalace_search",
    "mempalace_add_drawer",
    "mempalace_delete_drawer",
    "mempalace_checkpoint",
    "mempalace_diary_write",
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.mutating, [
    "mempalace_add_drawer",
    "mempalace_delete_drawer",
    "mempalace_checkpoint",
    "mempalace_diary_write",
  ]);
});

test("rejects unknown tools instead of guessing their permissions", () => {
  const result = validateToolList(["mempalace_status", "mempalace_future_tool"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unknown, ["mempalace_future_tool"]);
});
```

- [ ] **Step 2: Run the tests and verify they fail because the contract module is absent**

Run: `node --test tools/mempalace_recovery/readonly_contract.test.mjs`

Expected: FAIL with a module-not-found error for `readonly_contract.mjs`.

- [ ] **Step 3: Implement the explicit deny-by-default contract**

`READ_ONLY_TOOLS` must include the verified read operations: `mempalace_status`, `mempalace_list_wings`, `mempalace_list_rooms`, `mempalace_get_taxonomy`, `mempalace_get_aaak_spec`, `mempalace_kg_query`, `mempalace_kg_timeline`, `mempalace_kg_stats`, `mempalace_traverse`, `mempalace_find_tunnels`, `mempalace_graph_stats`, `mempalace_list_tunnels`, `mempalace_follow_tunnels`, `mempalace_list_hallways`, `mempalace_search`, `mempalace_check_duplicate`, `mempalace_get_drawer`, `mempalace_list_drawers`, `mempalace_diary_read`, and `mempalace_memories_filed_away`.

`MUTATING_TOOLS` must include `mempalace_kg_add`, `mempalace_kg_invalidate`, `mempalace_kg_supersede`, `mempalace_create_tunnel`, `mempalace_delete_tunnel`, `mempalace_delete_hallway`, drawer add/update/delete operations, `mempalace_checkpoint`, `mempalace_mine`, `mempalace_sync`, `mempalace_diary_write`, `mempalace_hook_settings`, and `mempalace_reconnect`.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tools/mempalace_recovery/readonly_contract.test.mjs`

Expected: PASS with three tests.

- [ ] **Step 5: Commit the isolated contract**

```text
git add tools/mempalace_recovery/readonly_contract.mjs tools/mempalace_recovery/readonly_contract.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "test: define MemPalace read-only tool contract"
```

### Task 2: Implement the volume backup, clone, and manifest guard

**Files:**
- Create: `tools/mempalace_recovery/volume_guard.mjs`
- Create: `tools/mempalace_recovery/volume_guard.test.mjs`

**Interfaces:**
- `createRunId(now)` returns a filesystem-safe UTC identifier.
- `assertSafeVolumePair(sourceVolume, targetVolume)` throws when the names are equal, empty, or target the canonical source volume.
- `buildDockerVolumeCommand(operation, options)` returns explicit `docker.exe` argument arrays for `inspect`, `run`-based copy, and manifest operations; it never returns a source-volume delete command.
- CLI commands are `baseline`, `clone`, `manifest`, and `verify`; each prints JSON and never prints file contents. `clone` records its generated volume name in the run state and marks that run as `latest`, so later commands use `--run latest` instead of copying a volume name through shell text.

- [ ] **Step 1: Write tests for destructive-target protection and command shape**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeVolumePair, buildDockerVolumeCommand } from "./volume_guard.mjs";

test("rejects the canonical source as a clone target", () => {
  assert.throws(
    () => assertSafeVolumePair("theseus-mempalace-clean", "theseus-mempalace-clean"),
    /source volume/i,
  );
});

test("clone command mounts source read-only and writes only to target", () => {
  const args = buildDockerVolumeCommand("clone", {
    source: "theseus-mempalace-clean",
    target: "theseus-mempalace-ro-test",
  });
  assert.ok(args.includes("theseus-mempalace-clean:/source:ro"));
  assert.ok(args.includes("theseus-mempalace-ro-test:/target"));
  assert.equal(args.includes("volume"), false);
  assert.equal(args.includes("rm"), false);
});

test("manifest command is read-only", () => {
  const args = buildDockerVolumeCommand("manifest", { source: "theseus-mempalace-clean" });
  assert.ok(args.includes("theseus-mempalace-clean:/data:ro"));
  assert.equal(args.includes("--read-only"), true);
});
```

- [ ] **Step 2: Run the tests and verify they fail before implementation**

Run: `node --test tools/mempalace_recovery/volume_guard.test.mjs`

Expected: FAIL with a module-not-found error for `volume_guard.mjs`.

- [ ] **Step 3: Implement the guard with explicit Docker arguments**

Use `execFile`/`spawn` with `docker.exe` and `shell: false`. `baseline` records the source volume inspect result, palace status, and a file manifest into a generated run directory under `%LOCALAPPDATA%\Theseus\mempalace-recovery`. `clone` creates a new target volume only after asserting the source exists and the target is absent, then copies `/source/.` to `/target/.` from a temporary Alpine container. `verify` compares the source and clone manifests without deleting either volume. The script must refuse paths inside the repository and must never call `docker volume rm` for `theseus-mempalace-clean`.

- [ ] **Step 4: Run unit tests and a read-only baseline**

Run:

```text
node --test tools/mempalace_recovery/volume_guard.test.mjs
node tools/mempalace_recovery/volume_guard.mjs baseline --source theseus-mempalace-clean
```

Expected: unit tests pass; baseline JSON contains the canonical volume name, current image/container metadata, and a non-empty manifest without exposing memory contents.

- [ ] **Step 5: Clone and verify before touching any Codex configuration**

Run:

```text
node tools/mempalace_recovery/volume_guard.mjs clone --source theseus-mempalace-clean
node tools/mempalace_recovery/volume_guard.mjs verify --run latest
```

The script must print the generated run and clone metadata. Stop if the manifest differs or the clone operation reports any source read error. Do not run `docker compose up`, change `config.toml`, or rebuild the canonical service in this task.

- [ ] **Step 6: Commit the volume guard**

```text
git add tools/mempalace_recovery/volume_guard.mjs tools/mempalace_recovery/volume_guard.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "feat: add guarded MemPalace volume clone workflow"
```

### Task 3: Build an isolated candidate image with native read-only mode

**Files:**
- Create: `work/mempalace-pilot/docker-compose.readonly-candidate.yml`
- Create: `tools/mempalace_recovery/candidate_image_check.mjs`
- Create: `tools/mempalace_recovery/candidate_image_check.test.mjs`

**Interfaces:**
- Candidate image tag: `theseus-mempalace:ro-candidate`.
- Candidate service name: `theseus-mempalace-ro-candidate`.
- Candidate host port: `127.0.0.1:18766`.
- Candidate volume is resolved from the `latest` run state and is marked external in Compose.
- `candidate_image_check.mjs` verifies the image reports `--read-only` in `mcp --help`, starts the candidate Compose service for `--run latest`, and never replaces `theseus-mempalace:pilot`.

- [ ] **Step 1: Add tests for candidate command and tag isolation**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildCandidateRunArgs } from "./candidate_image_check.mjs";

test("candidate run uses the clone and read-only MCP flag", () => {
  const args = buildCandidateRunArgs("theseus-mempalace:ro-candidate", "theseus-mempalace-ro-test");
  assert.deepEqual(args, [
    "run", "-i", "--rm", "-v", "theseus-mempalace-ro-test:/data",
    "theseus-mempalace:ro-candidate", "mcp", "--read-only",
  ]);
});

test("candidate validation refuses the canonical image tag", () => {
  assert.throws(
    () => buildCandidateRunArgs("theseus-mempalace:pilot", "theseus-mempalace-ro-test"),
    /candidate image/i,
  );
});
```

- [ ] **Step 2: Run tests to verify the candidate helper is absent**

Run: `node --test tools/mempalace_recovery/candidate_image_check.test.mjs`

Expected: FAIL with a module-not-found error for `candidate_image_check.mjs`.

- [ ] **Step 3: Add the candidate Compose service**

Create `work/mempalace-pilot/docker-compose.readonly-candidate.yml` with this service shape:

```yaml
name: theseus-mempalace-ro-candidate

services:
  mempalace_ro_candidate:
    build:
      context: ./repo
      dockerfile: Dockerfile
    image: theseus-mempalace:ro-candidate
    container_name: theseus-mempalace-ro-candidate
    command: ["serve", "--host", "0.0.0.0", "--port", "8765", "--read-only", "--allow-insecure"]
    ports:
      - "127.0.0.1:18766:8765"
    volumes:
      - mempalace-ro-clone:/data
    environment:
      MEMPALACE_PALACE_PATH: /data/.mempalace/palace
    healthcheck:
      test: ["CMD-SHELL", "python -c \"from urllib.request import urlopen; assert urlopen('http://127.0.0.1:8765/healthz', timeout=3).read().strip() == b'ok'\""]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 10s

volumes:
  mempalace-ro-clone:
    external: true
    name: ${THESEUS_MEMPALACE_CLONE_VOLUME}
```

- [ ] **Step 4: Build and verify only the candidate image**

Run from the repository root with the clone volume name emitted by Task 2:

```text
docker build -t theseus-mempalace:ro-candidate work/mempalace-pilot/repo
docker run --rm theseus-mempalace:ro-candidate mcp --help
```

Expected: help output contains `--read-only`. If it does not, stop before starting the candidate service and report the local source/image mismatch; do not rebuild or retag `theseus-mempalace:pilot`.

- [ ] **Step 5: Start the candidate service against the clone**

Let `candidate_image_check.mjs --run latest` set the process-local clone-volume environment and run:

```text
node tools/mempalace_recovery/candidate_image_check.mjs start --run latest
```

Expected: only `theseus-mempalace-ro-candidate` is created; the canonical `theseus-mempalace` container and `theseus-mempalace-clean` volume remain unchanged.

- [ ] **Step 6: Commit the candidate configuration and checks**

```text
git add work/mempalace-pilot/docker-compose.readonly-candidate.yml tools/mempalace_recovery/candidate_image_check.mjs tools/mempalace_recovery/candidate_image_check.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "feat: add isolated MemPalace read-only candidate"
```

### Task 4: Verify MCP protocol, tool surface, and bounded reads

**Files:**
- Create: `tools/mempalace_recovery/read_only_probe.mjs`
- Create: `tools/mempalace_recovery/read_only_probe.test.mjs`

**Interfaces:**
- `read_only_probe.mjs` accepts `--run`, `--image`, `--query`, and `--json-out`; `--run latest` resolves the clone volume from the guarded recovery state.
- It uses native `docker.exe`, `-i`, the clone volume, `mcp`, and `--read-only`.
- It performs `initialize`, `notifications/initialized`, `tools/list`, `mempalace_status`, and one bounded `mempalace_search` call.
- It validates tool names through `readonly_contract.mjs` and exits non-zero on a mutating/unknown tool, timeout, malformed JSON-RPC, or missing required read tool.

- [ ] **Step 1: Write parser and gate tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { classifyProbeResult } from "./read_only_probe.mjs";

test("probe passes only when protocol and read calls pass", () => {
  const result = classifyProbeResult({
    initialized: true,
    tools: ["mempalace_status", "mempalace_search"],
    statusOk: true,
    searchOk: true,
  });
  assert.equal(result.ok, true);
});

test("probe fails when a mutator is advertised", () => {
  const result = classifyProbeResult({
    initialized: true,
    tools: ["mempalace_status", "mempalace_add_drawer"],
    statusOk: true,
    searchOk: true,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /mutating/i);
});
```

- [ ] **Step 2: Run tests to verify the probe module is absent**

Run: `node --test tools/mempalace_recovery/read_only_probe.test.mjs`

Expected: FAIL with a module-not-found error for `read_only_probe.mjs`.

- [ ] **Step 3: Implement one-session JSON-RPC probing**

Use one child process for the candidate `docker.exe run` command. Maintain a line buffer so partial stdout chunks cannot be parsed as complete JSON. Send the following sequence and no other tool calls:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"theseus-read-only-probe","version":"1.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mempalace_status","arguments":{}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"mempalace_search","arguments":{"query":"2026-08-01 Codex Desktop recovery","limit":3}}}
```

Keep stdout machine-readable and write diagnostic stderr only to the run artifact. Do not persist returned verbatim memory content in Git or AutoMem.

- [ ] **Step 4: Run the candidate probe**

Run: `node tools/mempalace_recovery/read_only_probe.mjs --run latest --image theseus-mempalace:ro-candidate --query "2026-08-01 Codex Desktop recovery"`

Expected: JSON reports `initialized: true`, `tool_surface_ok: true`, `status_ok: true`, `search_ok: true`, and no mutating or unknown tools. If any gate fails, leave the Codex config untouched and stop the candidate container.

- [ ] **Step 5: Verify the clone did not diverge from the source**

Run: `node tools/mempalace_recovery/volume_guard.mjs verify --run latest`

Expected: source manifest remains unchanged; any candidate-only runtime files are confined to the clone and are reported separately from palace data.

- [ ] **Step 6: Commit the bounded MCP probe**

```text
git add tools/mempalace_recovery/read_only_probe.mjs tools/mempalace_recovery/read_only_probe.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "test: verify MemPalace read-only MCP surface"
```

### Task 5: Add an isolated `mempalace_ro` Codex profile writer

**Files:**
- Create: `tools/memory_stack/apply_mempalace_readonly_config.mjs`
- Create: `tools/memory_stack/apply_mempalace_readonly_config.test.mjs`

**Interfaces:**
- CLI: `node tools/memory_stack/apply_mempalace_readonly_config.mjs --run latest --image theseus-mempalace:ro-candidate`.
- Default config path is `path.join(os.homedir(), ".codex", "config.toml")`.
- The generated section is exactly `[mcp_servers.mempalace_ro]` with `command = 'docker.exe'`, `args = ['run', '-i', '--rm', '-v', cloneVolume + ':/data', imageTag, 'mcp', '--read-only']`, `enabled = true`, `startup_timeout_sec = 60`, and `tool_timeout_sec = 120`.
- The writer refuses `theseus-mempalace-clean` until the cutover flag is explicitly supplied in a later task.
- The writer creates a timestamped config backup only when the file changes and does not modify any unrelated section.

- [ ] **Step 1: Write fixture-based config tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { renderProfile, assertCloneVolume } from "./apply_mempalace_readonly_config.mjs";

test("renders a read-only clone profile", () => {
  assert.match(
    renderProfile("theseus-mempalace-ro-test", "theseus-mempalace:ro-candidate"),
    /mcp.*--read-only/s,
  );
});

test("refuses the canonical volume before cutover", () => {
  assert.throws(
    () => assertCloneVolume("theseus-mempalace-clean", false),
    /clone volume/i,
  );
});

test("allows the canonical volume only with the explicit cutover flag", () => {
  assert.doesNotThrow(() => assertCloneVolume("theseus-mempalace-clean", true));
});
```

- [ ] **Step 2: Run tests and verify they fail before the writer exists**

Run: `node --test tools/memory_stack/apply_mempalace_readonly_config.test.mjs`

Expected: FAIL with a module-not-found error for `apply_mempalace_readonly_config.mjs`.

- [ ] **Step 3: Implement section-scoped TOML writing**

Reuse the existing line-oriented section-boundary convention from `tools/memory_stack/apply_codex_config.mjs`, but keep this writer independent so the user's current modifications to that file are not overwritten. Before writing, verify the target config exists, the candidate volume is not canonical, and the generated command includes `mcp` followed by `--read-only`. Preserve all text outside `[mcp_servers.mempalace_ro]` byte-for-byte.

- [ ] **Step 4: Run fixture tests and a dry-run diff**

Run: `node --test tools/memory_stack/apply_mempalace_readonly_config.test.mjs`

Expected: PASS. Then render against a temporary config containing the existing `memory` server and verify the only added section is `[mcp_servers.mempalace_ro]`.

- [ ] **Step 5: Apply the clone profile only after Tasks 1–4 pass**

Run with the actual Codex config path derived by the script:

```text
node tools/memory_stack/apply_mempalace_readonly_config.mjs --run latest --image theseus-mempalace:ro-candidate
```

Expected: one timestamped `config.toml` backup and one isolated profile addition. Do not enable hooks or alter the existing `memory` section.

- [ ] **Step 6: Commit only the profile writer and tests**

```text
git add tools/memory_stack/apply_mempalace_readonly_config.mjs tools/memory_stack/apply_mempalace_readonly_config.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "feat: add isolated MemPalace read-only Codex profile"
```

### Task 6: Verify the actual Windows Codex runtime after one user restart

**Files:**
- Create: `tools/mempalace_recovery/desktop_verification.mjs`
- Create: `tools/mempalace_recovery/desktop_verification.test.mjs`

**Interfaces:**
- `desktop_verification.mjs` records only metadata: profile presence, the tool-name list supplied from the actual Desktop MCP surface, AutoMem health status, process counts, and file-activity counters; it never records verbatim memory content or secrets.
- `desktop_verification.mjs --tool-names-json '["mempalace_status","mempalace_search"]'` validates the observed tool list through `readonly_contract.mjs` before writing the report.
- It accepts `--phase before-restart` and `--phase after-restart` and writes JSON under the generated recovery run directory in `%LOCALAPPDATA%\Theseus\mempalace-recovery`.

- [ ] **Step 1: Add tests for phase schema and secret redaction**

Test that the report contains `phase`, `timestamp`, `mempalace`, `automem`, `processes`, and `files`, and that serialized output does not contain `AUTOMEM_API_KEY`, `Authorization`, or raw drawer text.

- [ ] **Step 2: Capture the pre-restart checkpoint**

Run the verifier before restarting Codex. Confirm:

- AutoMem health remains healthy and synced;
- the profile points to the clone and contains `--read-only`;
- the canonical container and source volume metadata are unchanged;
- no hook or identity file has a new modification timestamp;
- the candidate process is bounded to the expected container/process set.

- [ ] **Step 3: Stop and ask the user to restart Codex once**

Do not perform the restart implicitly. The checkpoint is: “clone profile is present; restart Codex and report when the Windows Desktop task is back.”

- [ ] **Step 4: Capture the post-restart checkpoint in the actual Desktop runtime**

Run the verifier and use the actual surfaced MCP tool list, not CLI assumptions. A successful result must show only the read-only contract, a successful `mempalace_status`, a successful bounded `mempalace_search`, healthy AutoMem, and no unexplained MCP child-process accumulation or startup file-activity spike.

- [ ] **Step 5: Stop at the clone gate**

If the Desktop runtime fails to surface the profile, times out, leaks processes, or changes unrelated files, restore only the profile-specific config backup and leave the original service and volume untouched. Do not proceed to canonical-volume cutover.

- [ ] **Step 6: Commit verification reporting**

```text
git add tools/mempalace_recovery/desktop_verification.mjs tools/mempalace_recovery/desktop_verification.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "test: verify MemPalace read-only profile in Desktop runtime"
```

### Task 7: Cut over to the original volume only after an explicit user checkpoint

**Files:**
- Create: `work/mempalace-pilot/docker-compose.readonly-canonical.yml`
- Modify: `tools/memory_stack/apply_mempalace_readonly_config.mjs`
- Modify: `work/mempalace-pilot/MEMORY_PALACE_JUNIOR.md`
- Modify: `tools/workshop_recovery/recovery_contract.json`

**Interfaces:**
- Canonical read-only override preserves the external volume name `theseus-mempalace-clean`, changes only the image/command needed for native read-only service mode, and keeps the existing health endpoint.
- `apply_mempalace_readonly_config.mjs --cutover` is the only path allowed to replace the clone volume in `[mcp_servers.mempalace_ro]` with `theseus-mempalace-clean`.
- Recovery contract reports the canonical MemPalace service and verifies its read-only command metadata without reading secrets or palace contents.

- [ ] **Step 1: Require explicit cutover approval after the clone runtime passes**

The cutover boundary is not inferred from a green standalone probe. Confirm that the user has reviewed the clone verification report and wants the profile to read the canonical volume.

- [ ] **Step 2: Quiesce the existing full-surface service before original-volume access**

Stop or replace the current `theseus-mempalace` HTTP service through the existing project Compose route. Do not remove the external volume. Start the read-only canonical override with the candidate image and `--read-only`, then wait for `http://127.0.0.1:18765/healthz` to return `ok`.

- [ ] **Step 3: Switch only the profile volume under the cutover guard**

Run: `node tools/memory_stack/apply_mempalace_readonly_config.mjs --cutover --image theseus-mempalace:ro-candidate`

Expected: a new config backup and a one-section change. The profile command must remain read-only.

- [ ] **Step 4: Verify canonical status/search and manifest equality**

Run the same MCP probe against the canonical read-only path and compare the drawer/status counts with the pre-clone baseline. The source manifest must be readable and the canonical service must advertise no mutating tools.

- [ ] **Step 5: Define rollback before declaring success**

Rollback consists of restoring the profile-specific `config.toml` backup, bringing back the previous `theseus-mempalace:pilot` command, and leaving `theseus-mempalace-clean` in place. Do not restore by deleting or recreating the volume.

- [ ] **Step 6: Update the junior guide and recovery contract**

Document that the canonical Codex path is `mempalace_ro`, that MemPalace hooks remain disabled, and that write tools require a later explicit decision. Keep the existing safe-seed and “do not mine secrets” rules.

- [ ] **Step 7: Commit the canonical cutover support**

```text
git add work/mempalace-pilot/docker-compose.readonly-canonical.yml tools/memory_stack/apply_mempalace_readonly_config.mjs work/mempalace-pilot/MEMORY_PALACE_JUNIOR.md tools/workshop_recovery/recovery_contract.json
node tools/git_safety/scan_staged.mjs
git commit -m "feat: support canonical MemPalace read-only cutover"
```

### Task 8: Final verification and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-08-01-mempalace-read-only-recovery-design.md` only if the observed runtime changes a documented fact
- Create: `final-verification.json` in the generated recovery run directory outside Git tracking

- [ ] **Step 1: Run all local tests**

```text
node --test tools/mempalace_recovery/*.test.mjs tools/memory_stack/apply_mempalace_readonly_config.test.mjs
node --check tools/mempalace_recovery/readonly_contract.mjs
node --check tools/mempalace_recovery/volume_guard.mjs
node --check tools/mempalace_recovery/read_only_probe.mjs
node --check tools/mempalace_recovery/desktop_verification.mjs
```

- [ ] **Step 2: Run the workshop recovery contract and memory health checks**

Verify the MemPalace recovery stack, AutoMem health/sync, canonical container health, read-only MCP tool list, and the absence of unexpected hook/identity changes.

- [ ] **Step 3: Run the staged-file safety scanner**

Run: `node tools/git_safety/scan_staged.mjs`

Expected: no secrets, raw memory, raw transcripts, backup archives, or generated recovery artifacts are staged.

- [ ] **Step 4: Hand off with exact stop state**

Report:

- original volume name and backup/manifest verification result;
- candidate and canonical image tags;
- actual read-only MCP tool list count and required calls;
- AutoMem health result;
- whether hooks and Lad identity remained unchanged;
- process/file-activity observations after the restart;
- rollback artifact path and the exact command/profile section to restore.

Do not enable MemPalace writes or hooks in this plan. That is a separate design and approval boundary.
