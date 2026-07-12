# Git Meta-Skill

Purpose: keep Git, GitHub, advisor, and secret-handling workflows boring,
repeatable, and hard to misuse in the Theseus local lab.

This file is the repo-level override for ordinary Git publishing in this
private lab. It does not replace Codex system rules or GitHub plugin skills; it
routes them.

Codex skill draft/source: `skills/theseus-git-hygiene/SKILL.md`.

## Priority Stack

1. User intent and Codex system safety rules.
2. Repository safety gates: `.githooks/pre-commit`,
   `tools/git_safety/scan_staged.mjs`, and relevant tests.
3. Local-agent-hygiene interrupt: prefer VS Code tasks, MCP/native routes, and
   small wrappers before raw Windows shell.
4. GitHub plugin skills:
   - `github` for repository, issue, PR, and triage context.
   - `yeet` for branch/PR publish workflows.
5. Theseus private-lab convention: direct push to private `main` is allowed
   only when the user explicitly asks to sync or push this repo.
6. General model/git habits are last. They must not override the layers above.

## Advisor Calls

Advisor calls are part of the workflow, not an excuse to drop into raw shell.

Before asking Copilot, Bothub, CodeWhale, or another advisor:

1. Check for an existing VS Code task or repo wrapper.
2. Use the task/wrapper as the canonical route.
3. Use raw shell only after stating why the task/wrapper is unavailable or
   inadequate for this specific turn.
4. Send only explicit, non-secret prompts. Never attach `.env`, raw memory,
   backups, private transcripts, or keychain exports.

Canonical advisor routes:

- Copilot: VS Code task `Theseus: ask Copilot advisor`.
- Bothub council: VS Code task `Theseus: ask Bothub council advisor`.
- CodeWhale: `node tools/codewhale_infisical/run.mjs --provider BOTHUB ...`.

Observed fragility:

- PowerShell array binding can turn model lists into one string or positional
  arguments. Prefer wrappers/tasks that hide those details.
- Windows shell globs such as `*.md` can fail in contexts where Unix habits
  would work. Prefer `rg --glob` or explicit files.

## Publish Flow

For normal private-lab sync to `origin/main`:

1. `git status -sb`
2. Inspect the diff and confirm the scope is coherent.
3. Stage explicit paths, not `git add -A`, unless the whole worktree is known to
   be in scope.
4. Run `node tools/git_safety/scan_staged.mjs`.
5. Run relevant syntax/smoke checks:
   - provider or keychain changes: Infisical smoke.
   - PowerShell changes: PS parser check.
   - Node changes: `node --check`.
   - VS Code task changes: JSON parse.
6. Commit intentionally.
7. Push only after the user asks to sync/push, or after the current turn clearly
   includes that publish request.

For branch/PR work, route to the GitHub plugin publish flow instead of direct
main push.

## Hard Stops

Stop and explain before continuing when:

- `git status -sb` shows unrelated or unclear changes.
- `.env`, `.env.local`, private key files, backups, raw memory, or raw
  transcripts appear in staged files.
- The hook is disabled or `core.hooksPath` is not `.githooks`.
- A command needs `--no-verify`, `git reset --hard`, or checkout/revert of files
  the agent did not create.
- Infisical is expected but unavailable, and the next step would encourage
  recreating secrets in tracked files.
- Advisor output recommends bypassing repository safety gates.

## Secret Policy

Infisical is the source of truth for provider keys and local service
credentials. `.env.local` is not a normal workflow artifact; it is only an
ignored emergency fallback.

The pre-commit scanner is a guardrail, not proof of safety. It catches common
patterns and dangerous filenames, but it does not replace scope review.

## Failure Recovery

- If the scanner blocks a commit, remove the secret from staged files and move
  it to Infisical or an ignored local file.
- If Infisical is down, do not create tracked substitute secrets. Use a
  non-secret task, restore the keychain, or ask the user whether to pause.
- If advisor routes fail, record the failure and fall back to local reasoning
  before trying raw shell.
