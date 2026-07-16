# Codex Compact Automation OSINT, 2026-07-16

## Question

Can Theseus force Codex to run a real compact after every generation, preferably from a hook, and what did we miss in official docs or community practice?

## Short Answer

Not as a stable first-class Codex control action today. Codex has real `PreCompact` and `PostCompact` lifecycle hooks, but they run around a compact that has already been triggered by Codex or the user. The currently documented `Stop` hook can continue a turn by creating a model-visible continuation prompt, but it cannot invoke the real `/compact` control path.

The safe route for Theseus is therefore:

1. Keep `UserPromptSubmit` as the memory-reflex preflight.
2. Keep `Stop` as a post-generation checkpoint and warning layer.
3. Use `PreCompact` and `PostCompact` to capture and restore state around real manual or auto compactions.
4. Tune auto-compact thresholds and compact prompt files only after a small local test.
5. Treat any UI automation that types `/compact` as an explicit fallback, not the core route.

## Confirmed Facts

- Official Codex hook docs list `PreCompact` and `PostCompact`. Their matcher input is the compaction trigger, currently `manual` or `auto`.
- `PreCompact` runs before compaction. `PostCompact` runs after compaction. Both receive lifecycle metadata such as session id, turn id, cwd, transcript path, model, and trigger.
- Plain text stdout is ignored for compact hooks. JSON stdout supports common hook output fields.
- `Stop` hook output can keep Codex going through `decision: "block"` and `reason`, but that reason becomes a new model-visible prompt.
- A GitHub issue explicitly reports the missing feature: if `Stop` returns `/compact`, Codex treats it as prompt text, not as the real slash-command/control operation.
- The compact lifecycle PR says compact hook payloads intentionally do not expose compact summaries, summary previews, or custom compaction instructions.
- A separate issue reports that `SessionStart(source=compact)` can be deferred and replayed later, so using it as the only post-compact restoration path is risky.
- Config references expose compaction-related keys such as `compact_prompt`, `experimental_compact_prompt_file`, `model_context_window`, and `model_auto_compact_token_limit`.

## Community Signals

- Users ask for manual `/compact` in the desktop app because automatic compaction can happen mid-work or fail near high context pressure.
- Community patterns focus on compaction memory rather than force-compacting after every turn: save a state packet, preserve git/task context, and inject only compact essentials after compaction.
- Hook examples in public repos show `PreCompact`/`PostCompact` used for logging, state persistence, alerts, and session-end quality gates.
- Some articles recommend using manual compact at natural task boundaries and auto-compact thresholds before the model enters a low-quality high-context zone.

## Implications For Theseus

### Do Not

- Do not rely on `Stop` returning `/compact`; it is not a real compact request.
- Do not build the main path around `SessionStart(source=compact)` until the deferred-delivery issue is known fixed in our runtime.
- Do not compact after every generation blindly. That may increase cost, lose context too often, and create compaction loops.

### Do

- Make post-generation state capture cheap and automatic.
- Keep the dashboard alerting on context pressure, state-packet age, hook-load errors, and compact failures.
- Add a one-click or task-level "compact now" route for the human when context pressure crosses a threshold.
- Consider `model_auto_compact_token_limit` only after measuring how it behaves in the desktop runtime.
- Keep `PreCompact` and `PostCompact` as observability and state-safety hooks, not as a trigger for compaction.

## Recommended Next Experiment

Create a `compact_control_probe` task that does not change normal behavior:

1. Reads current Codex version and hook sources.
2. Verifies `PreCompact` and `PostCompact` fire for a manual compact.
3. Logs hook payload shape and trigger into ignored JSONL.
4. Confirms whether `Stop` with a compact-looking continuation still remains model-visible text.
5. Reports whether `SessionStart(source=compact)` appears immediately or later in our current runtime.

Success means we know exactly which lifecycle surface is trustworthy on this machine.

## Sources

- [OpenAI Codex hooks documentation](https://developers.openai.com/codex/hooks)
- [openai/codex PR #19905: Add compact lifecycle hooks](https://github.com/openai/codex/pull/19905)
- [openai/codex issue #23153: Allow hooks to request real compaction before continuing](https://github.com/openai/codex/issues/23153)
- [openai/codex issue #28736: SessionStart compact hooks are deferred](https://github.com/openai/codex/issues/28736)
- [openai/codex issue #11325: Manual /compact command in Codex app](https://github.com/openai/codex/issues/11325)
- [OpenAI Codex configuration reference](https://developers.openai.com/codex/config-reference)
- [OpenAI Codex advanced configuration](https://developers.openai.com/codex/config-advanced)
- [shanraisshan/codex-cli-hooks](https://github.com/shanraisshan/codex-cli-hooks)
