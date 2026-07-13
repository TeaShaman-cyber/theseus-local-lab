# Theseus Learning Loop

Small daily analyzer for the local harness-learning loop.

It reads ignored `outputs/tool_policy/*.jsonl` events and writes a compact
review proposal:

```text
node tools/learning_loop/learning_loop.mjs --days 7
```

Output:

```text
outputs/learning_loop/YYYY-MM-DD-learning-loop.md
```

This is deliberately not automatic self-modification. It creates review
candidates for skill-router, tool-policy, VS Code tasks, and AutoMem updates.

## Loop Mapping

- Tool-policy events: action-level critic signal.
- Verification outcome: delayed reward source.
- Learning-loop report: distilled candidate change.
- AutoMem: durable accepted decision.
- Skill-router/tool-policy: future behavior change.

## Synthetic Eval Extension

Synthetic scenarios can expand coverage, but generation and validation must stay
separate. Use schema-first fictional route examples, then reject anything that
fails tool-policy validation, duplicate checks, privacy checks, or human review.

For Theseus this means:

- generate candidate agent/tool-use scenarios;
- validate JSON shape and allowed fields;
- run every candidate route through `tools/tool_policy`;
- keep accepted eval cases separate from raw generated candidates;
- never use synthetic route scores as final reward without later task
  verification.

## Guardrail

Do not treat route scores as final reward. Promote a proposal only after it
matches verified behavior on later tasks.
