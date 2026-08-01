# Unix Runtime Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested, read-only Unix runtime contract that lets Windows-native Codex identify and probe WSL, Docker, and Ubuntu VM backends without changing global Codex configuration.

**Architecture:** Introduce a focused `tools/unix_runtime` module. The contract validates normalized requests and results; backend builders create explicit no-shell probe invocations; the CLI executes one selected probe and emits a bounded receipt. Phase one has no arbitrary command execution and no implicit fallback. A VS Code task exposes the probe without turning any backend into a startup MCP.

**Tech Stack:** Node.js built-in modules, Node `node:test`, `spawnSync` with `shell: false`, existing Theseus route and timeline conventions, VS Code process task.

## Global Constraints

- Keep the Windows-native Codex agent and current memory MCP configuration unchanged.
- Do not edit `C:\Users\s.poklad\.codex\config.toml`.
- Do not modify hooks, `memory_reflex`, AutoMem, MemPalace, Graphify, Sonar, Docker volumes, or the Ubuntu VM.
- Do not execute arbitrary shell strings or caller-supplied shell interpolation.
- Do not implement implicit fallback; phase-one probes run one explicitly selected backend.
- Reject `scoped-write` requests until a later allowlisted task contract exists.
- Bound every subprocess and cap diagnostic output before returning it.
- Preserve unrelated dirty worktree changes and stage only new files plus the explicit VS Code task edit.
- Run `node tools/git_safety/scan_staged.mjs` before any commit.

---

### Task 1: Add the normalized request/result contract

**Files:**
- Create: `tools/unix_runtime/contract.mjs`
- Test: `tools/unix_runtime/contract.test.mjs`

**Interfaces:**
- `BACKENDS`: `Set` containing `wsl`, `docker`, and `ubuntu-vm`.
- `MODES`: `Set` containing `read-only` and `scoped-write`.
- `STATUSES`: `Set` containing `OK`, `UNAVAILABLE`, `TIMEOUT`, `PERMISSION_DENIED`, `INVALID_REQUEST`, and `UNKNOWN`.
- `validateRequest(input)`: returns `{ ok, errors, request }`; trims strings, defaults `mode` to `read-only`, defaults `timeout_ms` to `15000`, and rejects unknown backends, unknown tasks, non-positive or over-limit timeouts, empty task names, and every `scoped-write` request in phase one.
- `validateResult(input)`: returns `{ ok, errors }`; requires backend, status, elapsed time, exit outcome, `fallback_used`, and a boolean `postcondition.passed`.
- `makeResult(fields)`: returns a normalized result with bounded strings and phase-one defaults.

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateRequest, validateResult } from "./contract.mjs";

test("accepts an explicit read-only probe request", () => {
  const result = validateRequest({ backend: "wsl", task: "probe", timeout_ms: 5000 });
  assert.equal(result.ok, true);
  assert.equal(result.request.mode, "read-only");
});

test("rejects unknown backends and scoped writes in phase one", () => {
  assert.equal(validateRequest({ backend: "freebsd", task: "probe" }).ok, false);
  assert.equal(validateRequest({ backend: "wsl", task: "probe", mode: "scoped-write" }).ok, false);
});

test("rejects unbounded or unknown tasks", () => {
  assert.equal(validateRequest({ backend: "wsl", task: "probe", timeout_ms: 0 }).ok, false);
  assert.equal(validateRequest({ backend: "wsl", task: "run-anything" }).ok, false);
});

