# Codex Usage Scout

`usage_scout.mjs` is a local observer for Codex token activity and quota
snapshots. It reads only the tail of the newest rollout JSONL file, writes a
normalized snapshot to `outputs/usage_scout/latest.json`, appends changed
observations to a daily JSONL history, and emits a session-timeline event.

It intentionally does not estimate OpenAI's private charging formula. Token
activity and quota consumption remain separate signals. Limit windows are
identified by backend ID, duration, and wire slot; `primary` is never assumed
to mean five hours.

The `Stop` hook refreshes the snapshot after each completed turn. A VS Code task
named `Theseus Usage Scout: snapshot` provides a manual route.
