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

Prepare a user-provided DeepSeek chat export for a separate semantic corpus:

```text
node tools/graphify_harness/normalize_chat_export.mjs --input <chat.json> --out <ignored-corpus.md>
```

The normalizer retains visible messages plus a separately labelled
`reasoning_trace` layer from the user-provided export. It excludes service
metadata and performs a basic token/private-key redaction pass before a
semantic backend sees the text. A reasoning trace is source-specific evidence,
not a verified factual claim.

For an approved provider stored in Infisical, run the semantic extractor through
the Windows-to-WSL bridge rather than copying provider values into WSL files:

```text
infisical run --env=local --path=/providers -- node tools/graphify_harness/run_semantic_wsl.mjs --corpus <corpus-dir> --out <ignored-output-dir>
```

The bridge forwards an OpenAI-compatible provider only to the child WSL
process. It emits provider names and boolean checks, never key values.
Its default semantic venv lives at
`/home/poklad/.cache/theseus-graphify/venv`, outside the Windows-mounted
workspace; set `GRAPHIFY_WSL_EXE` only when deliberately using another native
WSL installation.

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
