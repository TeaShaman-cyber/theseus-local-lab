---
name: theseus-pr-gate-cycle
description: Use when delivering a change through the Theseus PR cycle. Issue first, own worktree, local gate, CI, subagent review, then merge.
---

# Theseus PR Gate Cycle

One change, one PR, one receipt. The cycle exists so delivery does not depend on
an agent remembering a rule.

## Cycle

| Step | Command | Postcondition to observe |
|---|---|---|
| 1. Issue | `gh issue create --body-file <file>` | Issue number exists; body carries facts, plan, acceptance criteria |
| 2. Worktree | `git worktree add ../wt-<name> -b <branch> origin/main` | `check_race.py` passes (rc=0) in that tree |
| 3. Change | `patch` / `write_file` | `git diff --stat` touches only the intended files |
| 4. Local gate | `bash tools/dev/check` | `DEV_CHECK_PASS`, exit 0 |
| 5. Push + PR | `git push -u origin <branch>`, `gh pr create` | PR URL; branch protected by required check |
| 6. CI | `gh pr checks <n> --watch` | `Repository-owned QA gate` = pass |
| 7. Subagent review | `delegate_task` on the diff | `[BLOCKER]`/`[SHOULD]`/`[NIT]` list + APPROVE/REQUEST_CHANGES |
| 8. Merge | `gh pr merge <n> --squash` | `git log -1 origin/main` shows the squashed commit |
| 9. Close + tidy | `gh issue close`, delete branch, update worktree | Issue closed; `git ls-remote --heads origin` has no stale branch |

Never merge on a `[BLOCKER]`. A green CI is not a review: the hook does not run
in CI, so hook-level defects are invisible to it.

## Failure modes this cycle caught

Each line is a real defect found by one of the layers, not a hypothetical.

| Symptom | Layer that caught it | Fix shape |
|---|---|---|
| Tests green on Windows, red on Linux runner | CI (`unit`) | `path.join` for paths; `skip` with a stated reason for platform-bound suites |
| `-f` passes on a zero-byte endpoint, so "gate green, no gate" | Subagent review | `-s` check + `QA_ENDPOINT_EMPTY` exit 2 |
| Receipt written under `set -e`, so a failed append reddens a green gate | Subagent review | Decouple the witness write from the verdict (`set -u` only) |
| Receipt invisible from CLI (`>>` writes summary only) | Own verification | `tee -a` so it reaches the step log |
| Gate requires a session id in a worktree, where no race is possible | Subagent review | Derive identity from the git dir path in a worktree; require it only in the shared checkout |
| Cheap check placed after a mutating step, leaving dirty staging on block | Subagent review | Side-effect-free check first, mutating steps after |
| `python` missing on Linux (only `python3`) → 127 blocks every commit | Subagent review | `command -v python3 \|\| command -v python`, named failure otherwise |

## Anti-patterns

- **`gh pr merge --delete-branch`** fails when `main` is checked out in another
  worktree. Merge succeeds, branch remains. Delete the branch separately.
- **Receipt without a negative control.** A PASS that cannot say what it
  excluded proves nothing. Carry the window, the exclusions, and the liveness
  signal beside the result.
- **No data treated as zero.** An empty result is UNKNOWN: it is what success
  looks like and also what a dead exporter looks like.
- **Verifying by the tool's own return.** A successful call is not a
  postcondition; read the target back (`gh api`, `gh run view --log`, `git log`).
- **Judging a task's state from its title.** Read the issue's own comment
  history and the artifacts on disk before calling work pending or blocked —
  the work is often already done and recorded there. A title states the
  question; only the history states the answer.
- **Asking per step.** Routine git work in own repos needs no approval. Ask only
  on scope expansion: protected-branch merge, release, deploy, force-push,
  third-party writes.

## Worktree discipline

Two chats in one checkout race: a branch switch under a running agent sends the
commit to the wrong branch. `tools/git_safety/check_race.py` blocks the shared
checkout and passes in a private worktree. It runs from `.githooks/pre-commit`,
first, before anything that mutates the index.

`git worktree list` shows which tree belongs to whom. The shared checkout stays
on `main`; every session works in its own tree.
