# Graphify Pilot

Date: 2026-07-15
Tool: `graphifyy==0.9.16`
Mode: isolated local pilot

## Scope

This was a safe first pilot of Graphify as a structural project lens for Theseus
local lab.

The pilot deliberately avoided:

- `graphify install`;
- changes to `AGENTS.md`;
- Codex/Graphify hooks;
- semantic extraction of docs, PDFs, images, or media;
- API keys or external LLM calls;
- tracked generated graph artifacts.

The venv lives under ignored `work/graphify-pilot/venv-codex`.

The pilot corpus was copied outside the repository to avoid `.gitignore`
filtering:

```text
C:\Users\s.poklad\Documents\Codex\2026-07-08\graphify-theseus-pilot\corpus
```

The generated graph is:

```text
C:\Users\s.poklad\Documents\Codex\2026-07-08\graphify-theseus-pilot\out\graphify-out\graph.json
```

## Corpus

Selected harness layers:

- `tools/tool_policy`
- `tools/workshop_dashboard`
- `tools/source_lens`
- `tools/session_timeline`
- `tools/memory_hook`
- `tools/git_safety`
- `tools/harness_errors`
- `.agents/skills`
- `.vscode/tasks.json`
- `AGENTS.md`
- `TASKS.md`

Copied file count: 38.

## Command

```text
graphify extract C:\Users\s.poklad\Documents\Codex\2026-07-08\graphify-theseus-pilot\corpus --code-only --out C:\Users\s.poklad\Documents\Codex\2026-07-08\graphify-theseus-pilot\out --no-cluster
```

## Result

Graphify reported:

```text
--code-only: skipping 17 non-code file(s) (17 docs, 0 papers, 0 images) - no LLM extraction
found 19 code, 0 docs, 0 papers, 0 images
2 file(s) not classified: Dockerfile, styles.css
wrote graph.json - 217 nodes, 493 edges (no clustering)
```

Compact graph inspection:

```text
nodes: 217
edges: 493
relations:
  calls: 201
  contains: 199
  imports_from: 59
  imports: 24
  indirect_call: 9
  references: 1
```

`graphify diagnose multigraph` reported:

```text
raw_edge_count: 493
valid_candidate_edges: 444
post_build_graph_type: DiGraph
post_build_edge_count: 440
directed_same_endpoint_collapsed_edges: 4
dangling_endpoint_edges: 49
```

## Smoke Queries

`graphify query "what connects dashboard to git status"` returned a scoped
subgraph with 99 nodes, including:

- `dashboard.mjs`
- `buildDashboard()`
- `git()`
- `scan_staged.mjs`
- `commit_checkpoint.mjs`
- `refreshUsageScout()`
- `statusClass()`

`graphify explain "buildDashboard()"` correctly identified:

```text
Source: ../corpus/workshop_dashboard/dashboard.mjs L229
Degree: 15
```

and showed direct `EXTRACTED` calls to:

- `item()`
- `dockerContainers()`
- `gitState()`
- `recentToolPolicyIncidents()`
- `statusFromFreshness()`
- `readJsonl()`
- `httpGet()`
- `tcpCheck()`
- `latestFile()`

`graphify path "buildDashboard()" "scan_staged.mjs"` found:

```text
buildDashboard()
  <--contains [EXTRACTED]-- dashboard.mjs
  --imports_from [EXTRACTED]--> ref_node_child_process
  <--imports_from [EXTRACTED]-- scan_staged.mjs
```

## Boundaries Found

### WSL Python

WSL has Python 3.12, but lacks `python3-venv`, so an isolated WSL venv could not
be created without installing system packages.

Classification: `environment_context_failure`.

### Windows Python

System Windows Python is 3.9.13, while Graphify requires Python `>=3.10`.

Classification: `environment_context_failure`.

### Codex Bundled Python

Codex bundled Python is 3.12.13 and worked for the isolated pilot venv.

Classification: `verified_route`.

### Ignored Work Directory

Running Graphify inside ignored `work/` produced an empty graph because the
corpus was under a `.gitignore`-ignored subtree.

Classification: `environment_context_failure`.

Resolution: use a pilot corpus outside the repository or adjust Graphify ignore
inputs explicitly in a future wrapper.

### PowerShell Variable Expansion

An attempted `wsl bash -lc` command with `$SRC` and `$PILOT` variables was
expanded by the outer Windows shell before reaching bash.

Classification: `shell_route_failure`.

Resolution: avoid `$` variables in shell strings launched through PowerShell, or
move the repeated workflow into a checked-in script/VS Code task.

### Graphify Benchmark

`graphify benchmark graph.json` failed with:

```text
KeyError: 'links'
```

The generated `graph.json` uses top-level `edges`, not `links`.

Classification: `tool_route_failure`.

This may be a Graphify CLI compatibility issue in `0.9.16`, or a limitation of
the `--no-cluster` extraction path.

## Fit For Theseus

Graphify is a good candidate for a third context layer:

```text
AutoMem     -> durable decisions and reusable patterns
MemPalace   -> episodic/verbatim context
Graphify    -> structural repo graph and code/tool relationships
```

The strongest immediate use is query-first navigation across harness tools,
dashboard code, git safety checks, and route-policy scripts without reading the
whole repository into context.

Do not install Graphify hooks or AGENTS modifications until a wrapper is
designed around the existing Theseus skill-router and hook policy.

## Implementation Follow-Up

Implemented:

- `tools/graphify_harness/graphify_harness.mjs`
- `tools/graphify_harness/README.md`
- VS Code task: `Theseus Graphify Harness: build`
- ignored summaries under `outputs/graphify_harness/*.md` and
  `outputs/graphify_harness/*.json`

The wrapper:

- reuses or bootstraps an isolated Graphify venv;
- uses Codex bundled Python 3.12 when available;
- builds a sanitized corpus outside ignored repo paths;
- runs `graphify extract --code-only`;
- runs fixed smoke checks: query, explain, path, diagnose;
- writes JSONL progress events to stderr;
- writes `latest.md` and `latest.json` summaries;
- never calls `graphify install`;
- never modifies `AGENTS.md`, hooks, or Git config.

Runtime proof:

```text
status: ok
nodes: 217
edges: 493
summary: outputs\graphify_harness\graphify_harness_2026-07-15T052403Z.md
latest: outputs\graphify_harness\latest.md
```

The workshop task graph now classifies this as:

```text
label: Theseus Graphify Harness: build
group: Graph lens
route_hint: Node wrapper
capabilities: graph, observability
```

## Future Step

Consider a second-stage wrapper:

```text
Theseus: graphify harness serve
```

Candidate behavior:

- serve `graph.json` through Graphify MCP or HTTP;
- expose query/path/explain as a narrow local tool;
- keep `extract --code-only` as the default safe build mode;
- do not add Graphify hooks until the Theseus skill-router explicitly routes
  them.
