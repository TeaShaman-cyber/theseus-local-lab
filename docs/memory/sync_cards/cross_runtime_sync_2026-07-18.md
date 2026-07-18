# Cross-Runtime Memory Sync: 2026-07-18

## Scope And Provenance

This is a compact local handoff distilled from ButlerBrain, MarcoPolo, and
Google Drive. It is not a claim that any remote chat or workspace can observe
the current laptop runtime.

Sources:

- ButlerBrain canonical environment and bridge notes, 2026-07-17.
- MarcoPolo `shipyard-runtime-contract:v1` and its passing doctor report.
- Google Drive: `Shipyard Runtime State` and `Laboratory Journal - Sonar,
  J-space and unfinished bridges`, read on 2026-07-18.

## Durable Decisions

### 1. Authority Is Typed By Environment

- Laptop Git, local traces, Docker, and local tests are authoritative only for
  their observed local run.
- ButlerBrain is a semantic DIFF and invariant mirror. It cannot authorize
  local execution or assert local runtime state.
- MarcoPolo DuckDB is operational truth only inside its own remote runtime.
- Google Drive is a document and shared-artifact source, not a concurrent
  operational writer for Theseus.
- Imported advice is `UNTRUSTED_UNTIL_LOCAL_VERIFICATION` until a local
  artifact, test, or trace confirms it.

### 2. Small Wake Discipline Is Worth Reusing

MarcoPolo's M0 contract has a useful bounded pattern:

```text
one active lease -> at most one task per wake -> observable postcondition
-> checkpoint or explicit no-checkpoint reason -> RETURN_TO_CYCLE
```

An empty queue must return `IDLE` or `SKIPPED`; it must not invent work. This
is a candidate Theseus scheduler rule, not yet a local implementation.

### 3. Sonar Trace Is A Good Evidence Shape

Keep raw evidence separate from a compact, immutable index. The index should
retain at least:

```text
trace_id, schema_version, artifact_ref, sha256, content_fingerprint,
observed_at, probe_class, source_count, contamination_flags
```

This could later support Graphify/OSINT work: it preserves provenance and
allows comparison of independent probes without treating semantic proximity as
causality.

### 4. Research Needs Typed Uncertainty

Use `FACT`, `INFERENCE`, `HYPOTHESIS`, and `UNKNOWN` for research claims.
Every durable claim needs a source reference and must distinguish primary
evidence, later summaries, and duplicate sources. A compact must preserve
constraint class, provenance, and vetoes - not only importance scores.

## Implications For The Local Memory Organ

- AutoMem remains the primary durable semantic layer.
- MemPalace remains the episodic/verbatim layer. Its data is intact, but the
  Codex Desktop MCP registration is currently degraded; this card is mined as
  an explicit fallback, not a replacement for repairing MCP.
- Graphify remains an on-demand structural lens. It should attach an artifact
  reference and provenance receipt rather than bulk-copy graph edges into
  AutoMem.
- A future bridge must be selective and provenance-labelled; never an
  unrestricted bidirectional synchronization of local and chat state.

## Candidate Experiments, Not Policy

1. Compare a chronological compact, a free summary, and a causal workspace
   card after a real context compaction. Measure decision loss, contradiction,
   continuation success, and context cost.
2. Prototype a read-only Sonar receipt for one Graphify or OSINT operation.
   Do not schedule it until the memory receipt schema is implemented and
   reviewed.
