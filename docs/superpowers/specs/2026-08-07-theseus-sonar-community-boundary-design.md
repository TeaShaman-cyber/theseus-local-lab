# Sonar Community Boundary Design

Date: 2026-08-07
Status: Reviewed with metacognitive adversarial pass
Incubation repository: `theseus-sonar` (private)

`Sonar` is the established internal/project identity. The private incubation
repository keeps that lineage; a future public release may revisit the name
only after an actual namespace, search, and affiliation review.

## Context

The current `tools/sonar_local` implementation is useful as a local,
read-only, provenance-aware memory reconciliation layer. It already provides
semantic probing, a rebuildable DuckDB index, temporal and conflict signals,
gap reporting, and MCP access over stdio and localhost Streamable HTTP.

The directory is a working Theseus integration, not yet a community package.
It mixes reusable retrieval logic with AutoMem access, Theseus authority
policy, Windows/WSL launchers, Docker Desktop assumptions, and local
operational evidence.

The goal is a small private incubation repository that can later become a
community project without exporting personal or deployment-specific
infrastructure.

## Goals

- Extract a community-neutral Sonar Core from the current implementation.
- Keep the first version read-only and rebuildable.
- Support synthetic snapshots so the Core works without Theseus services.
- Preserve provenance, temporal drift, conflict, and gap signals.
- Keep MCP transport separate from source adapters and local launchers.
- Retain Theseus integration as an adapter layer rather than a hidden Core
  dependency.
- Establish explicit maturity gates before any public release.
- Make the first Core slice executable by an unfamiliar developer on a clean
  machine.

## Non-goals

- Replacing AutoMem, MemPalace, Basic Memory, GTD, or live runtime evidence.
- Estimating a probabilistic truth score for memories.
- Shipping real memory snapshots, credentials, private paths, or personal
  identity material.
- Rebuilding the full Theseus/Codex Desktop integration in the community MVP.
- Creating a public GitHub repository before a community-ready review.
- Adding write-capable memory operations.
- Treating retrieval scores or source metadata as truth probabilities.

## Proposed repository boundary

```text
theseus-sonar/
├── src/sonar/core/
│   ├── models.py
│   ├── probing.py
│   ├── ranking.py
│   ├── provenance.py
│   ├── temporal.py
│   ├── conflicts.py
│   └── gaps.py
├── src/sonar/adapters/
│   ├── snapshot.py
│   └── automem.py
├── src/sonar/transports/
│   ├── stdio.py
│   └── http.py
├── tests/
│   ├── fixtures/
│   ├── test_core.py
│   └── test_transports.py
├── examples/
├── docs/
├── pyproject.toml
├── Dockerfile
├── compose.yml
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## Layer responsibilities

### Core

The Core owns the data model and deterministic analysis:

- snapshot normalization;
- tokenization and controlled probe construction;
- BM25 or equivalent local ranking;
- result fusion, initially reciprocal-rank fusion;
- provenance packets and source references;
- temporal edge and drift detection;
- contradiction/invalidation reporting;
- explicit evidence gaps and verification requirements;
- a stable read-only output contract.

The MVP may use DuckDB and BM25 as concrete dependencies. They must remain
behind small internal storage and retrieval boundaries so that a later backend
replacement does not change the snapshot or output contracts.

The Core must not import AutoMem, MemPalace, Notion, GTD, Codex, Docker,
Windows, or WSL modules.

### Source adapters

Adapters translate external sources into the neutral snapshot contract.

The snapshot adapter is mandatory for the MVP and must accept synthetic JSON.
The AutoMem adapter is optional and belongs to the private incubation profile
until its authentication and export boundary are reviewed.

### Transports

Transports expose the same read-only operations without changing their
semantics. The initial operations are `sonar_status`, `sonar_refresh`, and
`sonar_preflight`.

HTTP and stdio are delivery mechanisms, not separate business logic. Tests
must verify that both transports expose the same tool names and output shape.

### Theseus integration

The current project retains the operational layer:

- AutoMem endpoint and authentication environment variables;
- MemPalace and Basic Memory references;
- federation authority order involving Theseus runtime, Git, SkillRouter, and
  ToolPolicy;
- Windows and WSL launchers;
- Docker Desktop routing and localhost port policy;
- Codex project-scoped MCP configuration;
- GTD handoff and memory checkpoint procedures.

These are valuable integrations, but they are not requirements for the
community Core.

## Neutral authority model

The Theseus authority order must not be copied into the community Core as a
universal hierarchy. Core uses neutral evidence classes instead:

```text
operator_constraint
-> live_operational_evidence
-> source_evidence
-> memory_or_retrieval_context
```

An integration may map its own runtime, Git, memory, and policy surfaces onto
these classes. Sonar reports the mapping and its gaps; it never promotes a
memory result over a fresh operational observation.

## Neutral snapshot contract

The first contract should support a deliberately small shape:

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "stable-id",
      "content": "A source statement",
      "type": "Decision",
      "tags": ["example"],
      "importance": 0.8,
      "confidence": 0.8,
      "source": {"kind": "fixture", "ref": "example.json"},
      "valid_from": "2026-01-01T00:00:00Z",
      "valid_to": null
    }
  ],
  "edges": [
    {
      "source": "older-id",
      "target": "newer-id",
      "type": "CONTRADICTS",
      "strength": 0.9
    }
  ]
}
```

