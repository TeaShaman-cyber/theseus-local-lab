# Tool project index

Every tracked subdirectory of `tools/`. Status: **active** (work in the last
~2 weeks or referenced by AGENTS.md/hooks), **frozen** (kept for reference,
no current work), **unknown** (needs owner review). Safety: ⚠ = runs
external/side-effectful operations; read the README before executing.

Load-bearing paths (referenced by AGENTS.md or .githooks — never move without
a same-commit AGENTS.md/hook edit): `tools/git_safety/`, `tools/tool_policy/`,
`tools/session_timeline/`, `tools/harness_errors/`, `tools/memory_hook/`.

| Project | Files | Status | What it is |
|---|---|---|---|
| git_safety | 5 | active | ⚠ pre-commit secret scan + provenance validation (hook-wired) |
| github_issue_cards | 25 | active | issue draft/review/publish pipeline (cards + receipts) |
| skill_router | 12 | active | skill routing contracts and graph |
| session_timeline | 4 | active | session chronology extraction |
| tool_policy | 4 | active | tool policy checks |
| memory_hook | 4 | active | memory hook plumbing |
| memory_gate | 4 | active | memory write gate |
| workshop_recovery | 5 | active | docker recovery contracts |
| github_issue_watch | 3 | active | issue watch helpers |
| github_machine_identity | 3 | active | machine identity for gh operations |
| workshop_dashboard | 11 | active | local dashboard |
| docker_control_plane | 7 | active | docker control helpers ⚠ |
| nous_route_diagnostic | 5 | active | redaction-safe Nous `/chat/completions` route probes ⚠ |
| memory_outbox | 11 | active | memory outbox pattern |
| graphify_harness | 10 | frozen | graphify pilot harness |
| unix_runtime | 24 | frozen | unix runtime experiments (incl. infisical_cli: untracked node_modules, do NOT commit) |
| sonar_local | 15 | frozen | local sonar tooling |
| sysinternals_scout | 6 | frozen | sysinternals wrappers ⚠ |
| drive_corpus_scout | 5 | frozen | drive corpus extraction |
| chat_corpus_lens | 4 | frozen | chat corpus analysis |
| source_lens | 4 | frozen | source analysis lens |
| ocr_lens | 5 | frozen | OCR helpers |
| codex_windows_map | 4 | frozen | codex windows mapping |
| wsl_ide | 4 | frozen | WSL IDE experiments |
| image_transfer | 6 | frozen | image transfer helpers |
| gtd | 6 | frozen | gtd tooling (root `gtd/` Docker stack is separate) |
| secrets_lab | 5 | frozen | secrets lab (root `secrets-lab/` is the sibling copy) |
| backup_lattice | 2 | frozen | backup lattice tooling (root `backup-lattice/` is the compose stack) |
| codewhale_infisical | 1 | frozen | codewhale infisical helper |
| infisical_cli | 2 | frozen | CLI docs only (node_modules untracked) |
| _прочие (1-2 файла) | ~20 | unknown | needs owner review: see `git ls-files tools/` |

Rule: new tool projects must add their row here in the same commit that
creates the directory (per theseus-local-lab#1).
