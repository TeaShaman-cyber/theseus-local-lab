# Sonar HTTP Transport Canary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add and verify a localhost-only Streamable HTTP transport for the Docker-backed Sonar MCP server while preserving the verified stdio baseline.

**Architecture:** Extend the existing FastMCP server with an HTTP entry point on container port 8000. Add a separate Compose profile/launcher that publishes only `127.0.0.1:8791`, keeps the `sonar_local_sonar-data` volume, and exposes the same three read-only tools. Register the HTTP route only in project-scoped Codex/VS Code configuration after direct protocol verification; never modify the global Codex config in this plan.

**Tech Stack:** Python 3.12, FastMCP 1.28.1, Docker Compose, Node.js launcher, Python `urllib`/MCP client, TOML/JSON project configuration.

## Global Constraints

- Keep the existing stdio route and `theseus_sonar` profile intact as the baseline.
- Bind the HTTP route as `127.0.0.1:8791:8000`; never publish it to `0.0.0.0`.
- Keep DuckDB and receipts in the named Docker volume at `/var/lib/sonar`.
- Sonar remains read-only and exposes only `sonar_status`, `sonar_refresh`, and `sonar_preflight`.
- Do not edit `C:\Users\s.poklad\.codex\config.toml`.
- Do not store secrets in source, tests, logs, or configuration.
- Every TDD cycle must show the test failing for the intended missing behavior before implementation.

---

### Task 1: Add the failing HTTP route contract test

**Files:**
- Create: `tools/sonar_local/test_sonar_http.mjs`
- Test target: `tools/sonar_local/compose.yml`, `tools/sonar_local/sonar_docker.mjs`

**Interfaces:**
- Consumes: the existing Compose file and Docker launcher source text.
- Produces: a deterministic contract test proving that the HTTP route uses the localhost-only bind and that the launcher accepts `http`.

- [ ] **Step 1: Write the failing test**

Create a Node built-in test that reads the files and asserts:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const compose = fs.readFileSync("tools/sonar_local/compose.yml", "utf8");
const launcher = fs.readFileSync("tools/sonar_local/sonar_docker.mjs", "utf8");

