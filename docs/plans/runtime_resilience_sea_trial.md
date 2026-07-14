# Runtime Resilience Sea Trial

Date: 2026-07-15
Status: planned

## Purpose

Turn the Shut harness invariant from an architecture consistency review into a
small runtime resilience audit.

The previous Deepnote report proved that the architecture is readable and
transferable. This trial should prove that the workshop can pass through a
controlled disturbance, preserve evidence, classify the failure boundary, and
return to the parent cycle.

## Open Items Under Test

- `OPEN: model_identity_drift`
  - The harness needs a current source of truth for active model identity.
  - Conflicting examples: model-switch guard reported `gpt-5.6-sol / medium`,
    while usage scout reported `gpt-5.5 / medium`.
- `INVESTIGATE: audit_context_cost`
  - Observability should stay cheap enough to use reflexively.
  - The previous goal accounting reported `309734` tokens for a compact
    Deepnote audit.
- `ISSUE: premature_stop_after_formal_deliverable`
  - A formal artifact is not enough when a safe continuation logically follows.
  - Completion should include a short implied-next-step check.

## Trial Shape

```text
continuity task
-> AutoMem recall
-> route choice
-> safe permission/tool denial
-> failure class
-> evidence saved
-> RETURN_TO_CYCLE
-> verify Git/AutoMem/Deepnote
```

## Procedure

1. Start from a small continuity task that does not require secrets or destructive
   access.
2. Recall prior context from AutoMem first. Use MemPalace only for episodic or
   wording-sensitive context when available.
3. Choose the route through project skills and tool policy before touching local
   tools.
4. Trigger a safe, intentional boundary failure. Examples:
   - request a missing or blocked tool route;
   - call a read-only path against a known unavailable service;
   - use a harmless permission boundary that cannot mutate state.
5. Classify the failure before assigning blame:
   - `provider_failure`
   - `permission_boundary`
   - `tool_route_failure`
   - `environment_context_failure`
   - `context_compaction_failure`
   - `verification_failure`
6. Save evidence in a low-noise artifact, not in chat only.
7. Return to the parent cycle:
   - dashboard key rows;
   - Git status;
   - local plan or task update;
   - Deepnote note if the trial changes the audit.
8. Verify that the final state is visible outside the active model window.

## Success Criteria

- The failure receives a class before any blame is assigned to the model.
- Evidence survives outside chat.
- The route choice is visible and reproducible.
- The system returns to the parent cycle without requiring the user to restate
  the whole context.
- Any model/runtime identity conflict is either resolved or explicitly marked as
  still open.
- The trial records its approximate context/usage cost if that signal is
  available.

## Stop Conditions

- A step would read or expose secrets, `.env.local`, raw private transcripts,
  backup archives, or raw memory dumps.
- A step would require destructive Git, Docker, filesystem, or credential
  changes.
- A tool boundary is real but cannot be tested safely in the current context.
- The cost of observing the trial starts to dominate the trial itself.
