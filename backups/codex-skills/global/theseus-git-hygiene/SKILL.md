---
name: theseus-git-hygiene
description: Use for Theseus local lab Git work, GitHub sync/publish, advisor calls, secret-sensitive commits, Infisical-backed provider changes, or any task where Codex might otherwise use raw shell, PowerShell, GitHub plugin workflows, Copilot, Bothub council, CodeWhale, git hooks, or direct pushes to private main.
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
5. Private-lab convention: direct push to private `main` only when the user
   explicitly asks to sync or push this repo.
6. General Git habits are last.

## Advisor Calls

Before asking Copilot, Bothub, CodeWhale, or another advisor:

1. Check for an existing VS Code task or repo wrapper.
2. Use that task/wrapper as the canonical route.
3. Use raw shell only after briefly stating why the task/wrapper is unavailable
   or inadequate.
4. Send only explicit, non-secret prompts.

Canonical routes:

- Copilot: VS Code task `Theseus: ask Copilot advisor`.
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
7. Push only after the user asks to sync/push or the current request clearly
   includes publishing.

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
