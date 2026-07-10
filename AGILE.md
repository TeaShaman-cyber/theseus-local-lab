# Theseus Local Lab Workflow

This repo uses a lightweight kanban rhythm that is easy for Codex, Work,
ChatGPT, CodeWhale, Git, and AutoMem to share.

For a visual overview, see `VISUAL_MAP.md`.

## Operating Modes

- Chat: briefing, reflection, strategy, quick orientation.
- Work: research digests, documents, presentations, reports, polished outputs.
- Codex: local engineering, Docker, Git, scripts, tests, files, backups.
- AutoMem: durable project memory, decisions, invariants, fixes.
- CodeWhale: worker/conclave harness with read-only context packs and reviewed
  memory inbox drafts.

## Daily Briefing

Use this before engineering when new thoughts, news, or constraints appeared.

1. What changed since the last session?
2. What external claims need verification?
3. What is the laptop/infrastructure state?
4. What matters emotionally or cognitively today?
5. What should be protected from token/resource waste?
6. What is the smallest useful next outcome?

## Task Lifecycle

Tasks live in `TASKS.md`.

- Inbox: captured but not shaped.
- Ready: clear enough to start.
- Doing: one active focus lane per agent.
- Review: done locally, needs verification, user review, or push.
- Blocked: waiting on access, limits, network, reboot, payment, or user choice.
- Done: completed and either committed, documented, or intentionally discarded.

## Priority Scale

- P0: protects data, memory, safety, or recoverability.
- P1: unlocks multiple future tasks or reduces repeated friction.
- P2: useful project work with clear value.
- P3: nice-to-have, experiments, polish.

## Definition Of Done

Engineering work is done when:

- the change is implemented;
- verification was run or the reason it was not run is recorded;
- secrets were not exposed;
- generated/heavy files are ignored or intentionally stored;
- a commit exists for durable repo changes;
- AutoMem is updated for durable decisions.

Research work is done when:

- official and independent sources are separated;
- claims are marked as confirmed, contested, or speculative;
- safety/model limitations are noted;
- next engineering implications are listed.

## Model And Safety Reality Check

Official docs are useful for capabilities, but they are not enough for research
planning. Maintain a separate model-limitations lane for:

- safety evaluations and public critique;
- domain restrictions that affect biology, medicine, chemistry, and security;
- refusal/filter behavior that may block legitimate research;
- differences between Chat, Work, Codex, and external harnesses;
- cost, latency, context, and rate-limit behavior.

Treat restricted-domain work as a methodology problem: split literature review,
benign mechanistic modeling, data analysis, and wet-lab/protocol content into
separate tasks with explicit safety boundaries.

## Weekly Review

Once a week, or after a big setup session:

1. Move finished tasks to Done.
2. Promote durable decisions to AutoMem.
3. Check backups and restore path.
4. Check whether active tasks still match the project invariants.
5. Prune or defer low-value tasks.