test("requires a postcondition on results", () => {
  const result = validateResult({ backend: "wsl", status: "OK", elapsed_ms: 10, exit_code: 0 });
  assert.equal(result.ok, false);
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the module is absent**

Run: `node --test tools/unix_runtime/contract.test.mjs`

Expected: FAIL with a module-not-found error for `contract.mjs`.

- [ ] **Step 3: Implement the deny-by-default contract**

Use explicit sets and return structured errors. Keep the maximum timeout at
`120000` milliseconds and the diagnostic cap at `4000` characters per stream.
Accept only the `probe` task in this phase. Do not call a subprocess here.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test tools/unix_runtime/contract.test.mjs`

Expected: PASS with four tests.

- [ ] **Step 5: Commit only the contract files**

```text
git add tools/unix_runtime/contract.mjs tools/unix_runtime/contract.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "feat: define Unix runtime request contract"
```

### Task 2: Add explicit backend probe builders

**Files:**
- Create: `tools/unix_runtime/backends.mjs`
- Test: `tools/unix_runtime/backends.test.mjs`

**Interfaces:**
- `BACKEND_SPECS`: immutable metadata for `wsl`, `docker`, and `ubuntu-vm`.
- `buildProbeInvocation(backend, options)`: returns `{ command, args, cwd, env, shell }` with `shell: false`; it throws for unknown backends or invalid options.
- `getBackendSpec(backend)`: returns a copy of the backend metadata.

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildProbeInvocation } from "./backends.mjs";

test("builds a WSL probe with explicit distro and cwd", () => {
  const invocation = buildProbeInvocation("wsl", {
    distro: "Ubuntu-24.04",
    cwd: "/home/poklad/theseus-local-lab",
  });
  assert.equal(invocation.command, "wsl.exe");
  assert.deepEqual(invocation.args.slice(0, 5), ["-d", "Ubuntu-24.04", "--cd", "/home/poklad/theseus-local-lab", "--"]);
  assert.equal(invocation.shell, false);
});

test("builds Docker and VM probes without caller shell interpolation", () => {
  const docker = buildProbeInvocation("docker", {});
  const vm = buildProbeInvocation("ubuntu-vm", { host: "theseus-ubuntu-vm" });
  assert.equal(docker.command, "docker.exe");
  assert.equal(vm.command, "ssh");
  assert.equal(docker.shell, false);
  assert.equal(vm.shell, false);
  assert.ok(!String(vm.args).includes(";"));
});

test("rejects unknown backends", () => {
  assert.throws(() => buildProbeInvocation("local-shell", {}), /backend/i);
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the module is absent**

Run: `node --test tools/unix_runtime/backends.test.mjs`

Expected: FAIL with a module-not-found error for `backends.mjs`.

- [ ] **Step 3: Implement probe builders with fixed probe payloads**

Use these fixed read-only probes:

- WSL: `sh -lc "printf 'runtime=wsl\\n'; uname -s; command -v node || true; command -v git || true"`.
- Docker: `docker.exe version --format {{.Server.Version}}`.
- Ubuntu VM: `ssh -o BatchMode=yes -o ConnectTimeout=5 <host> sh -lc "printf 'runtime=ubuntu-vm\\n'; uname -s; command -v node || true; command -v git || true"`.

Do not embed workspace or caller text inside the probe shell script. Validate
the distro, VM host, and cwd as non-empty bounded strings. Keep all invocation
objects explicit and set `shell: false`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test tools/unix_runtime/backends.test.mjs`

Expected: PASS with three tests.

- [ ] **Step 5: Commit only the backend files**

```text
git add tools/unix_runtime/backends.mjs tools/unix_runtime/backends.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "feat: add Unix runtime backend probe builders"
```

### Task 3: Add the single-backend probe runner and CLI

**Files:**
- Create: `tools/unix_runtime/unix_runtime.mjs`
- Test: `tools/unix_runtime/unix_runtime.test.mjs`

**Interfaces:**
- `runProbe(request, dependencies)`: runs exactly one validated backend probe and returns a normalized result. `dependencies.spawn` is injectable for tests.
- `parseArgs(argv)`: accepts `probe --backend <id> [--timeout-ms <n>] [--distro <name>] [--cwd <path>] [--host <alias>] [--no-log]`.
- CLI command: `node tools/unix_runtime/unix_runtime.mjs probe --backend wsl`.

- [ ] **Step 1: Write failing unit tests with a fake subprocess runner**

Cover:

1. successful probe returns `status=OK`, backend identity, exit code, bounded output, and `postcondition.passed=true`;
2. non-zero exit returns `UNKNOWN` or `UNAVAILABLE` without throwing;
3. timeout returns `TIMEOUT` and never reports a passed postcondition;
4. the runner invokes only the selected backend and never calls a fallback;
5. output longer than `4000` characters per stream is truncated with a marker.

- [ ] **Step 2: Run the focused test and verify it fails because the runner is absent**

Run: `node --test tools/unix_runtime/unix_runtime.test.mjs`

Expected: FAIL with a module-not-found error for `unix_runtime.mjs`.

- [ ] **Step 3: Implement the bounded runner**

Use `spawn`/`spawnSync` with `shell: false`, an explicit timeout, and no retry.
The postcondition for a successful probe requires the output to identify the
selected runtime and at least one expected tool check. A failed process cannot
produce a successful postcondition. The result must set `fallback_used=false`
in phase one.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `node --test tools/unix_runtime/unix_runtime.test.mjs`

Expected: PASS with at least five tests.

- [ ] **Step 5: Run a non-mutating CLI smoke test for each backend**

Run:

```text
node tools/unix_runtime/unix_runtime.mjs probe --backend wsl --no-log
node tools/unix_runtime/unix_runtime.mjs probe --backend docker --no-log
node tools/unix_runtime/unix_runtime.mjs probe --backend ubuntu-vm --no-log
```

Expected: each command emits one JSON receipt. WSL and Docker may be `OK` or a
visible bounded failure; the powered-off VM is expected to be `UNAVAILABLE` or
`TIMEOUT`, not a silent fallback.

- [ ] **Step 6: Commit only the runner files**

```text
git add tools/unix_runtime/unix_runtime.mjs tools/unix_runtime/unix_runtime.test.mjs
node tools/git_safety/scan_staged.mjs
git commit -m "feat: add bounded Unix runtime probe runner"
```

### Task 4: Expose the probe through the IDE without changing Codex startup

**Files:**
- Create: `tools/unix_runtime/README.md`
- Modify: `.vscode/tasks.json`
- Test: `tools/unix_runtime/tasks_contract.test.mjs`

**Interfaces:**
- VS Code task label: `Theseus Unix Runtime: probe backend`.
- The task calls the Node CLI and accepts one input named `unixRuntimeBackend` with the values `wsl`, `docker`, and `ubuntu-vm`.
- The task is manual and must not set `runOptions.runOn`.

- [ ] **Step 1: Write a JSON/task contract test**

Read `.vscode/tasks.json` and assert that the task exists, invokes
`tools/unix_runtime/unix_runtime.mjs`, includes `probe` and the backend input,
and does not have `runOptions.runOn`.

- [ ] **Step 2: Run the test before the task exists**

Run: `node --test tools/unix_runtime/tasks_contract.test.mjs`

Expected: FAIL because the task is absent.

- [ ] **Step 3: Add the manual task and input**

Add only the new task and input entries. Do not modify existing tasks, hooks,
MCP profiles, or startup actions.

- [ ] **Step 4: Add operator documentation**

Document that:

- Windows Codex remains the agent;
- the task probes one selected backend;
- no automatic fallback occurs in phase one;
- WSL is the first route, Docker is a separate route, and the disabled Ubuntu
  VM is not assumed ready;
- a later scoped-write task catalogue requires a new design and review.

- [ ] **Step 5: Run JSON and focused tests**

Run:

```text
node --check tools/unix_runtime/contract.mjs
node --check tools/unix_runtime/backends.mjs
node --check tools/unix_runtime/unix_runtime.mjs
node --test tools/unix_runtime/*.test.mjs
```

Expected: all syntax and focused tests pass; `.vscode/tasks.json` parses.

- [ ] **Step 6: Run the staged secret scan and stop for review**

Stage only the new Unix runtime files, the README, the focused tests, and the
single explicit task edit. Run:

```text
node tools/git_safety/scan_staged.mjs
```

Do not stage existing dirty hook, memory, startup-watch, or configuration
changes. At this boundary report the backend receipts and wait for review
before adding scoped-write execution or changing any Codex MCP profile.

## Self-review checklist

- The phase has one implementation unit: the read-only Unix runtime contract.
- No task adds arbitrary shell execution.
- No task edits `config.toml` or hooks.
- WSL, Docker, and VM use separate explicit builders.
- The plan does not claim a powered-off VM is healthy.
- Every successful result has a postcondition and every failure is visible.
- Fallback is absent until a later contract explicitly permits it.
