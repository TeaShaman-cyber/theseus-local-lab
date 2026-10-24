# Git Meta-Skill

Purpose: keep Git, GitHub, advisor, and secret-handling workflows boring,
repeatable, and hard to misuse in the Theseus local lab.

This file is the repo-level override for ordinary Git publishing in this
private lab. It does not replace Codex system rules or GitHub plugin skills; it
routes them.

Codex skill draft/source: `skills-codex/theseus-git-hygiene/SKILL.md`.

## Priority Stack

1. User intent and Codex system safety rules.
2. Repository safety gates: `.githooks/pre-commit`,
   `tools/git_safety/scan_staged.mjs`, and relevant tests.
3. Local-agent-hygiene interrupt: prefer VS Code tasks, MCP/native routes, and
   small wrappers before raw Windows shell.
4. GitHub plugin skills:
   - `github` for repository, issue, PR, and triage context.
   - `yeet` for branch/PR publish workflows.
5. Theseus private-lab convention: classify each Git action by downstream
   effect. A local checkpoint commit is not publication; a known bounded
   backup/sync push may be part of an approved workflow after CI/CD and other
   external effects are checked. Unknown or high-impact push effects require
   explicit user approval; merge, release, deploy, force-push, and history
   rewrite remain separate gates.
6. General model/git habits are last. They must not override the layers above.

## Advisor Calls

Advisor calls are part of the workflow, not an excuse to drop into raw shell.

Council routes are never implicit. Complexity, architecture, security, or a
request for a second opinion does not authorize model fan-out. Bothub/model
council use requires explicit user opt-in, a bounded packet, and its capability
contract; otherwise use one advisor or local evidence.

Before asking an external advisor:

1. Check for an existing VS Code task or repo wrapper.
2. Use the task/wrapper as the canonical route.
3. Use raw shell only after stating why the task/wrapper is unavailable or
   inadequate for this specific turn.
4. Send only explicit, non-secret prompts. Never attach `.env`, raw memory,
   backups, private transcripts, or keychain exports.

Canonical advisor routes:

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
7. Inspect remote workflows and downstream effects before pushing. Push as part
   of an approved bounded backup/sync workflow when the effect is known; ask
   before unknown, high-impact, destructive, or out-of-scope pushes. Merge,
   release, deploy, force-push, and history rewrite require their own explicit
   gate.

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
