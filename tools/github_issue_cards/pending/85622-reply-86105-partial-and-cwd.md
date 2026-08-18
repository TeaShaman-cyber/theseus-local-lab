status: READ_BACK_VERIFIED
operation: comment
project: theseus-local-lab
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 85622
purpose: Reply to #85622 comment 5297782473 — agree with webtecnica's plan; flag that PR #86105 is partial (does not cover our reproduction where memory_enabled is already true); note built-in MEMORY.md resolves from HERMES_HOME not CWD so the CWD bug (#85668) is a separate root cause; next step = instrument the live --mode both spawn path.
approval_scope: publish reply comment to NousResearch/hermes-agent issue 85622 via gh issue comment (one operation), then read-back.
observed: https://github.com/NousResearch/hermes-agent/issues/85622#issuecomment-5298161876
verified_at: 2026-08-14T21:05:35.270Z
## Comment body

Thanks @webtecnica — the plan in #issuecomment-5297782473 is sound and we agree with it. Two things to add from our side before this is closed:

### 1. PR #86105 is a valid hardening, but it does NOT cover our reproduction

PR #86105 forces `memory_enabled`/`user_profile_enabled` to `True` **only when they are currently `False`** (the blank-slate wizard left-over case). Our reproduction is different:

- Our config: `memory_enabled: true`, `user_profile_enabled: true`, `provider: automem` (verified via `hermes config get memory`, pasted in #issuecomment-5297203519).
- Symptom: on a **fresh desktop chat 2026-08-13** (same profile, same truthy flags, no `--ignore-rules`/`--safe-mode`), built-in `MEMORY.md`/`USER.md` were **absent** and only the AutoMem provider block appeared.
- Yet in the **current** chat (same machine/profile/flags) the built-in `MEMORY.md` **is** injected (AutoMem HERMES RULES block sits above it as the additive provider block).

So the symptom reproduces specifically on a **new chat while a provider is active**, even with truthy flags. PR #86105's force-logic is a no-op in that state, so it will not fix our case. We'd hold #85622 open even after #86105 lands, and keep #86328 explicitly not-claiming to close this issue (as you noted).

### 2. Local in-proc probe confirms the bug is in the spawn path, not the renderer

We ran a minimal in-process repro of `agent/agent_init.py:1754-1770` with `provider=automem` + `memory_enabled=true` in an isolated `HERMES_HOME`:

```
memory_enabled=True user_profile_enabled=True provider='automem'
MemoryStore created: True
store resolved mem_dir = <tmp>/memories   (from HERMES_HOME, NOT CWD)
memory_entries loaded: 1   (MEMORY.md read)
user_entries loaded: 1     (USER.md read)
RESULT: in-proc path: built-in store CREATED + MEMORY.md read -> additive contract holds in-process.
```

So the in-process path is correct (matches your probe). The bug must live in the **`--mode both` spawn ordering** on a live desktop session — exactly your thesis. The next step you proposed (instrument store creation in a real `--mode both` session) is the right one:

```python
logger.debug("memory-init: enabled=%s profile=%s store=%s provider=%s",
             agent._memory_enabled, agent._user_profile_enabled,
             agent._memory_store is not None, _mem_provider_name)
```

We're happy to run that instrumentation and report `store is not None` + `load_from_disk()` status on a fresh chat vs the current one.

### 3. The CWD bug (#85668) is a separate root cause for built-in MEMORY.md

Built-in `MEMORY.md`/`USER.md` resolve from `get_hermes_home()` (`LOCALAPPDATA/hermes/memories`), **not** from CWD — confirmed in `tools/memory_tool.py: memories_dir() = get_hermes_home() / "memories"`. So the CWD mis-resolution (#85668) does **not** affect built-in memory injection; it only hits `AGENTS.md` (Layer 8, CWD-only). The two issues share a symptom class ("wrong/missing context at session start") but different roots.

— Semyon Poklad and Svarog
