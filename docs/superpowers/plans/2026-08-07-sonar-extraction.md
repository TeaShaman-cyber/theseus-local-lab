# Sonar Community Core Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private `theseus-sonar` incubation repository whose first executable slice analyzes synthetic snapshots offline through a neutral, read-only Core and exposes equivalent stdio and localhost HTTP contracts.

**Architecture:** Extract the deterministic evidence analysis into a framework-neutral Python Core. Keep snapshot and future AutoMem adapters outside the Core, and keep stdio/HTTP transports as thin protocol layers over the same operations. Preserve Theseus-specific launchers, authentication, memory wiring, GTD procedures, and Docker/WSL integration in the existing lab until a later integration decision.

**Tech Stack:** Python 3, DuckDB, deterministic local retrieval with BM25 or an equivalent bounded implementation, JSON snapshot contracts, MCP stdio and localhost Streamable HTTP transports, pytest, Docker for the optional integration profile.

## Global Constraints

- The incubation repository is private and is named `theseus-sonar`; repository creation is a separate approved action.
- The Core must not import AutoMem, MemPalace, Basic Memory, Notion, GTD, Codex, Docker, Windows, or WSL modules.
- The MVP is read-only, offline-capable, rebuildable, and driven by synthetic JSON fixtures.
- Retrieval relevance, source confidence, temporal strength, and contradiction strength remain separate fields; none is a truth probability.
- Public provenance is safe for examples; local provenance may retain operator detail; redacted provenance removes sensitive identifiers and paths before export.
- No real memory snapshots, credentials, private paths, backups, DuckDB files, environment files, or raw transcripts may enter the repository.
- `sonar_status`, `sonar_refresh`, and `sonar_preflight` must have stable read-only output contracts.
- Stale or absent indexes must produce an explicit structured state; the server must not silently present stale data as current.
- HTTP defaults to localhost-only; any non-localhost deployment and authentication boundary is a later documented integration decision.
- Do not modify or stage the existing Theseus lab's unrelated working-tree changes while executing this plan.

---

### Task 1: Create the private repository skeleton and offline acceptance fixture

**Files:**
- Create: `theseus-sonar/pyproject.toml`
- Create: `theseus-sonar/src/sonar/__init__.py`
- Create: `theseus-sonar/src/sonar/core/__init__.py`
- Create: `theseus-sonar/src/sonar/adapters/__init__.py`
- Create: `theseus-sonar/src/sonar/transports/__init__.py`
- Create: `theseus-sonar/examples/snapshot.json`
- Create: `theseus-sonar/tests/fixtures/expected_preflight.json`
- Create: `theseus-sonar/tests/test_smoke.py`

**Interfaces:**
- `pyproject.toml` defines an installable package named `theseus-sonar`, a Python 3 test environment, and a test command.
- `examples/snapshot.json` follows the version-1 neutral snapshot contract from the boundary design.
- The smoke test invokes the future public path `python -m sonar snapshot examples/snapshot.json preflight --query "runtime verification"` through a subprocess and asserts exit code 0, JSON output, and the presence of an evidence packet with explicit provenance and gap fields.

- [ ] **Step 1: Create the private repository and skeleton files**

  Run from the parent workspace after confirming the target path does not already contain user work:

  ```text
  New-Item -ItemType Directory -Path theseus-sonar
  git -C theseus-sonar init -b main
  ```

  Add only the package, example, and test paths listed above. Do not copy `tools/sonar_local` wholesale.

- [ ] **Step 2: Write the red smoke test**

  The test must fail before the CLI exists and must assert the public behavior, not internal implementation details:

  ```python
  def test_offline_preflight_acceptance_slice():
      result = subprocess.run(
          [sys.executable, "-m", "sonar", "snapshot", "examples/snapshot.json",
           "preflight", "--query", "runtime verification"],
          capture_output=True,
          text=True,
      )
      assert result.returncode == 0
      packet = json.loads(result.stdout)
      assert packet["schema_version"] == 1
      assert packet["provenance_mode"] == "public"
      assert "results" in packet
      assert "gaps" in packet
  ```

- [ ] **Step 3: Run the red test**

  Run:

  ```text
  python -m pytest tests/test_smoke.py::test_offline_preflight_acceptance_slice -q
  ```

  Expected: failure because the `sonar` module and CLI entrypoint do not exist.

- [ ] **Step 4: Commit the repository skeleton**

  Run the repository secret scan before committing:

  ```text
  node tools/git_safety/scan_staged.mjs
  git add pyproject.toml src tests examples
  git commit -m "test: define offline Sonar acceptance slice"
  ```

  The scanner must report no secrets or private artifacts.

### Task 2: Implement the neutral snapshot model and provenance boundary

