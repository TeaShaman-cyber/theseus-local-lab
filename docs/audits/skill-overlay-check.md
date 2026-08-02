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

Do not create a second project runtime. The repository is the backup and review
surface for skills; the active runtime remains one global Codex skill surface.
The project copy and tracked global copy are aligned with that runtime after
the first reviewed router-contract edit. When `main` is pushed, the tracked
skill copies must be included in the explicit staging scope and protected by
the normal Git safety scan.

No resolver, loader, background synchronizer, or second runtime was introduced.
The router change is a deliberately small contract edit, not an overlay
mechanism.

## Next bounded action

Prove the shell handoff and repeated-failure stop paths with executor-backed
cases before changing more skills. Do not add an automatic resolver or
background sync hook.
