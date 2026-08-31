# Crystallization: 2026-07-08

Purpose: compact checkpoint after AutoMem, ButlerBrain, Airtable, Bothub/DeepSeek, Google Drive, and the local PDF seed pass.

## Current Core

1. The project is not only "memory storage"; it is memory of research trajectories: what was tried, why it mattered, what failed, and which invariants survived.
2. The working pipeline remains: invariant -> isomorphism -> adaptation.
3. Local AutoMem is the first stable substrate. ButlerBrain and Airtable are mirrors / exchange surfaces, not the only source of continuity.
4. MCP is the current connector layer between models, memory, tools, and future external interfaces.
5. DeepSeek should be used more often as an architecture / structure voice, especially for routing, MoE/LUCA, expert-switching cost, and invariant testing.
6. Humor and high-entropy metaphor are useful for preventing premature fixation, but they need an isolated namespace so they do not pollute strict technical recall.
7. Every imported note should be labeled as `verified`, `hypothesis`, `metaphor`, or `noise` before it becomes durable memory.

## Artifact Map

- `outputs/automem_lab_journal.md`: operational journal and reverse-sync history.
- `outputs/deepseek_drive_index.md`: first index of DeepSeek-related Google Drive notes.
- `outputs/deepseek_seed_prompt.md`: curated prompt packet sent to DeepSeek through Bothub.
- `scripts/bothub-chat.ps1`: local Bothub chat helper, reads `.env.local` without printing secrets.
- `scripts/bothub-council.ps1`: local council helper, now defaults to DeepSeek first.
- `scripts/automem-status.ps1`: health check for local AutoMem stack.

## PDF Seed: `Краткое резюме.pdf`

Source path: `C:\Users\s.poklad\Downloads\Краткое резюме.pdf`

Extraction status: readable text, 8 pages.

Source status: `local_pdf / needs_live_verify`.

The PDF summarizes a claimed July 2026 Anthropic / Transformer Circuits result about verbalizable internal representations, `J-space`, and `J-lens`. The useful operational idea for us is not "LLMs are conscious"; the useful idea is narrower:

- a model may have a small privileged subspace where concepts become available for later verbalization;
- interpretability tools can expose latent concepts that are not present in the visible answer;
- causal interventions on those latent concepts may change later behavior;
- a memory/council system should preserve hidden reasoning trajectories, not only final outputs.

## Fit With Our Pipeline

`J-space` maps naturally to the "invariant" layer: concepts that survive across tasks and appear before final verbal output.

`J-lens` maps to the "isomorphism" layer: a translation mechanism between latent internal structure and readable tokens.

Reflective training / intervention maps to the "adaptation" layer: shaping which concepts become salient without hard-coding every final behavior.

## Guardrails

- Do not store the PDF claims as `verified` until the primary Anthropic / GitHub sources are directly confirmed.
- Keep "global workspace" language as an interpretability hypothesis, not as proof of model consciousness.
- Treat the PDF as a seed for research routing: good enough to guide next searches, not enough to anchor architectural commitments.
- If sending related material to external models, send curated excerpts and labels, not raw private notes.

## Next Safe Step

Build a small ingestion template for Drive/PDF/ButlerBrain notes:

`source -> short summary -> label -> invariant candidate -> risks -> where to store -> external review allowed?`

This should reduce context pressure and make future automation easier.
