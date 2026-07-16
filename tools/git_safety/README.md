# Git Safety

Small pre-commit helpers for Theseus repositories.

## Helpers

- `normalize_staged_text.mjs` removes extra blank lines at the end of staged
  text files and re-stages only those files.
- `scan_staged.mjs` blocks obvious secrets and secret-like filenames in staged
  changes.

The pre-commit hook runs normalization before the secret scan so recurring
`git diff --check` EOF warnings are fixed before commit review.
