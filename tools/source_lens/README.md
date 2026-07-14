# Source Lens

General context lens for search results, web-page exports, GitHub issue lists,
and other text or JSON source streams.

It extends the OCR Lens invariant:

```text
raw source stream
  -> compact semantic map
  -> ranked reading route
  -> selective deep read only where needed
```

DeepSeek-OCR-2 adds a useful lesson for this layer: do not preserve raw arrival
order blindly. Reorder by semantic priority before spending more context.

## Commands

```text
node tools/source_lens/source_lens.mjs "outputs/github_issue_watch/openai-codex.json" --write
node tools/source_lens/source_lens.mjs "search-results.jsonl" --query "codex usage limits" --write --memory-draft
node tools/source_lens/source_lens.mjs "page.md" --write --json
```

Outputs are ignored by Git:

```text
outputs/source_lens/latest.md
outputs/source_lens/latest.json
outputs/source_lens/<source>-<hash>.lens.md
outputs/source_lens/<source>-<hash>.lens.json
```

With `--memory-draft`, the tool also writes an AutoMem-compatible candidate to:

```text
outputs/memory_inbox/<source>-<hash>.source-lens.memory.json
```

That draft is deliberately not stored automatically. It is a reviewable bridge
from source compression into durable memory, so noisy search output does not
become long-term memory by accident.

## Input Shapes

- `.json` / `.jsonl`: best-effort extraction from nested objects with fields
  such as `title`, `url`, `snippet`, `summary`, `body`, `created_at`, and
  `updated_at`.
- `.md` / `.txt`: headings, links, and claim-like sentences.

## Statuses

- `lens_ready`: at least one useful source, claim, or heading was found.
- `thin_signal`: input was readable but did not contain enough structure for a
  ranked route.
