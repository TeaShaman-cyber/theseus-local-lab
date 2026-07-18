# Chat Corpus Lens

Build a compact navigation lens from a large exported chat JSON, then generate a
small Graphify concept graph from the selected concepts and messages.

This is for private local corpora such as the Strazh export. It never commits
raw chat data or generated lens outputs.

## Run

```text
node tools/chat_corpus_lens/run_strazh_trial.mjs
```

Outputs are ignored by Git:

```text
outputs/chat_corpus_lens/
<Graphify pilot root>/chat-corpus/
```

## Current Strazh Trial

Observed on 2026-07-15:

- raw chat messages: 1155
- estimated raw tokens: 477044
- estimated lens tokens: 4620
- source-to-lens ratio: 103.26
- Graphify concept graph: 44 nodes, 91 edges

This is a navigation and triage measurement, not a semantic completeness proof.
The lens selects high-signal messages and concepts so the agent can decide where
to read next.

## WSL Note

Use a WSL-native venv for Graphify:

```text
/home/poklad/.cache/theseus/venvs/graphify
```

Do not build heavy Python venvs under `/mnt/c` unless there is a specific reason.
The Graphify install repeatedly stalled there during wheel installation.
