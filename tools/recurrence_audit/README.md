# Recurrence Audit

Small preflight audit for recurring Theseus friction patterns before large
technical-debt work.

It reads existing caches and logs, then writes:

```text
outputs/recurrence_audit/latest.json
outputs/recurrence_audit/latest.md
```

Run:

```text
node tools/recurrence_audit/recurrence_audit.mjs --write
```

The audit is intentionally blameless. A warning means "candidate for a cheap
guardrail, wrapper, dashboard row, or explicit fallback label", not "the agent
failed".