The contract is an evidence format, not a claim that `confidence` equals
truth. The output must retain the distinction between retrieval relevance,
source metadata, temporal information, and live verification requirements.

Implementations must keep these concepts separate:

- `retrieval_score`: relevance produced by the local retrieval algorithm;
- `source_confidence`: metadata supplied by the source, if any;
- `temporal_strength`: strength of a temporal relation or drift signal;
- `contradiction_strength`: strength of an explicit contradiction edge.

None of these fields is a probability that a memory is true.

## Provenance privacy

Provenance is potentially sensitive even when content is synthetic. A source
reference may reveal local usernames, filesystem paths, internal URLs, memory
identifiers, or private project names.

The output contract therefore supports three provenance modes:

- `public`: stable non-sensitive references suitable for examples;
- `local`: detailed references retained for the operator's local run;
- `redacted`: identifiers and paths normalized or removed before export.

The Core must provide a redaction boundary before receipts or MCP responses are
written outside the local process. Examples and tests use only `public`
provenance.

## Maturity gates

### Core MVP

- Synthetic snapshot input works offline.
- Index is disposable and reproducible.
- Three read-only operations have stable schemas.
- Tests cover ranking, fusion, provenance, conflict, temporal drift, and gaps.
- No private Theseus data is required.

### Integration profile

- AutoMem snapshot adapter is opt-in.
- Docker packaging is reproducible.
- HTTP and stdio transports pass equivalent contract tests.
- Credentials are supplied only through runtime environment/configuration.
- Theseus-specific authority rules remain outside Core.
- HTTP defaults to localhost-only; non-localhost binding requires an explicit
  deployment configuration and documented authentication boundary.
- Snapshot size, query size, and response size limits are explicit.

### Agent operations profile

- Codex/Desktop integration is documented separately.
- Runtime verification is explicitly distinguished from memory retrieval.
- GTD and memory checkpoint workflows are documented as integrations.
- Failure modes and stop conditions are observable.

### Community-ready review

- Repository boundary audit is complete.
- Secret and private-artifact scan passes.
- Documentation explains the authority and provenance model plainly.
- Synthetic examples work on a clean machine.
- License, contribution policy, and support expectations are decided.
- Maintainer review explicitly approves public release.

## Extraction rules

- Copy behavior through tests first; do not copy the whole working directory.
- Use synthetic fixtures for all Core tests.
- Rename `Theseus Local Sonar` to a neutral server identity in Core.
- Keep local WSL/Docker launchers in the Theseus project until a separate
  integration package is justified.
- Never stage `artifacts/`, `output/`, `backups/`, DuckDB files, snapshots, or
  environment files.
- Treat the current `http` launcher branch and its allow-list mismatch as a
  follow-up defect before extracting the transport launcher.

## Executable Core acceptance slice

Before extracting the full current implementation, the private repository must
pass this smallest end-to-end scenario on synthetic data:

```text
synthetic snapshot
-> offline refresh
-> deterministic preflight
-> expected JSON evidence packet
-> MCP contract test
```

The repository must provide a direct, documented command equivalent to:

```text
python -m sonar snapshot examples/snapshot.json preflight \
  --query "runtime verification"
```

The exact CLI spelling may change during implementation, but the user-facing
path must remain this simple. A clean-machine smoke test must not require
AutoMem, MemPalace, Basic Memory, GTD, Docker Desktop, WSL, or Codex.

## Refresh and stale-index semantics

`sonar_refresh` may update only the local rebuildable index and generated
receipts. It must not mutate the source memory system. The output must state
whether the index was refreshed, reused, empty, or stale.

When the index is stale or absent, the server must choose one explicit policy:

- return a structured gap and stop;
- perform an explicitly requested refresh;
- or use a documented bounded stale read.

It must not silently present stale data as current.

## Review status

The initial design direction passed a metacognitive adversarial review using
the project's Jester/Shut, Kargat, Lad, architecture, security, and community
maintainer perspectives. The review accepted the direction but required the
acceptance slice, neutral authority model, score semantics, provenance privacy,
and transport defaults recorded above before implementation planning.

## Decision

Proceed with a private `theseus-sonar` incubation repository, beginning with a
design and boundary review. Keep the Core community-neutral even though the
private repository preserves Theseus/Sonar lineage. Repository creation, code
extraction, remote publication, and public release remain separate approvals.
