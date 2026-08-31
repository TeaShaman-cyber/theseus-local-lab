# Pre-prompt standards for subagent councils (user principles, formalized)

User principles (2026-08-31), to be embedded in every council dispatch:

1. ASK-DONT-ASSUME: if critical context is missing, the agent must ask
   clarifying questions instead of silently filling gaps. For one-way
   subagent channels (no Q&A possible), the equivalent contract is:
   mark `MISSING: <what>` in REASONING and state how it would change
   the verdict — never silently assume.
2. FACTS vs ASSUMPTIONS: every claim is labeled FACT (follows from
   provided verified data) or ASSUMPTION (plausibly reconstructed).
   Anything load-bearing that is only ASSUMPTION must be confirmed
   before acting on it.
3. RESULT STANDARD: the request defines acceptance rules, not just the
   task — required format (VERDICT | CONFIDENCE | REASONING |
   WHAT WOULD CHANGE MY MIND), grounding in listed facts, word limits,
   and a closing self-critique (WEAKEST POINT).

Council dispatch template gains a FORMAT ADDITION block with (1)-(3).
Precedent: deleg_a3862069 (helper-config lab design) — principles were
applied too late for steer (children had finished), so they apply to
interpretation of results and all future dispatches.
