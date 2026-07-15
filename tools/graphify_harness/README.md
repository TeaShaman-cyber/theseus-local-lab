# Graphify Harness Lens

Repeatable Graphify pilot for Theseus local lab.

This wrapper keeps Graphify as a structural repo lens without installing
Graphify agent hooks or editing `AGENTS.md`.

## Run

```text
node tools/graphify_harness/graphify_harness.mjs
```

Outputs:

- generated corpus and graph:
  `C:\Users\s.poklad\Documents\Codex\2026-07-08\graphify-theseus-pilot`
- compact ignored summaries:
  `outputs/graphify_harness/*.md`
  `outputs/graphify_harness/*.json`

## Guardrails

- Does not run `graphify install`.
- Does not modify `AGENTS.md`, hooks, or Git config.
- Runs `graphify extract --code-only`.
- Uses Codex bundled Python 3.12 when available.
- Writes JSONL progress events to stderr.
