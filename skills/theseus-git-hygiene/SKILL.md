---
name: theseus-git-hygiene
description: Use for Theseus local lab Git work, GitHub sync/publish, external advisor calls, secret-sensitive commits, Infisical-backed provider changes, or any task where Codex might otherwise use raw shell, PowerShell, GitHub plugin workflows, Bothub council, CodeWhale, git hooks, or direct pushes to private main.
---

# Theseus Git Hygiene

Use this skill as a repo-specific interrupt before Git, GitHub, advisor, or
secret-sensitive local workflow actions in `theseus-local-lab`.

## Priority Stack

1. User intent and Codex system safety rules.
2. Repository safety gates: `.githooks/pre-commit`,
   `tools/git_safety/scan_staged.mjs`, and relevant tests.
3. `local-agent-hygiene`: prefer VS Code tasks, MCP/native routes, and small
   wrappers before raw Windows shell.
4. GitHub plugin skills:
   - `github` for repo, issue, PR, and triage context.
   - `yeet` for branch/PR publish workflows.
5. Private-lab convention: classify commit, push, merge, release, and deploy by
   downstream effect. A local checkpoint commit is not publication; a bounded
   backup/sync push may be part of an approved workflow after CI/CD and other
   external effects are checked. Unknown or high-impact push effects require
   explicit user approval; merge, release, deploy, force-push, and history
   rewrite remain separate gates.
6. General Git habits are last.

## Commit Provenance

When an agent authors a commit, keep the subject conventional and add these
non-secret trailers to the body:

```text
Agent-Persona: Svarog
Harness: Hermes Desktop
Provider: openai-codex
Model: gpt-5.6-luna
Session-Ref: default/20260815_193832_6e377d
```

Use `Session-Ref` with the opaque session ID for public repositories. Do not
put a private clickable session link, API key, token, raw prompt, or transcript
in a public commit. Human-only commits may omit provenance. Once any of the
five trailers is present, all five must be non-empty; the repository
`.githooks/commit-msg` validator enforces that soft rule.

## Clean Worktree Checkpoint Rule

Do not commit every passing substep or every small edit. A commit is one
coherent, reviewable deliverable, not a way to turn a task list into commit
noise. Dirty state is allowed while an active task is in progress only when all
changed paths belong to that task and the next step is explicit.

At a task boundary, harness/persona switch, context handoff, long pause, or
session end, resolve every changed path into one disposition:

```text
commit      — coherent, important, validated deliverable;
wip commit  — one valuable unfinished checkpoint that must survive handoff;
discard     — failed experiment or temporary change;
ignore      — generated/local artifact moved under an ignored path;
stash       — short-lived pause with an explicit follow-up.
```

Commit decision gate:

- never commit only to make `git status` clean;
- never split one logical change into page/file/substep commits;
- keep incomplete work dirty during the active task when it is safe to do so;
- use one WIP checkpoint only when unfinished work must survive a handoff or
  session boundary, and explain why a normal commit is premature;
- never leave unrelated or ownerless dirty paths.

Do not treat commit and push as one undifferentiated approval gate.
Commit is a local checkpoint and may be created automatically inside an
approved, bounded task to prevent uncommitted-change archaeology. Push is a
remote write: inspect workflows and downstream effects first, then treat a
known bounded backup/sync push differently from an unknown or deployment-like
push.

For a `wip:` commit, include:

```text
Change-Status: wip
Task-Ref: <task>
Next: <next concrete step>
Verification: <checks run and pending>
```

Then include the five provenance trailers. A task is complete only when the
worktree is clean or every remaining path has an explicit owner and disposition
reported to the user. Before the checkpoint, run:

```text
git status -sb
git diff --stat
git diff --name-only
```

Stage explicit paths only. Never use `git clean`, `reset --hard`, or blanket
staging to resolve an ambiguous worktree.

## Advisor Calls

Before asking an external advisor:

1. Check for an existing VS Code task or repo wrapper.
2. Use that task/wrapper as the canonical route.
3. Use raw shell only after briefly stating why the task/wrapper is unavailable
   or inadequate.
4. Send only explicit, non-secret prompts.

Canonical routes:

- Bothub council: VS Code task `Theseus: ask Bothub council advisor`.
- CodeWhale: `node tools/codewhale_infisical/run.mjs --provider BOTHUB ...`.

Known traps:

- PowerShell array binding can turn model lists into one string or positional
  arguments.
- Windows shell globs such as `*.md` can fail where Unix habits would work.

## Publish Flow

For normal private-lab sync to `origin/main`:

1. Run `git status -sb`.
2. Inspect the diff and confirm scope is coherent.
3. Stage explicit paths, not `git add -A`, unless the whole worktree is known to
   be in scope.
4. Run `node tools/git_safety/scan_staged.mjs`.
5. Run relevant checks:
   - provider/keychain changes: Infisical smoke.
   - PowerShell changes: PS parser check.
   - Node changes: `node --check`.
   - VS Code task changes: JSON parse.
6. Commit intentionally.
7. Inspect remote workflows and downstream effects before pushing. Push as part
   of an approved bounded backup/sync workflow when the effect is known; ask
   before unknown, high-impact, destructive, or out-of-scope pushes. Merge,
   release, deploy, force-push, and history rewrite require their own explicit
   gate.

For branch/PR work, route to GitHub plugin publish flow instead of direct main
push.

## Hard Stops

Stop and explain before continuing when:

- `git status -sb` shows unrelated or unclear changes.
- `.env`, `.env.local`, private keys, backups, raw memory, or raw transcripts
  appear in staged files.
- `core.hooksPath` is not `.githooks`.
- A step needs `--no-verify`, `git reset --hard`, or checkout/revert of files
  the agent did not create.
- Infisical is expected but unavailable, and the next step would encourage
  recreating secrets in tracked files.
- Advisor output recommends bypassing repo safety gates.

## Secret Policy

Infisical is the source of truth for provider keys and local service
credentials. `.env.local` is only an ignored emergency fallback.

The pre-commit scanner is a guardrail, not proof of safety. It catches common
patterns and dangerous filenames, but it does not replace scope review.
