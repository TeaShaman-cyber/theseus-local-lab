# Drive Corpus Scout

Build a lightweight local index of the synced Google Drive folder and rank files
for later lens, Graphify, or manual reading passes.

This tool intentionally indexes metadata first: path, filename, extension, size,
mtime, and optional `.gdoc` pointers. It does not read full document bodies.

## Run

```text
node tools/drive_corpus_scout/drive_corpus_scout.mjs --root "C:\Users\s.poklad\Мой диск" --profile memory-research --write
```

Useful profiles:

```text
node tools/drive_corpus_scout/drive_corpus_scout.mjs --profile memory-research --write
node tools/drive_corpus_scout/drive_corpus_scout.mjs --profile deepseek-architecture --write
node tools/drive_corpus_scout/drive_corpus_scout.mjs --profile loci-analog --write
node tools/drive_corpus_scout/drive_corpus_scout.mjs --profile tid-theory --write
node tools/drive_corpus_scout/drive_corpus_scout.mjs --profile deepseek-export-archive --write
```

Outputs are ignored by Git:

```text
outputs/drive_corpus_scout/
```

## Why

Drive is noisy. The scout creates a small navigation layer before any expensive
read, OCR, Graphify, or connector export step. It is the Drive analogue of the
Strazh index/lens workflow: find promising corpus slices first, then inspect
only the selected files.

TID is a distributed corpus, not one file. The `tid-theory` profile should find
root Drive research docs, PDFs, and the DeepSeek official export archive. Later
steps can ingest selected items into AutoMem as durable concepts and into
MemPalace as episodic/verbatim traces.