**Files:**
- Create: `theseus-sonar/src/sonar/core/models.py`
- Create: `theseus-sonar/src/sonar/core/provenance.py`
- Create: `theseus-sonar/src/sonar/adapters/snapshot.py`
- Create: `theseus-sonar/tests/test_snapshot_contract.py`
- Create: `theseus-sonar/tests/test_provenance.py`

**Interfaces:**
- `Snapshot.from_dict(data: dict) -> Snapshot` validates `version == 1`, node IDs, edge references, and the required node fields.
- `Snapshot.load(path: Path) -> Snapshot` reads JSON without contacting a service.
- `EvidenceReference.public()`, `.local()`, and `.redacted()` return serializable references with their declared privacy mode.
- `SnapshotAdapter.load(path: Path, provenance_mode: str = "public") -> Snapshot` loads only the neutral fixture format.

- [ ] **Step 1: Write contract tests for valid, invalid, and referenced snapshots**

  Cover a valid version-1 fixture, an unknown version, an edge pointing to a missing node, and a node with a private-looking source path rejected in `public` mode.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run:

  ```text
  python -m pytest tests/test_snapshot_contract.py tests/test_provenance.py -q
  ```

  Expected: failures for missing model, loader, and provenance implementations.

- [ ] **Step 3: Implement the smallest immutable data model**

  Keep the model independent of DuckDB, MCP, AutoMem, and Theseus policy. Preserve `retrieval_score`, `source_confidence`, `temporal_strength`, and `contradiction_strength` as distinct names wherever they appear.

- [ ] **Step 4: Run focused tests and then the smoke test**

  Run:

  ```text
  python -m pytest tests/test_snapshot_contract.py tests/test_provenance.py tests/test_smoke.py -q
  ```

  Expected: contract tests pass; smoke remains red until the CLI is implemented in Task 5.

- [ ] **Step 5: Commit the model boundary**

  ```text
  git add src/sonar/core/models.py src/sonar/core/provenance.py src/sonar/adapters/snapshot.py tests/test_snapshot_contract.py tests/test_provenance.py
  git commit -m "feat: add neutral snapshot and provenance contracts"
  ```

### Task 3: Implement deterministic retrieval, temporal, conflict, and gap analysis

**Files:**
- Create: `theseus-sonar/src/sonar/core/ranking.py`
- Create: `theseus-sonar/src/sonar/core/probing.py`
- Create: `theseus-sonar/src/sonar/core/temporal.py`
- Create: `theseus-sonar/src/sonar/core/conflicts.py`
- Create: `theseus-sonar/src/sonar/core/gaps.py`
- Create: `theseus-sonar/src/sonar/core/analysis.py`
- Create: `theseus-sonar/tests/test_ranking.py`
- Create: `theseus-sonar/tests/test_temporal_conflicts.py`
- Create: `theseus-sonar/tests/test_gaps.py`

**Interfaces:**
- `build_probe(query: str) -> Probe` returns a bounded normalized query.
- `rank_nodes(snapshot: Snapshot, probe: Probe) -> list[RankedNode]` is deterministic for the same snapshot and query.
- `detect_temporal_signals(snapshot: Snapshot) -> list[TemporalSignal]` reports temporal edges and stale/overlapping validity data.
- `detect_conflicts(snapshot: Snapshot) -> list[ConflictSignal]` reports explicit contradiction or invalidation relations without resolving them into truth.
- `collect_gaps(snapshot: Snapshot, query: Probe, index_state: IndexState) -> list[EvidenceGap]` reports missing provenance, stale/absent index, and missing live verification.
- `preflight(snapshot: Snapshot, query: str, provenance_mode: str = "public") -> EvidencePacket` combines the outputs without importing any adapter or transport.

- [ ] **Step 1: Write deterministic ranking and signal tests**

  Use a three-node synthetic fixture with one exact query match, one older contradictory node, and one node lacking source provenance. Assert stable ordering and separate signal fields.

- [ ] **Step 2: Run focused tests and verify the red state**

  ```text
  python -m pytest tests/test_ranking.py tests/test_temporal_conflicts.py tests/test_gaps.py -q
  ```

  Expected: failures because analysis functions are not implemented.

- [ ] **Step 3: Implement the bounded deterministic analysis**

  Use a small local ranking boundary. If DuckDB is used for the rebuildable index, keep it behind an internal interface and never expose database objects in the output contract. Do not convert any confidence or score into a truth claim.

- [ ] **Step 4: Run focused tests and the full offline suite**

  ```text
  python -m pytest -q
  ```

  Expected: all model, provenance, analysis, and fixture tests pass; the smoke test may still be red until the CLI is wired in Task 5.

