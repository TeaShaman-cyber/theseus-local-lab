# Junior Agent Context Protocol

This protocol teaches junior agents to retrieve context without depending only
on the main Codex summary.

The goal is not to ingest everything. The goal is to form a small, checkable
map before proposing or executing a task.

## Order Of Recall

1. MemPalace for a broad map of loci, themes, and safe seed corpus pointers.
2. AutoMem for durable decisions, lessons, patterns, and user preferences.
3. Repository docs and source files for concrete implementation details.
4. Main Codex summary only as one viewpoint, not as the only source.

## MemPalace Rules

- Use MemPalace read-mostly during the pilot.
- Prefer `search` over `mine`.
- Do not ingest `.env`, private keys, raw AutoMem dumps, backup archives, or raw
  private transcripts.
- Treat results as pointers and hypotheses, not final proof.
- If MemPalace conflicts with AutoMem, report the conflict and prefer AutoMem
  until reviewed.

Useful starter queries:

- `junior agent Sol mentoring checkpoint executor`
- `Windows Docker VS Code WSL friction`
- `MemPalace AutoMem secondary memory palace`
- `image transfer manifest schema verify-only`
- `Stanford learning loop local weights skills AutoMem`

## AutoMem Rules

- Use read-only recall first.
- Do not store, update, associate, or delete memories unless explicitly asked.
- Use small ranked queries with clear tags and limits.
- Report memory IDs for important claims.
- Separate recalled facts from your own inference.

Suggested query shape:

```json
{
  "query": "junior agent mentoring checkpoint executor image transfer",
  "tags": ["theseus-local-lab"],
  "limit": 5,
  "format": "items"
}
```

## Self-Observation Block

Every non-trivial junior-agent report should include a short `Self-observation`
block:

- What I wanted to do next.
- What I deliberately did not do.
- Which boundary or invariant stopped me.
- What durable lesson this suggests for skills, AutoMem, MemPalace, or tests.

These notes are training data for the local learning loop. They are not
confessions or decoration; they are observable behavioral metadata.

## Output Shape

Keep reports compact:

1. Context pulled: MemPalace hits, AutoMem memories, repo docs.
2. Independent view: what the junior agent sees differently from main Codex.
3. Proposed next tiny step.
4. Boundaries not crossed.
5. Self-observation.
