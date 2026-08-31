# Documentation Inventory and Debt Report — Phase 0 (2026-08-31)

Method: mechanical scan of all 201 tracked Markdown files (git ls-files),
content-hash duplicate detection, Diataxis classification, date-staleness
scan. Read-only; no files were changed during the audit itself.

## Executive summary

The repository carries **201 tracked Markdown documents**. The structure is
healthier than expected, but the map is implicit: an agent cannot discover
the right document without loading most of the repo. Four findings dominate:

1. **The canonical entry points are sound but undated.** All 13 root files
   (`AGENTS.md`, `RESTORE.md`, `TASKS.md`, …) carry no `updated:` metadata,
   so staleness cannot be detected mechanically. This is the single largest
   documentation-infrastructure gap.
2. **Six tools share one placeholder.** `FALLBACK_ONLY.md` is byte-identical
   in six tool directories — a deliberate single-source placeholder living
   as six divergent copies.
3. **`docs/plans/` is a 20-document graveyard of half-applied intents.**
   Several plans are one-time issue-body drafts that should never have been
   tracked as plans.
4. **Skill duplication is structural.** `.agents/skills/*` and
   `backups/codex-skills/global/*` hold byte-identical copies (see
   duplicates below); `AGENTS.md` explicitly declares backups historical —
   so the duplication is governed, not accidental.

## Inventory by location

