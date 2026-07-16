# Graphify Harness Lens

Repeatable Graphify pilot for Theseus local lab.

This wrapper keeps Graphify as a structural repo lens without installing
Graphify agent hooks or editing `AGENTS.md`.

## Run

```text
node tools/graphify_harness/graphify_harness.mjs
```

Optional scoped profiles:

```text
node tools/graphify_harness/graphify_harness.mjs --profile harness
node tools/graphify_harness/graphify_harness.mjs --profile memory
node tools/graphify_harness/graphify_harness.mjs --profile observatory
```

Query an already-built profile without rebuilding:

```text
node tools/graphify_harness/graphify_query.mjs --profile harness --command query "what connects dashboard to git safety"
node tools/graphify_harness/graphify_query.mjs --profile harness --command explain "buildDashboard()"
node tools/graphify_harness/graphify_query.mjs --profile harness --command path --from "buildDashboard()" --to "scan_staged.mjs"
```

Outputs:

- generated corpus and graph:
  `C:\Users\s.poklad\Documents\Codex\2026-07-08\graphify-theseus-pilot`
- compact ignored summaries:
  `outputs/graphify_harness/*.md`
  `outputs/graphify_harness/*.json`
- latest query answers:
  `outputs/graphify_harness/latest_query_<profile>.md`
  `outputs/graphify_harness/latest_query_<profile>.json`

Corpus profiles live in `tools/graphify_harness/corpus_profiles.json`.

## Guardrails

- Does not run `graphify install`.
- Does not modify `AGENTS.md`, hooks, or Git config.
- Runs `graphify extract --code-only`.
- Uses Codex bundled Python 3.12 when available.
- Writes JSONL progress events to stderr.
- Query commands reuse an existing graph and do not rebuild it.
- Each corpus profile owns its own smoke query and graph-node checks; profiles
  do not borrow names from the harness profile.
- On WSL, optional `explain`, `path`, and `diagnose` calls run under a process
  timeout that also terminates the stalled Graphify child. A timeout is written
  as `WARN` in the ignored summary; a healthy graph and query are still useful
  evidence and are not discarded.
- This is currently a code-structure lens. Google Drive prose, PDFs, and chat
  exports need a separate provenance-preserving semantic ingest before they can
  be represented as a text knowledge graph.
