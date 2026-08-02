# Skill backup and runtime scope check

Date: 2026-08-02
Status: `SCOPED / NO_PROJECT_RUNTIME_SPLIT`

## Observed

The current working model is one active monolithic Theseus local-lab project.
Repository skill copies are backup/versioned artifacts for the GitHub
repository; they are not being promoted to a second project runtime. The
current Codex runtime remains the global skill surface unless a separate
explicit runtime decision is made.

| Skill | Project file | Global file | Observation |
|---|---|---|---|
| `theseus-skill-router` | tracked in `.agents/skills/` | global runtime copy exists | keep repository copy as backup; do not infer runtime overlay |
| `theseus-memory-stack` | tracked in `.agents/skills/` | global runtime copy exists | keep repository copy as backup; do not infer runtime overlay |
| `theseus-shell-routing` | tracked in `.agents/skills/` | global runtime copy exists | keep repository copy as backup; do not infer runtime overlay |

## Decision

Do not spend effort proving project/global runtime precedence at this stage.
The repository is the backup and review surface for skills; the active runtime
is one global Codex skill surface. When `main` is pushed, the tracked skill
copies must be included in the explicit staging scope and protected by the
normal Git safety scan.

No resolver, loader, or skill file is changed for this check. The differing
router copies are a version-drift question for the backup review, not a reason
to create a second project runtime.

## Next bounded action

Audit the tracked skill backup against the active global skill files, report
drift, and stage explicit skill paths when the user asks to sync `main`. Do not
add an automatic resolver or background sync hook.
