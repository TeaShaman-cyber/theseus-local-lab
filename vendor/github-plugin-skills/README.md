# GitHub Plugin Skills Local Copy

Copied from:

`C:\Users\s.poklad\.codex\plugins\cache\openai-curated-remote\github\0.1.8-2841cf9749ae\skills`

Date copied: 2026-07-12

Purpose:

- Keep a local, passive reference copy of the GitHub plugin skills.
- Distill useful Git/GitHub workflow patterns into local Theseus skills.
- Avoid relying on the connected GitHub plugin when local `git`, `gh`, VS Code, hooks, and repo wrappers are enough.

Important:

- This directory is a reference archive, not an active Codex skill location.
- Do not copy secrets, tokens, `.env` files, raw backups, or private transcripts here.
- Before using any workflow from these skills, adapt plugin-specific instructions such as "use the GitHub app from this plugin" to local Theseus routes:
  - VS Code Git/GitHub tasks or UI
  - local `git`
  - authenticated `gh`
  - repo safety hooks
  - approved external advisor prompts when explicitly needed
  - GitHub connector only when explicitly needed

Copied skill folders:

- `github`: umbrella GitHub triage and routing.
- `yeet`: branch, commit, push, and draft PR workflow.
- `gh-fix-ci`: GitHub Actions failure inspection and fix workflow.
- `gh-address-comments`: PR review-thread handling workflow.
