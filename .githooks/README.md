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
