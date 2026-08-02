---
name: research-routing
description: Use when a task needs external or current research, source discovery, or verification of time-sensitive claims, and choosing among available search/retrieval connectors matters.
---

# Research Routing

Thin process skill for a **minimal sufficient** research route. Not a fixed provider ranking table.

## Invariants

- SEARCH PROVIDER ≠ FETCH / CONTENT RETRIEVAL ≠ CORROBORATOR ≠ AUTHORITY SOURCE
- connector available ≠ reason to call it
- search result ≠ primary-source evidence
- memory retrieval ≠ external factual verification
- direct sandbox egress ≠ connector-mediated retrieval
- scientific literature tools ≠ general web search
- Do not transfer capabilities across grok.com, Projects, Automations, Grok Build, API, X, or unknown surfaces
- Never invent tool execution or tool results
- Project/runtime governance overrides this skill

## Route

```text
question
→ is external or current research actually needed?
    no  → answer from context; no connector fanout
    yes → continue
→ classify domain (once):
    scientific / academic literature  → scientific route
    product / news / general web     → web route
    mixed                            → scientific for papers; web for secondary context
→ is preflight material for currentness / drift / unknown-unknowns?
    only if yes → run once; discard weak or off-target briefs (not authority)
→ choose ONE primary search route
    OR direct fetch/read if authoritative URL / DOI / PMID / arXiv id is already known
→ prefer authoritative sources; when a secondary cites an original, fetch the original if accessible
→ bounded corroborator only if a material claim remains contested, conflicting, or primary route failed
→ synthesize with FACT / INFERENCE / UNKNOWN (and DEGRADED when tools fail)
→ before strong currentness claims → verification-before-completion
```

## Domain split

| Domain signal | Prefer |
|---------------|--------|
| papers, DOI, PMID, PMCID, arXiv id, citations, MeSH, peer-reviewed claims | scientific route |
| product docs, news, ecosystem survey, non-academic web | web route |
| biophotonics / neuroscience / biomed claims in project science kanban | scientific first; web only for news/context |

## Hard stops

1. No automatic fanout of all connected search tools.
2. No second search provider “for safety” without observed need.
3. Tool/connector failure → report `DEGRADED` or `UNKNOWN`; do not fabricate results.
4. Stale memory may shape the query; it does not satisfy freshness when present validity matters.
5. Applicability is not proof that any connector was called.
6. Scientific claim requires literature or primary paper evidence when available.

## Capability policy

Provider preferences are hints, not permanent rules. Check only the candidate capability needed for the selected route, and re-probe when freshness matters. Do not call every connected provider.
