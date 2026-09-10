# Codex upstream drift audit: memory, hooks, compaction, subagents, and Windows/WSL

Date: 2026-09-10  
Issue: #10  
Repository baseline: `eb8e9b79c7c1b7770c890d242e8dab962bcce66f` (`origin/main` at audit start)

## Question

Since the first Theseus Codex memory/hook experiments, Codex has gained native
memory, richer hooks, mature subagents, and substantially more Windows/WSL
support. Which Theseus mechanisms are still justified, which now overlap native
Codex, and which assumptions are stale?

This note is research only. It does not authorize a runtime switch, provider
mutation, production outbox flush, hook rewrite, or WSL migration.

## Evidence floor

Current project state was read from `origin/main`, not from the existing local
`feat/grok-skill-router-v01` checkout. That checkout is eight commits ahead on
its own line and 93 commits behind current `origin/main`, with an uncommitted
`.gitignore` change, so it is not used as current architectural evidence.

The newest Codex version recorded in tracked project evidence is historical:
`docs/observations/codex_desktop_wsl_mcp_bridge_2026-07-18.md` records Codex CLI
`0.144.1`. No current `codex_system_watch` runtime artifact is present in this
MarcoPolo workspace. Therefore the Codex version actually installed on the user
host is **UNKNOWN** in this audit.

Current upstream stable release, independently read from the `openai/codex`
release API, is `0.154.0`, published 2026-09-09.

```text
upstream supports X != installed host demonstrably runs X
```

## Feynman split: four different jobs that had been called "memory"

```text
1. recall       find useful old context
2. delivery     put that context into the model-visible prompt
3. persistence  write durable state somewhere
4. proof        show that the intended state was actually stored/read back
```

Current Codex now owns more of (1) and (2) than it did in July. Theseus still
has stronger explicit contracts around (3) and (4).

## Current Theseus path on `main`

From `HOOKS_PIPELINE.md`, `hooks/codex-hooks.json`, and
`hooks/hook-router.mjs`:

```text
UserPromptSubmit
  -> AutoMem preflight / recall
  -> Hindsight recall (bank=codex)
  -> model-switch guard + skill observatory

PreCompact
  -> local state packet

PostCompact
  -> local recovery checkpoint + context pressure

Stop
  -> memory gate
  -> local outbox
  -> AutoMem flush + exact readback
  -> MemPalace flush + exact drawer readback
  -> Hindsight async retain
  -> usage/context observability
```

AutoMem and MemPalace are not treated as successful merely because transport
returned success. `tools/memory_outbox/README.md` requires matching readback
before marking an event processed.

## Upstream change 1: Codex now has native local memory

Current Codex documentation describes an opt-in local memory store separate
from ChatGPT web memory. Eligible prior chats are extracted and consolidated in
the background; memories live under `CODEX_HOME` (normally `~/.codex`) and can
be controlled with `/memories` and the `memories.*` configuration keys.

OpenAI explicitly says required team rules should remain in `AGENTS.md` or
checked-in documentation rather than relying on memories alone. Generation can
also be skipped when the remaining Codex rate-limit budget falls below a
configured threshold.

The upstream implementation separates a read path from a two-stage
write/consolidation pipeline. It uses the Codex state DB for bounded extraction
jobs and a local git-baseline memory workspace for global consolidation.

### Consequence for Theseus

Native Codex memory materially overlaps:

- AutoMem recall on every `UserPromptSubmit`;
- Hindsight recall on every `UserPromptSubmit`;
- parts of custom compact-recovery context.

It does **not** yet demonstrate equivalence to the Theseus durable-memory
contract:

- accepted-event gate;
- explicit source/authority policy;
- cross-provider projection;
- exact provider receipt + readback;
- cross-runtime memory independent of one Codex home directory.

Disposition: **A/B TEST native recall before retiring external recall; KEEP the
verified durable outbox/write path for now.**

## Upstream change 2: current hook output semantics expose a likely delivery bug

Current hook documentation says:

- `hookSpecificOutput.additionalContext` is added to model-visible developer
  context for supported lifecycle events;
- `systemMessage` is displayed as a warning/event message;
- `suppressOutput` is currently parsed but not implemented;
- repository hook commands should resolve paths from the Git root because the
  session working directory can be a repository subdirectory;
- command hooks may be asynchronous and hooks may invoke MCP tools;
- Windows-specific commands can use `commandWindows` / `command_windows`.

Current Theseus `memory_reflex.mjs` successfully performs AutoMem recall, but
returns the recalled prelude in `systemMessage`. `hook-router.mjs` forwards that
field as `systemMessage`. Hindsight, by contrast, returns its recall through
`hookSpecificOutput.additionalContext`.

Therefore, against the current upstream contract:

```text
AutoMem recall success
    !=
AutoMem model-context delivery
```

