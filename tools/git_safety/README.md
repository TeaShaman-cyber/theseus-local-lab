# Git Safety

Small pre-commit helpers for Theseus repositories.

## Helpers

- `normalize_staged_text.mjs` removes extra blank lines at the end of staged
  text files and re-stages only those files.
- `scan_staged.mjs` blocks obvious secrets and secret-like filenames in staged
  changes.
- `validate_commit_provenance.mjs` checks the agent provenance trailer set in a
  commit message when any provenance trailer is present.

The pre-commit hook runs normalization before the secret scan so recurring
`git diff --check` EOF warnings are fixed before commit review.

The commit-msg hook is deliberately soft for human commits and strict for
partially declared agent provenance. It does not inspect or infer secrets,
identity, or model state.
