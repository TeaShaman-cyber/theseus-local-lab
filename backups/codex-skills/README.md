# Codex skills backup

This directory is a versioned backup of the active global Codex skills used by
the Theseus local lab. It is part of the one monolithic repository and is
included in the GitHub `main` history when explicitly staged.

This directory is not a second project runtime and is not loaded by the
router automatically. The active runtime source remains:

```text
C:\Users\s.poklad\.codex\skills
```

## Backup scope

Each backup is a sanitized text skill definition copied from the corresponding
global skill directory:

```text
backups/codex-skills/global/<skill-name>/SKILL.md
```

Backed-up skills:

- `execution-guard`
- `imported-memory-gate`
- `research-routing`
- `local-agent-hygiene`
- `theseus-memory-stack`
- `theseus-shell-routing`
- `theseus-skill-router`
- `theseus-git-hygiene`

No secrets, provider configuration, `.env` files, runtime databases, raw
transcripts, or memory dumps belong in this directory.

## Sync rule

Skill backup changes are explicit repository changes. Before a private `main`
sync:

1. inspect the backup diff;
2. stage explicit backup paths;
3. run `node tools/git_safety/scan_staged.mjs`;
4. commit and push only when the user asks for the repository sync.

Do not add a hidden push hook or background copier. The backup must remain
visible, reviewable, and attributable.
