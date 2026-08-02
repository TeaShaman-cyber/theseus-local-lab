---
name: execution-guard
description: Use during tool/route execution when the same failure class is about to be retried, or when detecting materially equivalent unproductive repetition.
---

# Execution Guard

Thin execution reflex. Not a task planner and not a skill router.

## Invariant

```text
observed failure
→ stop blind retry
→ preserve intent/authority
→ choose valid fallback if one exists
→ otherwise ask the user
```

## M-06 Anti-Loop

After **≥3 materially equivalent** unproductive attempts with the **same route/failure class**:

1. Declare `LOOP_DETECTED`
2. Stop that route
3. Record the failure class briefly
4. Take a valid alternative route if one exists
5. Otherwise ask the user

## Material equivalence

Count as the same class only when route + failure signature are effectively the same, for example:

```text
same endpoint + same parameters + same auth error  ×3  → loop
```

Do not treat one loop merely because the high-level goal is similar. Different providers or different failure signatures are different routes.

## Non-goals

- Do not become a general supervisor of task meaning.
- Do not auto-escalate to the user while a valid alternative route exists.
- Do not revive CLI-shaped connector skills or mandatory GitHub-write paths.
