# Git Meta-Skill

Purpose: keep Git, GitHub, and secret-handling workflows boring, repeatable,
and hard to misuse in the Theseus local lab.

The canonical policy is [`docs/reference/git.md`](docs/reference/git.md) and its
machine-checkable rules. This file is only a short entry point.

## Route

1. Follow user intent and the current `AGENTS.md`.
2. Read `docs/reference/git.md` for authority and publication gates.
3. Use native `git` and `gh`.
4. Stage explicit paths and run `node tools/git_safety/scan_staged.mjs`.
5. Run relevant tests, commit one coherent result, then verify the remote effect.

## Hard Stops

Stop and explain when unrelated changes, secrets, disabled hooks, destructive
history operations, or an unknown downstream deployment effect enter scope.
Never use `--no-verify`, force-push, or history rewrite without explicit
permission.

## Secret Boundary

Do not stage `.env`, private keys, backups, raw memory, transcripts, or account
exports. The scanner is a guardrail, not proof of safety.