| Location | Count | Character |
|---|---:|---|
| root | 13 | Canonical entry points (agent guide, workflows, recovery) |
| tools/github_issue_cards | 22 | Workflow artifacts (14 pending / 7 published / 1 draft) |
| docs/plans | 20 | Plans, issue-body drafts, project cards |
| docs/research | 11 | Research notes (explanation) |
| backups/codex-skills | 9 | Historical archive (declared non-source) |
| docs/audits | 7 | Prior audits |
| docs/superpowers | 7 | Specs and plans (design history) |
| vendor/github-plugin-skills | 5 | Vendored external skills |
| .agents/skills | 4 | Live project skills |
| docs/reference | 4 | Registries (workspace, infrastructure) |
| outputs/* | 8 | Generated run artifacts |
| docs/archive | 3 | Historical |
| tools/* READMEs | ~50 | One per tool + placeholders |
| other | ~44 | Misc service docs, .githooks, skills/ |

## Diataxis classification (all 201)

| Class | Count |
|---|---:|
| how-to | 49 |
| plan/audit | 37 |
| explanation/mixed | 28 |
| generated | 20 |
| artifact | 20 |
| explanation | 19 |
| historical | 14 |
| how-to (agent skills) | 11 |
| reference | 3 |

Note: `reference` is nearly empty — the registries are YAML (correctly not
Markdown), and most "reference" knowledge lives in how-to files. The
reference layer is underdeveloped as a reader surface.

## Exact content duplicates (md5)

```text
.agents/skills/theseus-memory-stack/SKILL.md   == backups/codex-skills/global/theseus-memory-stack/SKILL.md
.agents/skills/theseus-shell-routing/SKILL.md  == backups/codex-skills/global/theseus-shell-routing/SKILL.md
.agents/skills/theseus-skill-router/SKILL.md   == backups/codex-skills/global/theseus-skill-router/SKILL.md
tools/{chat_corpus_lens,drive_corpus_scout,graphify_harness,ocr_lens,source_lens,strazh_index}/FALLBACK_ONLY.md  (6 copies)
```

Governance status: the skill copies are declared historical by `AGENTS.md`
("backups/ is historical evidence, not an active skill source") — governed,
acceptable, but worth a README note inside `backups/` so the declaration
lives with the files. The six `FALLBACK_ONLY.md` copies are a single-source
problem: one placeholder stamped six times, doomed to drift.

## Staleness scan (mechanical)

Files carrying **no machine-readable date**: all 13 root files, all 4
`.agents/skills`, `.githooks/README.md`, `.github/copilot-instructions.md`,
plus most tool READMEs. Files dated **older than 2026-08-20** in active
classes: `TASKS.md` (2026-07-15), `VSCODE_SETUP.md` (2026-07-10),
`VMWARE_UBUNTU_LAB.md` (2026-07-11). This does not prove they are wrong —
it proves we cannot tell. A `SCHEMA.md`-style `updated:` frontmatter rule
exists for the knowledge-base repo but not for this repo.

## Root file-by-file status

| File | Lines | Class | Notes |
|---|---:|---|---|
| AGENTS.md | 265 | how-to | Canonical agent guide; sound, needs date + doc-map pointer |
| HOOKS_PIPELINE.md | 200 | mixed | Largest non-guide root file |
| VISUAL_MAP.md | 180 | mixed | Visual overview |
| TASKS.md | 158 | mixed | Kanban mirror; dated 2026-07-15 — verify against live board |
| CODEX_VSCODE.md | 131 | mixed | Codex/VS Code integration |
| RESTORE.md | 120 | how-to | Recovery entry point |
| VSCODE_SETUP.md | 114 | how-to | Dated 2026-07-10 |
| GIT_META_SKILL.md | 110 | agent | Overlaps `skills/theseus-git-hygiene/` (2x same title) |
| AGILE.md | 89 | mixed | Workflow description |
| VMWARE_UBUNTU_LAB.md | 88 | mixed | Dated 2026-07-11 |
| sagtask-entrypoint-bug-draft.md | 82 | artifact | A draft issue living at root — belongs in issue_cards |
| MODEL_LIMITATIONS.md | 68 | mixed | Model watchlist |
| IDEA.md | 2 | — | 14 bytes; empty placeholder |

## Prompt hygiene (agent-facing rules)

`AGENTS.md` concentrates the true invariants (worktree checkpoints,
provenance trailers, route-first, registry gates) and is route-oriented —
matches the plan's acceptance criteria. Overlap with
`skills/theseus-git-hygiene/SKILL.md` is intentional layering (root guide →
skill detail), not contradiction, but the git-hygiene skill repeats the
full priority stack; a cross-reference could replace one duplication block.

## GitHub Wiki suitability (mirror candidates)

Stable, reader-facing, unlikely to churn weekly:

- `RESTORE.md` (recovery runbook)
- `GIT_META_SKILL.md` / git workflow summary
- `AGILE.md` (workflow philosophy)
- `VISUAL_MAP.md` (architecture overview)

Not suitable: registries (YAML), issue cards, plans, research notes
(pre-curation). Wiki remains a publication mirror only; repository stays
canonical (consistent with the cross-project decision of 2026-08-30).

## Proposed minimal rewrite sequence (small commits)

1. Add `docs/reference/doc-map.md` — the missing one-page map (doc →
   diataxis → owner → authority). This is the highest-value single artifact.
2. Stamp `updated:` (and `type:`) frontmatter on the 13 root files; make
   the knowledge-base `SCHEMA.md` rule apply here too.
3. Collapse six `FALLBACK_ONLY.md` copies into one shared file referenced
   by READMEs (or a single line each pointing to it).
4. Move `sagtask-entrypoint-bug-draft.md` from root into
   `tools/github_issue_cards/pending/` (or delete if superseded).
5. Decide `IDEA.md`: fill or delete — a 14-byte file at root is noise.
6. Add `backups/codex-skills/README.md` stating the historical boundary.
7. Reconcile `TASKS.md` against the live Kanban state; either refresh or
   mark it as a static snapshot with a pointer to the live board.

## Open questions for Semyon

- Should `docs/plans/` one-time issue drafts be deleted after use, or moved
  to an archive class? (20 files, several are dead drafts.)
- Is `IDEA.md` wanted as a persistent scratch slot, or removed?
- Wiki mirror: start with `RESTORE.md` only, or batch the four candidates?

## Verification commands used

- `git ls-files '*.md'` (201 files)
- md5 content-hash duplicate scan
- date regex `20\d{2}-\d{2}-\d{2}` staleness scan
- manual read of all 13 root files
