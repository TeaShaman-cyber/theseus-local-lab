# Session Journal

Purpose: create a compact, observable lab-journal snapshot for the current
Codex/agent session.

This does not export hidden model reasoning. It records reproducible artifacts:

- timestamp and workspace path
- human/agent note
- git status and recent commits
- recent state packets
- recent memory inbox files

Use it before long context compaction, after major setup work, or before a risky
environment change.

## VS Code

Run:

```text
Theseus: write session journal
```

## Terminal

```powershell
node tools/session_journal/session_journal.mjs --note "Verified native Docker bridge and AgentOps/GitOps contract."
```

Journal files are written to:

```text
outputs/session_journal/
```
