# Git Hooks

Local hooks for keeping the Theseus lab repository from committing secrets.

Enable once per clone:

```powershell
git config core.hooksPath .githooks
```

The pre-commit hook runs:

```powershell
node tools/git_safety/scan_staged.mjs
```

It checks staged diffs for obvious tokens, private key blocks, non-placeholder
secret assignments, and blocked filenames such as `.env.local`.

The commit-msg hook validates provenance when a commit starts using any of the
agent trailers below:

```text
Agent-Persona: Svarog
Harness: Hermes Desktop
Provider: openai-codex
Model: gpt-5.6-luna
Session-Ref: default/20260815_193832_6e377d
```

Human commits without these trailers remain valid. Once one provenance trailer
is present, all five must be non-empty. This is intentionally a soft gate: the
repository cannot reliably infer whether a human or agent authored a commit.
