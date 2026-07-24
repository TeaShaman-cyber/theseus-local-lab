# DeepSeek Corpus Normalizer

Streaming adapter for official DeepSeek `conversations.json` exports.

It preserves the conversation mapping graph and fragment ordering while writing
compressed Parquet tables suitable for DuckDB, Arrow, and downstream corpus
lenses. Raw private exports are never committed.

## Output

- `conversations.parquet`
- `messages.parquet`
- `edges.parquet`
- `fragments.parquet`
- `manifest.json` with source/artifact SHA256 hashes and row counts

## Run

```bash
python3 tools/deepseek_corpus_normalizer/normalize.py \
  --input /path/to/conversations.json \
  --output /path/to/normalized
```

Dependencies: Python 3.11+, `ijson`, `pyarrow`.

## Integrity boundary

The normalizer is structural, not interpretive. It preserves branches, model
identifiers, timestamps, fragment types, fragment order, and fragment content.
Scientific claims are downstream artifacts and require separate verification.