test("HTTP route is localhost-only and launcher exposes http command", () => {
  assert.match(compose, /127\.0\.0\.1:8791:8000/);
  assert.match(compose, /sonar-http/);
  assert.match(launcher, /"http"/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```text
node --test tools/sonar_local/test_sonar_http.mjs
```

Expected: FAIL because the current Compose file and launcher do not yet contain the HTTP route contract.

### Task 2: Implement the minimal Docker HTTP service route

**Files:**
- Modify: `tools/sonar_local/compose.yml`
- Modify: `tools/sonar_local/Dockerfile`
- Modify: `tools/sonar_local/sonar_mcp.py`
- Modify: `tools/sonar_local/sonar_docker.mjs`
- Test: `tools/sonar_local/test_sonar_http.mjs`

**Interfaces:**
- Consumes: the existing `FastMCP` instance, `sonar_local.DEFAULT_DB`, and the existing named volume.
- Produces: `node tools/sonar_local/sonar_docker.mjs http`, which starts a persistent HTTP MCP server in the `sonar-http` Compose service.

- [ ] **Step 1: Add the minimal HTTP entry point**

In `sonar_mcp.py`, add a `main_http()` entry point that calls the existing FastMCP instance with the streamable HTTP transport on host `0.0.0.0` and port `8000`. Keep the stdio `main()` unchanged and select the entry point through a command-line argument or environment variable that the Compose service controls.

- [ ] **Step 2: Add the HTTP Compose service**

Add a `sonar-http` service using the same image/build and environment as `sonar`, with:

```yaml
ports:
  - "127.0.0.1:8791:8000"
volumes:
  - sonar-data:/var/lib/sonar
command: ["python", "sonar_mcp.py", "--http"]
```

Do not change the existing `sonar` service command or volume.

- [ ] **Step 3: Add the launcher command**

Extend `sonar_docker.mjs` with an `http` command that runs the persistent `sonar-http` service without `--rm`, preserving stdin/stdout behavior only for the process wrapper and using Docker’s published localhost port for MCP traffic.

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```text
node --test tools/sonar_local/test_sonar_http.mjs
```

Expected: PASS.

### Task 3: Add the HTTP protocol smoke test

**Files:**
- Create: `tools/sonar_local/mcp_http_smoke.py`
- Modify: `tools/sonar_local/requirements.txt` only if the existing MCP HTTP client dependency is insufficient.

**Interfaces:**
- Consumes: `http://127.0.0.1:8791/mcp` and the existing MCP tool contract.
- Produces: a bounded JSON receipt containing `initialize`, tool names, `sonar_status`, and one selective `sonar_preflight` result.

- [ ] **Step 1: Write the smoke assertions before implementation**

The smoke test must fail if the endpoint is unavailable and must assert:

```python
expected = {"sonar_status", "sonar_refresh", "sonar_preflight"}
assert set(tool_names) == expected
assert status["counts"]["documents"] > 0
assert preflight["status"] == "OK"
```

- [ ] **Step 2: Run the smoke test before starting the HTTP service**

Run:

```text
python tools/sonar_local/mcp_http_smoke.py
```

Expected: FAIL with a connection error because the HTTP service is not running yet.

- [ ] **Step 3: Implement the smallest Streamable HTTP client**

Use the installed MCP Python client or a minimal HTTP client already present in the dependency set. Complete `initialize`, `notifications/initialized`, `tools/list`, and two tool calls. Do not add retries or a gateway.

- [ ] **Step 4: Start the route and run the smoke test**

Run:

```text
node tools/sonar_local/sonar_docker.mjs http
python tools/sonar_local/mcp_http_smoke.py
```

Expected: PASS with exactly the three Sonar tools and a non-empty indexed status.

### Task 4: Add project-scoped HTTP registration and VS Code task

**Files:**
- Modify: `.codex/config.toml`
- Modify: `.vscode/mcp.json`
- Modify: `.vscode/tasks.json`
- Modify: `tools/sonar_local/README.md`

**Interfaces:**
- Consumes: the verified `http://127.0.0.1:8791/mcp` endpoint.
- Produces: distinct project-scoped profile `theseus_sonar_http`; no global config changes.

- [ ] **Step 1: Add the project-scoped HTTP profile**

Add:

```toml
[mcp_servers.theseus_sonar_http]
url = "http://127.0.0.1:8791/mcp"
enabled = true
startup_timeout_sec = 60
tool_timeout_sec = 90
```

Add the equivalent server to `.vscode/mcp.json` and a VS Code task that starts the Docker HTTP service.

- [ ] **Step 2: Document the A/B boundary**

Document that `theseus_sonar` is stdio baseline and `theseus_sonar_http` is the localhost-only canary. State that configured/discovered/exposed/callable are separate acceptance states.

- [ ] **Step 3: Validate project configuration**

Run:

```text
python -c "import tomllib; tomllib.load(open('.codex/config.toml','rb')); print('toml-ok')"
node -e "JSON.parse(require('fs').readFileSync('.vscode/mcp.json','utf8')); JSON.parse(require('fs').readFileSync('.vscode/tasks.json','utf8')); console.log('json-ok')"
docker compose -f tools/sonar_local/compose.yml config --quiet
```

Expected: all commands exit 0.

### Task 5: Run full verification and record GTD checkpoint

**Files:**
- Modify: `gtd/gtd.toml` only through the native GTD MCP executor/read-back, not manual editing.

**Interfaces:**
- Consumes: Docker build, Python unit tests, HTTP protocol smoke, and current native tool surface.
- Produces: one of two explicit GTD outcomes: HTTP canary verified through Desktop, or HTTP direct route verified but Desktop injection still blocked.

- [ ] **Step 1: Run the full local verification**

Run:

```text
docker compose -f tools/sonar_local/compose.yml build
docker compose -f tools/sonar_local/compose.yml run --rm -T sonar python test_sonar_local.py
python tools/sonar_local/mcp_http_smoke.py
git diff --check
```

- [ ] **Step 2: Restart and inspect the actual Codex tool surface**

Restart Codex only after the direct HTTP smoke passes. Record whether `sonar_status`, `sonar_refresh`, and `sonar_preflight` are actually callable. Do not infer exposure from config text.

- [ ] **Step 3: Update GTD and read back**

If Desktop exposes and calls the HTTP tools, mark `verify-sonar-desktop-tools` done with exact evidence. If direct HTTP passes but Desktop still has no tools, keep the item `waiting_for` and record the result as a Desktop MCP injection reproduction related to #33965.

- [ ] **Step 4: Stop without publishing**

Do not push or change global Codex config in this plan. Leave the working tree reviewable for a separate commit/push checkpoint.
