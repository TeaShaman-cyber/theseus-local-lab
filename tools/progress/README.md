# Theseus Progress And Heartbeat Rule

Long-running project routes should not leave the agent or user waiting blind.

Use `tools/progress/progress.mjs` when a wrapper may take more than a few seconds:

- downloads;
- archive extraction or compression;
- Docker image save/load/build/pull;
- VM transfer over SSH/SCP;
- backup and mirror jobs;
- large scans or indexing passes;
- advisor/conclave calls that can stall behind a provider.

Rules:

- write machine-readable progress events to `stderr` as JSONL;
- keep `stdout` clean for the wrapper's final JSON/result;
- include an operation name, phase, timestamp, and useful counters;
- write a durable manifest when the operation creates an artifact;
- add a VS Code task for repeated checks.

This is attention hygiene: progress events reduce blind waiting, make logs easier
to parse, and help avoid burning tokens on status guesses.
