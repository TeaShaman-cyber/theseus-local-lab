# Memory Organ: Default-Network-Inspired Plan

## Purpose

Theseus needs one dependable memory organ for continuity across context
compaction, model changes, provider failures, and platform migration. It must
not collapse three useful systems into one opaque database.

## Evidence And Boundary

The Default Mode Network (DMN) is a brain network associated with internally
generated thought and with episodic, autobiographical, and semantic memory.
Its interaction with hippocampal and cortical systems matters for memory, but
it is not a blueprint for an AI consciousness or a literal agent personality.

The Strazh corpus contributed a useful engineering hypothesis: a continuity
layer should preserve an internal narrative and make cross-episode connections
when no foreground task is active. Its numerical claim that "20% of energy is
spent on the DMN" is not an accepted engineering input and must not be used as
a design parameter. The corpus remains a provenance-labelled idea source.

Confirmed reading:

- Menon, *20 years of the default mode network: a review and synthesis*
  (2023): DMN research covers self-reference, social cognition, episodic and
  autobiographical memory, language, semantic memory, and mind wandering.
  [PubMed 37167968](https://pubmed.ncbi.nlm.nih.gov/37167968/)
- Spreng et al. meta-analysis: a related core network is implicated in
  autobiographical memory, prospection, navigation, and theory of mind.
  [PubMed 18510452](https://pubmed.ncbi.nlm.nih.gov/18510452/)

## Complementary Layers

| Layer | System | Owns | Must not become |
| --- | --- | --- | --- |
| Durable semantic state | AutoMem | decisions, preferences, patterns, causal fixes, typed relations | a raw transcript archive |
| Episodic evidence | MemPalace | verbatim drawers, diary, exact wording, handoff context | a replacement for ranked semantic recall |
| Structural lens | Graphify | on-demand corpus and code relations, bounded concept graphs | a stop-hook or always-on background indexer |
| Federation preflight | Local Sonar | small ranked evidence slices, authority bridges, conflicts, temporal drift, and explicit gaps | another memory authority or a substitute for live verification |

Local files remain evidence and an explicit fallback. They are not the default
recall route.

## Unified Organ Contract

The unification point is a small orchestrator contract, not a new monolith.
Every significant memory operation should produce a compact receipt:

```text
event_id, timestamp, source, intent, layer, provenance, status,
durable_memory_id, episodic_drawer_id, graph_artifact, verification
```

1. Before meaningful work: recall AutoMem; retrieve a MemPalace episode when
   exact wording or prior trajectory matters. Use Local Sonar only when a
   cross-layer route, authority boundary, or temporal conflict needs a compact
   preflight.
2. During foreground work: write only verified decisions and reusable failures
   to AutoMem; preserve raw evidence only when it has future evidentiary value.
3. After a bounded episode: create a MemPalace checkpoint and link its receipt
   to the AutoMem decision.
4. On explicit corpus work: invoke Graphify through a scoped profile; attach
   only its artifact path and provenance to the receipt, never bulk-copy graph
   edges into AutoMem.
5. During background consolidation: inspect stale, conflicting, or unlinked
   receipts; propose a small merge, relation, archive, or intentional no-op.

Local Sonar keeps a rebuildable DuckDB index on WSL ext4 and reads AutoMem only
through its authenticated graph API. Basic Memory Cloud can contribute reviewed
federation contracts or DIFFs, but it is not part of the local hot path.

## DMN-Inspired Background Cycle

The background cycle is a conservative maintenance loop, not autonomous
rumination:

```text
recent verified events
  -> identify open loops / duplicates / missing links
  -> retrieve a small supporting set
  -> propose or apply a bounded consolidation
  -> verify recall and emit a receipt
  -> return to foreground task
```

Guardrails:

- no raw transcript ingestion into AutoMem;
- no Graphify run after every response;
- no update without provenance and a postcondition;
- no reward score used as proof of learning;
- unresolved evidence stays labelled as a hypothesis;
- a failed secondary layer raises a visible warning instead of silently
  downgrading continuity.

## Current State

- AutoMem is primary and runtime-verified.
- Graphify is runtime-verified as an on-demand WSL lens; the Strazh DMN corpus
  produced a 44-node, 89-edge graph on 2026-07-16.
- MemPalace is runtime-verified through MCP: 31 drawers, a 10-room/10-edge
  episodic graph, and a healthy SQLite integrity check on 2026-07-22.
- Local Sonar is in trial. Its first verified refresh indexed 247 AutoMem
  documents, 1690 memory edges, and a 9-node/11-edge federation contract with
  exact readback. Three route probes recovered the intended evidence in
  1.3-2.6 seconds of internal ranking time.

## Next Small Steps

1. Add a read-only memory-organ status card to the workshop dashboard with
   each layer's health, last receipt, and degradation reason.
2. Introduce the receipt schema in the existing memory hook before adding any
   background consolidation scheduler.
3. Measure whether repeated Local Sonar use improves route selection enough to
   justify its Windows-to-WSL startup cost before promoting it from trial.
