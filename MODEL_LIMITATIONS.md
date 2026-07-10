# Model Limitations And Safety Watchlist

This file tracks non-marketing reality checks for model and product choices.

Do not treat official documentation as the full picture. It describes intended
capabilities, not all practical limits, refusal modes, regressions, or safety
trade-offs.

## Watchlist

### GPT-5.6 Family

Status: needs independent verification.

Questions to track:

- What public safety evaluations exist?
- Which variants are available in Chat, Work, Codex, API, and third-party
  gateways?
- Which domains are filtered more aggressively than in GPT-5.5?
- Does biology/medicine filtering interfere with legitimate mechanobiology,
  literature review, systems biology, or biophysics work?
- Does the model preserve project context better or merely appear more fluent?
- Does it spend fewer tokens for equivalent reasoning?

### Biology, Medicine, Mechanobiology

Research boundary:

- Allowed/desired: literature review, conceptual models, mathematical models,
  data analysis, non-actionable mechanistic explanations, safety-aware
  methodology.
- Needs caution: clinical advice, diagnosis, treatment recommendations,
  experimental wet-lab protocols, optimization of biological interventions,
  hazardous organism/toxin/pathogen content.

Workflow implication:

- Separate scientific understanding from actionable protocol generation.
- Record refusals or over-filtering as model behavior observations.
- Use multiple sources and models for literature mapping, then validate with
  primary papers and trusted databases.

### External Harnesses

Risks:

- Bothub, CodeWhale, Grok, DeepSeek, and other gateways may receive private
  context if prompts are not sanitized.
- Exporting AutoMem-derived context is treated as private data movement.
- Worker outputs should go to memory inbox drafts, not directly to AutoMem.

### Product Surface Drift

ChatGPT Work, Codex desktop, connectors, scheduled tasks, and memory behavior
can change quickly. Re-check official docs and real behavior before relying on
new product claims.

## Evidence Log

Add entries here when a claim is checked.

Format:

```text
YYYY-MM-DD - Claim - Source(s) - Status: confirmed/contested/speculative - Notes
```
