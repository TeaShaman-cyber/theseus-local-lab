# Bothub Conclave Digest: Stateful Agents / Space Weather

Date: 2026-07-09

Raw result: `outputs/bothub_conclave_space_weather_2026-07-09.json`

Prompt: `outputs/bothub_conclave_space_weather_prompt_2026-07-09.md`

## Run

- Models: `deepseek-r1-0528`, `claude-opus-4.5`, `gemini-3.1-pro-preview`, `gpt-4.1`, `grok-4.3`.
- Chair: `claude-sonnet-4.6`.
- Stage 1: 5/5 model answers succeeded.
- Stage 2: 5/5 peer reviews succeeded.
- Stage 3: chair synthesis succeeded.
- Total reported tokens: 56,946.
- Known reported cost: 0.05026755. Some models reported usage without cost, so treat this as partial/known cost, not guaranteed total.

## Council Consensus

The strongest non-overclaiming version of the project is a baseline anomaly
co-occurrence observatory. We are not testing whether the sun breaks AI yet; we
are building the telemetry and methodology needed to ask that question later.

This remains useful even if the solar/AI/infrastructure relationship is zero:
it gives a local system baseline, a reproducible telemetry stack, and a live
practice ground for correlation-vs-causation discipline.

## Main Warnings

- Model self-narrativization is a key risk: if Codex sees "geomagnetic storm
  active", it may produce storm-shaped interpretations through prompt
  conditioning rather than physics.
- The collector should stay dumb and hypothesis-blind. It should relay signals,
  not explain them.
- Local machine confounds are high priority: CPU temperature, RAM pressure,
  Docker garbage collection, Windows Update, disk pressure, and network health.
- Vendor status pages are weak sensors. They may lag, euphemize, or reflect
  operational/social reporting rather than raw infrastructure state.
- Two weeks is enough to test the pipeline, not enough to claim causal effects.

## Recommended Next Experiment

Run a 14-day baseline with 15-minute polling.

Collect first:

- NOAA/SWPC R/S/G, K-index or Kp proxy, alerts.
- OpenAI status page.
- A fixed synthetic API latency/error probe, because self-measured latency is a
  better sensor than status-page prose.
- Local AutoMem/FalkorDB/Qdrant health.
- Local CPU temperature, RAM pressure, disk pressure, network ping.

Postpone:

- SIF/chlorophyll fluorescence.
- Mycelium/fungal and other bioindicator measurements.
- Scheduled human mood annotations.

## State Packet Rule

The state packet is a constraint, not a story.

Keep it under about 100 tokens, machine-readable, and causally neutral:

```text
[STATE 2026-07-09T03:40Z]
noaa: R0/S0/G0, k4_warning_recent, r_forecast_40pct
openai: partial_minor (1 component)
local: automem_ok, vec=50, cpu_temp=61c
anomaly_flags: none
[/STATE]
```

Rules:

- No causal language.
- `anomaly_flags` is explicit and usually `none`.
- The collector does not know the research hypothesis.
- Packet arrives as tool/file context, not as hidden system instruction.

## Statistics Before Claims

Order of operations:

1. Compute base rates first.
2. Plot time-aligned timelines, including null days.
3. Run lag analysis across a predeclared window, e.g. plus/minus 6 hours.
4. Run permutation tests by shuffling one time series and recomputing overlaps.
5. Correct for multiple comparisons.
6. Replicate in a second independent window before making stronger claims.

Update toward a real effect only if a pre-registered threshold survives
correction, replicates, is absent in quiet-period controls, and remains after
local confounds are controlled.

Update toward narrative overfitting if the effect depends on post-hoc anomaly
definitions, vanishes under blinded analysis, or is explained by CPU/network/
local-system variables.

## Useful Invariant

Raw time series stay in SQLite. Only timestamped DIFFs, quality flags, decisions,
and cross-checked conclusions go to semantic memory.
