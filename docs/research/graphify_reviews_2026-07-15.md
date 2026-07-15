# Graphify Community Review Notes

Date: 2026-07-15

Purpose: decide how Graphify should enter Theseus local lab without turning into
another heavy background ritual.

## What The Reviews Agree On

Graphify is strongest as a persistent structural map, not as a replacement for
all search or all memory.

Repeated user reports and guides converge on this pattern:

- build a graph once for a meaningful corpus;
- query the graph before broad file reads;
- use reports for architecture/onboarding review;
- update deliberately after meaningful changes, not after every agent turn.

The most grounded token claim found in community feedback is not the headline
`71.5x`. A real-codebase review reported about `7.3x` fewer tokens, with
`5x-10x` as a more realistic expectation for pure code. The more important
benefit is persistent structure across sessions: god nodes, communities, blast
radius, and named relationships that would otherwise be re-derived each time.

## Large Corpus Pattern

For large projects, one GitHub discussion recommends:

- keep one main `AllFolders` graph for the whole corpus;
- use type/scoped graphs only when they reduce the daily context cost;
- generate wiki output only for the main graph and only at milestones;
- use `GRAPH_REPORT.md` for normal daily navigation;
- avoid manually updating every scoped graph during active development.

For Theseus this maps to:

```text
graphify-main
  whole harness / workshop map

graphify-scoped
  memory stack
  observatory
  logs
  external chat exports
  Google Drive notes snapshots
```

The main graph should answer "where should I look first?". Scoped graphs should
answer "what is the local structure of this corpus?".

## Hook And Resource Boundary

Community practice is explicit: do not run Graphify after every AI stop event.
One guide warns that repeated `graphify update` from agent stop hooks can create
long background jobs, CPU spikes, and swap exhaustion.

Theseus rule:

```text
Graphify is a lens task, not a stop hook.
```

Good triggers:

- manual VS Code task;
- after checkpoint commit;
- nightly or low-load scheduled refresh;
- after importing a new large corpus snapshot.

Bad triggers:

- every prompt;
- every file read;
- every agent stop;
- hidden background rebuild without progress telemetry.

## Security And Data Routing

Official documentation says code-only extraction runs locally via tree-sitter
and needs no API key. Semantic extraction for docs, PDFs, images, and other
non-code material requires a configured backend unless routed through a local
backend such as Ollama.

Theseus rule:

```text
code-only first;
semantic corpus only with an explicit backend and source allowlist.
```

This matters for Google Drive notes and chat exports: they may not contain
secrets, but they still deserve source labels, scope boundaries, and a chosen
backend before extraction.

## Falkor / AutoMem Fit

Graphify does not replace AutoMem or MemPalace:

- AutoMem: durable decisions, preferences, reusable patterns.
- MemPalace: episodic/verbatim and narrative recall.
- Graphify: structural corpus map.

The local FalkorDB already used by AutoMem makes a future bridge attractive, but
Graphify's immediate artifact is `graph.json`, not a native Falkor graph. The
safe next step is an importer prototype:

```text
graphify graph.json
  -> normalize nodes and edges
  -> write to separate Falkor graph namespace
  -> preserve relation confidence: EXTRACTED / INFERRED / AMBIGUOUS
  -> never mix imported structural graph with AutoMem facts without labels
```

Do not collapse Graphify relations into AutoMem memories directly. A graph edge
is evidence for navigation; it is not automatically a durable preference or
decision.

## Practical Adoption For Theseus

Keep the current wrapper:

```text
tools/graphify_harness/graphify_harness.mjs
```

Near-term additions:

- add corpus profiles rather than hard-coding one file list forever;
- keep generated graph artifacts outside the repo or explicitly ignored;
- summarize graph statistics on the workshop dashboard;
- add a `graphify freshness` warning only when a selected corpus is stale;
- measure token savings by comparing "raw file route" vs "graph route" on
  repeated questions.

Do not install upstream Graphify hooks yet. Theseus already has a skill-router,
dashboard, progress events, Git safety, and memory hooks. Graphify should enter
through those routes, not bypass them.

