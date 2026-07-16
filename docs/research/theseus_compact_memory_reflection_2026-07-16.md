# Theseus Compact Memory Reflection

Date: 2026-07-16
Source: local PDF conversation export, "шут и дворец - Ежедневный технообзор.pdf".

This note is not a source-of-truth transcript. Treat it as a distilled reflection
from a conversation that may contain user shorthand, metaphors, and speculative
bridges.

## Core Takeaway

The strongest useful invariant is not "compression is good". It is:

```text
full distributed evidence remains outside the active window
active context carries a compact causal workspace
the workspace points back to evidence when details matter
```

For Theseus, `/compact` is useful only when it preserves the current goal,
constraints, decisions, open fronts, and pointers to AutoMem, MemPalace, Graphify,
Git, files, and session logs. A short summary that loses those routes is just
amnesia with nicer typography.

## Distinctions To Keep

- A model bottleneck is an architectural or training-time constraint.
- J-space is an observed internal broadcast/workspace-like phenomenon, not a
  normal designed bottleneck.
- Codex `/compact` is a text-level lifecycle operation.
- AutoMem is a temporal memory-control loop: what to record, retrieve, and let
  influence the next episode.

These are not identical mechanisms. The useful bridge is functional:

```text
rich local processing
-> compact coordination representation
-> broadcast to later operations
-> verified behavior in a new situation
```

## Design Implication

The active Codex window should behave less like an archive and more like a
control plane:

- current objective;
- active constraints and permissions;
- known failure classes;
- accepted decisions;
- current evidence pointers;
- next verifiable action.

The evidence plane should stay outside:

- AutoMem for durable decisions and patterns;
- MemPalace for episodic/verbatim recall;
- Graphify/Falkor for structured relations;
- Git and local files for reproducible artifacts;
- session timeline and hook logs for observed transitions.

## Stanford AutoMem Parallel

The Stanford-style loop updates a memory specialist and scaffold from observed
memory decisions. Theseus currently cannot update model weights directly, but it
can update the external choice architecture:

```text
episodes
-> session logs / MemPalace
-> invariant extraction
-> AutoMem
-> skills / tasks / policy / route graph changes
-> new agent behavior
-> verification
```

So the model may remain the same while the effective agent changes. The learning
target is the causal architecture of repeated interaction, not merely the model
weights.

## Practical Guardrails

- Do not infer that frequent `/compact` automatically improves reasoning.
- Do not let compact summaries replace evidence pointers.
- Do not use route scores as proof of learning; require postconditions and
  observed behavior change.
- Keep compact packets small enough to be readable but structured enough to
  restore work without rereading the long chat.
- Treat manual compact as a controlled operation until Codex exposes a real
  programmatic compact API.

## Working Formula

```text
good compact =
  preserve causal workspace
  + preserve evidence addresses
  + drop accidental conversational bulk
  + make the next action easier to verify
```