This matches the shape already observed in Issue #10: recall artifacts exist,
but the characteristic AutoMem prelude was not found in inspected model
context records.

Because the installed host version is still unknown, this is a **source-level
FIX CANDIDATE**, not yet a proven current-host root cause. The next runtime probe
should correlate one text turn and one voice turn before changing code.

A second concrete portability risk is the tracked manifest command:

```text
node hooks/hook-router.mjs --event ...
```

The command is relative to session `cwd`; current OpenAI guidance explicitly
recommends Git-root-resolved repository hook paths. This needs a small
subdirectory-cwd regression probe before any fix.

## Upstream change 3: compact restoration is stronger than the July assumption

Current hook documentation guarantees that after root-session compaction,
`SessionStart` with source `compact` runs before the next model request. The
documentation explicitly includes automatic compaction that occurs in the
middle of a turn: its `additionalContext` is delivered to the immediate
continuation.

The July note `docs/research/codex_compact_automation_osint_2026-07-16.md`
carried a defensive assumption that `SessionStart(source=compact)` could be
deferred and should not be the primary restoration path. That assumption is
**STALE relative to current upstream documentation**.

Theseus currently registers `PreCompact` and `PostCompact`, but not
`SessionStart`.

Disposition: **RE-EVALUATE** the compact path. Do not delete state packets yet;
first test whether a tiny `SessionStart(source=compact)` context receipt can
replace some post-compact recovery ceremony on the installed build.

## Upstream change 4: hooks can now do more, but async is not automatically safer

Release notes between the historical project record and current upstream show
material hook evolution. In `0.148.0`, command hooks gained asynchronous mode
and MCP-tool handlers; later releases improved captured session environment,
MCP hook routing, plugin-hook refresh, interrupted-turn handling, and hook
runtime refresh after plugin changes. `0.154.0` refreshes skills/hooks after
plugin upgrades or rollbacks in existing sessions.

This makes the current Theseus `Stop` path worth simplifying: many sequential
children run inside an explicitly configured ten-second outer hook timeout,
while current Codex supports background hooks.

However current docs also say unfinished background hooks are cancelled when a
session ends. Therefore moving durable provider writes to `async: true` merely
to avoid timeout would weaken the persistence contract.

Disposition: **DO NOT MOVE VERIFIED WRITES TO ASYNC BLINDLY.** A safer later
candidate is to keep gate/outbox append synchronous and let a separately owned
bounded drain process handle provider writes. That remains a hypothesis, not an
implementation decision.

## Upstream change 5: native subagents are now ordinary Codex capability

Current Codex releases enable subagent workflows by default. They are available
in the desktop app, CLI, and IDE; custom agents can define model, reasoning,
sandbox, MCP servers, and skills. OpenAI also warns that subagents consume more
tokens and recommends starting with read-heavy parallel work such as
exploration, testing, triage, and summarization.

This creates overlap with parts of the older Theseus council/helper machinery,
but that is outside Issue #10's memory-lifecycle acceptance path.

Disposition: **DEFER** council simplification to a separate bounded audit.
For this issue, subagents are relevant only as a possible read-only research or
verification worker, not as memory authority.

## Upstream change 6: Windows/WSL is now first-class, but state sharing is not magic

Current Windows documentation says the desktop app defaults to a native Windows
Codex agent and can switch the agent environment to WSL2. WSL1 is unsupported
from Codex `0.115` onward because the Linux sandbox uses `bubblewrap`.

The Windows app/native Windows Codex use `%USERPROFILE%\\.codex`. Codex CLI in
WSL uses the Linux home by default, so configuration, cached authentication,
sessions, and local Codex memories are **not automatically shared**. OpenAI
documents either synchronizing the homes or explicitly setting `CODEX_HOME` to
the Windows location from WSL.

Theseus also has one explicit Windows-only launch assumption:
`tools/memory_outbox/flush-mempalace.mjs` defaults to `npx.cmd`.

Disposition: **WSL2 is viable upstream, but migration remains a separate state
transition.** Issue #10 should only produce a compatibility disposition; it
must not switch the active environment.

## Voice boundary

Current ChatGPT Voice documentation explicitly includes Codex in the desktop
app: voice can start, inspect, and redirect Codex tasks, and existing supported
Codex tasks reuse their conversation history and selected model. Voice uses a
separate rolling five-hour quota; tasks started from voice still consume Codex
usage quota.

The public documentation inspected here does **not** establish that a spoken
turn traverses `UserPromptSubmit` with exactly the same hook payload/delivery
semantics as a typed turn.

Disposition: **UNKNOWN — runtime correlation required.** Do not infer voice hook
behavior from ordinary text behavior.

## Decision matrix