- [ ] **Step 5: Commit the analysis slice**

  ```text
  git add src/sonar/core tests/test_ranking.py tests/test_temporal_conflicts.py tests/test_gaps.py
  git commit -m "feat: add deterministic Sonar evidence analysis"
  ```

### Task 4: Add rebuildable index and explicit stale-state semantics

**Files:**
- Create: `theseus-sonar/src/sonar/core/index.py`
- Create: `theseus-sonar/src/sonar/core/state.py`
- Create: `theseus-sonar/src/sonar/core/operations.py`
- Create: `theseus-sonar/tests/test_index_state.py`

**Interfaces:**
- `IndexState` has exactly the observable states `refreshed`, `reused`, `empty`, and `stale`.
- `RebuildableIndex.refresh(snapshot: Snapshot) -> RefreshReceipt` rebuilds local state and never mutates a source adapter.
- `RebuildableIndex.inspect() -> IndexState` reports state without silently refreshing.
- `status() -> StatusPacket`, `refresh() -> RefreshPacket`, and `preflight(query: str) -> EvidencePacket` provide the transport-independent operation contracts.

- [ ] **Step 1: Write tests for empty, refreshed, reused, and stale states**

  The stale test must prove that preflight returns a structured gap or an explicit bounded stale result according to the selected policy; it must not look like a current successful refresh.

- [ ] **Step 2: Run the focused tests and verify failure**

  ```text
  python -m pytest tests/test_index_state.py -q
  ```

  Expected: failure because index and operation boundaries are absent.

- [ ] **Step 3: Implement the disposable local index**

  Keep all generated DuckDB files outside tracked source paths. A refresh receipt must state what changed, the snapshot version, the provenance mode, and the resulting state.

- [ ] **Step 4: Run the full offline suite**

  ```text
  python -m pytest -q
  ```

  Expected: all offline Core and index-state tests pass.

- [ ] **Step 5: Commit the operation boundary**

  ```text
  git add src/sonar/core/index.py src/sonar/core/state.py src/sonar/core/operations.py tests/test_index_state.py
  git commit -m "feat: make Sonar index state explicit and rebuildable"
  ```

### Task 5: Wire the offline CLI and pass the acceptance slice

**Files:**
- Create: `theseus-sonar/src/sonar/__main__.py`
- Modify: `theseus-sonar/tests/test_smoke.py`
- Modify: `theseus-sonar/README.md`
- Create: `theseus-sonar/tests/test_cli.py`

**Interfaces:**
- `python -m sonar snapshot <path> status` prints one JSON `StatusPacket`.
- `python -m sonar snapshot <path> refresh` prints one JSON `RefreshPacket`.
- `python -m sonar snapshot <path> preflight --query <text>` prints one JSON `EvidencePacket`.
- Invalid JSON, unsupported snapshot versions, missing files, and empty queries exit non-zero with a machine-readable error on stderr.

- [ ] **Step 1: Write CLI contract tests**

  Cover all three commands, a missing file, an invalid query, and stable JSON output. Assert that no command attempts a network connection.

- [ ] **Step 2: Run the CLI tests and verify failure**

  ```text
  python -m pytest tests/test_cli.py tests/test_smoke.py -q
  ```

  Expected: failure because the module entrypoint is absent or incomplete.

- [ ] **Step 3: Implement the thin CLI**

  The CLI loads the snapshot adapter, calls the transport-independent operations, serializes exactly one packet, and exits with a non-zero code for invalid input. It must not import an AutoMem client.

- [ ] **Step 4: Run the acceptance command exactly as documented**

  ```text
  python -m sonar snapshot examples/snapshot.json preflight --query "runtime verification"
  python -m pytest -q
  ```

  Expected: the command exits 0 and emits the expected evidence packet; the complete offline test suite passes.

- [ ] **Step 5: Document the clean-machine path**

  README must explain installation, the three commands, the snapshot shape, public provenance, and the fact that no Theseus service is required for the Core MVP.

- [ ] **Step 6: Commit the executable Core MVP**

  ```text
  node tools/git_safety/scan_staged.mjs
  git add src/sonar/__main__.py tests/test_cli.py tests/test_smoke.py README.md
  git commit -m "feat: expose offline Sonar core CLI"
  ```

### Task 6: Add equivalent stdio and localhost HTTP transports

**Files:**
- Create: `theseus-sonar/src/sonar/transports/stdio.py`
- Create: `theseus-sonar/src/sonar/transports/http.py`
- Create: `theseus-sonar/tests/test_transports.py`
- Create: `theseus-sonar/Dockerfile`
- Create: `theseus-sonar/compose.yml`
- Modify: `theseus-sonar/README.md`

