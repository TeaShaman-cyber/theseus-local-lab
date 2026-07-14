# Model Switch Guard

`model_switch_guard.mjs` turns a model or reasoning-effort change into an
observable runtime transition instead of relying on conversational memory.

The `UserPromptSubmit` hook supplies the current model and transcript path. The
guard compares them with `outputs/model_switch_guard/state.json`. On the first
observation or a change it:

- writes a `model-runtime-initialized` or `model-runtime-changed` event to the
  session timeline;
- injects a short preflight restoring memory, skill-router, shell-router, and
  verification habits;
- stays silent on later prompts while the runtime remains stable.

The state file is operational output and must not be committed.