| Surface | Current disposition | Why |
| --- | --- | --- |
| AutoMem `UserPromptSubmit` recall | **FIX CANDIDATE / A-B TEST** | Recall is returned through `systemMessage`, not model `additionalContext`; native memory now overlaps recall |
| Hindsight `UserPromptSubmit` recall | **KEEP FOR TEST, THEN A-B** | Uses correct model-context field, but overlaps native Codex memory |
| AutoMem verified durable writer | **KEEP** | Explicit gate + provider receipt/readback is not replaced by native generated memory |
| MemPalace verified episodic writer | **KEEP, WSL DISPOSITION NEEDED** | Exact drawer readback adds evidence; launcher defaults to Windows `npx.cmd` |
| Local outbox | **KEEP** | Separates accepted local event from provider availability/retry |
| PreCompact state packet | **KEEP UNTIL PROBE** | Still gives a local recovery receipt |
| PostCompact checkpoint | **RE-EVALUATE** | Native `SessionStart(source=compact)` can now deliver immediate context |
| `suppressOutput` behavior | **DO NOT RELY ON** | Current upstream docs say parsed, not implemented |
| Relative hook command path | **FIX CANDIDATE** | Current docs recommend Git-root resolution because hook cwd may be a subdirectory |
| Sequential provider writes inside 10s Stop hook | **RE-EVALUATE** | Self-imposed deadline + many children; naive background-hook conversion can lose unfinished work |
| Native Codex memories | **CONTROLLED PILOT** | Strong local recall/consolidation, but generated/opportunistic and not Theseus authority |
| Native subagents | **DEFER** | Useful overlap with helper/council layer, not a blocker for memory issue #10 |
| WSL2 migration | **DEFER SWITCH / AUDIT COMPATIBILITY ONLY** | First-class upstream, but `CODEX_HOME` and Windows launchers need explicit migration state |
| Voice hook equivalence | **UNKNOWN / PROBE** | Voice-Codex integration is documented; hook-event equivalence is not |

## Smallest next runtime experiment

Do **not** start by enabling native memories or changing hooks.

First capture one opaque correlation ID across two user-host turns:

```text
A. ordinary typed turn
B. voice turn in the same Codex task

correlation-id
  -> UserPromptSubmit observed? yes/no
  -> AutoMem recall count / failure class
  -> Hindsight recall count / failure class
  -> hook output field (systemMessage vs additionalContext)
  -> model-visible delivery marker present? yes/no
```

No conversation text is required in the receipt. This directly answers the
highest-value unknown in Issue #10 and tells us whether the AutoMem delivery
field should be fixed before any larger memory migration.

After that probe, run one subdirectory-cwd hook invocation to confirm or reject
the relative-path risk. Only then design a bounded patch.

## Plugin trial: interim evidence

### AI Psychiatry

Skills used: `investigation-floor`, `reasoning-balance`.

Observed contribution:

- prevented the stale 93-commit-behind checkout from becoming "current state";
- kept `upstream capability` separate from `installed runtime evidence`;
- stopped the audit after the promised upstream surfaces instead of expanding
  into unrelated council, replay, scheduler, or provider redesign.

Interim disposition: **USEFUL, LIGHTWEIGHT**. The useful part is the stop/evidence
floor, not the psychiatric vocabulary. It overlaps the project contract but
helped enforce it at the point where scope could have expanded.

### EngineeringSuite

Selected route: `research`.

Observed contribution:

- primary-source-first discipline fits the audit;
- the single Markdown artifact forces a compact durable synthesis rather than a
  chat-only pile of links.

Its skill explicitly asks for a background research agent. No matching
background-agent execution channel is exposed in this ChatGPT runtime, so that
sub-capability is **DEGRADED** and was not claimed as executed. The source and
artifact contract was followed directly instead.

Interim disposition: **PARTLY USEFUL**. The research discipline is good, but it
mostly duplicates existing Theseus/project-contract practice; the distinctive
background-agent mechanism was unavailable here.

## Primary sources

- OpenAI, Codex memories: https://learn.chatgpt.com/docs/customization/memories
- OpenAI, Codex hooks: https://learn.chatgpt.com/docs/hooks
- OpenAI, Codex subagents: https://learn.chatgpt.com/docs/agent-configuration/subagents
- OpenAI, ChatGPT desktop app for Windows / WSL: https://learn.chatgpt.com/docs/windows/windows-app
- OpenAI, ChatGPT Voice: https://learn.chatgpt.com/docs/features/voice
- OpenAI Codex current memory implementation notes: https://github.com/openai/codex/blob/main/codex-rs/memories/README.md
- OpenAI Codex release 0.154.0: https://github.com/openai/codex/releases/tag/rust-v0.154.0
- OpenAI Codex releases: https://github.com/openai/codex/releases

## Current disposition

```text
RESEARCH SLICE COMPLETE
IMPLEMENTATION NOT AUTHORIZED BY THIS NOTE
HIGHEST-VALUE NEXT EVIDENCE = text-vs-voice correlated UserPromptSubmit delivery probe
```