**Interfaces:**
- Both transports expose exactly `sonar_status`, `sonar_refresh`, and `sonar_preflight`.
- Both transports call the same `operations.py` functions and return the same JSON schemas.
- HTTP binds to `127.0.0.1` by default and rejects a non-localhost bind unless an explicit deployment setting is present.
- Docker packaging runs the synthetic snapshot smoke path without AutoMem, MemPalace, Basic Memory, GTD, WSL, or Codex Desktop.

- [ ] **Step 1: Write the transport parity tests**

  Start each transport against the same synthetic snapshot and assert identical tool names, operation result keys, provenance mode, and gap semantics. Do not compare incidental timestamps or process IDs.

- [ ] **Step 2: Run parity tests and verify failure**

  ```text
  python -m pytest tests/test_transports.py -q
  ```

  Expected: failure because the transports are not implemented.

- [ ] **Step 3: Implement thin stdio and localhost HTTP adapters**

  Keep protocol parsing, error mapping, and lifecycle management in the transport files. Business logic remains in `operations.py`.

- [ ] **Step 4: Run parity, offline, and Docker smoke checks**

  ```text
  python -m pytest -q
  docker compose config
  docker compose run --rm sonar python -m sonar snapshot examples/snapshot.json preflight --query "runtime verification"
  ```

  Expected: all tests pass, compose configuration parses, and the container emits the same evidence packet shape without external credentials.

- [ ] **Step 5: Commit transport parity and packaging**

  ```text
  node tools/git_safety/scan_staged.mjs
  git add src/sonar/transports Dockerfile compose.yml tests/test_transports.py README.md
  git commit -m "feat: add equivalent Sonar MCP transports"
  ```

### Task 7: Complete the private incubation review gate

**Files:**
- Create: `theseus-sonar/docs/architecture.md`
- Create: `theseus-sonar/docs/security-and-provenance.md`
- Create: `theseus-sonar/CONTRIBUTING.md`
- Create: `theseus-sonar/LICENSE`
- Create: `theseus-sonar/tests/test_repository_boundary.py`

**Interfaces:**
- Documentation states the Core/adapters/transports boundary, neutral authority classes, score semantics, provenance modes, stale-index policy, and local-only HTTP default.
- The repository boundary test fails if tracked files include environment files, DuckDB files, snapshots outside fixtures/examples, backup archives, or private-looking path fixtures.
- Contribution guidance requires tests, explicit evidence boundaries, and no claims that retrieval scores represent truth.

- [ ] **Step 1: Write the repository-boundary test and run it red**

  ```text
  python -m pytest tests/test_repository_boundary.py -q
  ```

  Expected: the test identifies any prohibited artifact present before the final audit.

- [ ] **Step 2: Write the security, architecture, and contribution documents**

  Include the concrete public/private/redacted provenance examples, the neutral authority order, and the conditions for HTTP exposure beyond localhost.

- [ ] **Step 3: Run the complete verification gate**

  ```text
  python -m pytest -q
  git diff --check
  git status --short
  node tools/git_safety/scan_staged.mjs
  ```

  Expected: tests pass, diff check is clean, status contains only intended files, and the staged scan reports no secrets or private artifacts.

- [ ] **Step 4: Request human review before any public release**

  Review must explicitly decide the license, contribution policy, support expectations, repository boundary, and whether the project is community-ready. Do not create or publish a public repository until this review is accepted.

- [ ] **Step 5: Stop at the private incubation gate**

  The plan is complete when the private repository passes the synthetic acceptance slice, transport parity checks, security scan, clean-machine smoke test, and explicit maintainer review. Public naming, namespace, publication, and integration with Theseus remain separate decisions.

## Self-review against the boundary design

- Core neutrality: Tasks 2–5 keep source adapters and Theseus integrations outside the Core.
- Synthetic offline acceptance: Tasks 1 and 5 define and execute the exact acceptance slice.
- Provenance privacy: Task 2 and Task 7 cover public, local, and redacted modes.
- Score semantics: Tasks 3 and 7 preserve separate score fields and document that they are not truth probabilities.
- Stale-index behavior: Task 4 tests explicit `refreshed`, `reused`, `empty`, and `stale` states.
- Transport parity and defaults: Task 6 covers equivalent stdio/HTTP operations and localhost-only HTTP.
- Public-release boundary: Task 7 requires explicit review and keeps publication outside implementation.
- Forbidden artifacts: Global constraints and Task 7 provide both preventive rules and a repository test.

The plan deliberately does not include a public repository creation step, an AutoMem write adapter, a Codex Desktop integration, or a migration of the existing `tools/sonar_local` directory. Those are later gates, not part of the first executable Core slice.
