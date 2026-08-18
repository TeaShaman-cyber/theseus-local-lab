status: READ_BACK_VERIFIED
operation: create
project: theseus-local-lab
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 85668
purpose: Bug report — Hermes desktop app resolves CWD to the hermes-agent SOURCE CLONE instead of the user's workspace; project AGENTS.md is never injected. Flag `hermes desktop --cwd` and `hermes project use` do not fix runtime CWD. Related to #85622 (provider override) but distinct root cause.
approval_scope: publish bug report to NousResearch/hermes-agent via gh issue create (one operation), then read-back.
observed: https://github.com/NousResearch/hermes-agent/issues/85668
verified_at: 2026-08-13T23:45:00+03:00

## Title
[Bug]: Desktop app CWD resolves to hermes-agent clone, not user workspace — project AGENTS.md never injected

## Description
The Hermes desktop app launches with its **process CWD set to the `hermes-agent` source-clone directory** (`HERMES_HOME/hermes-agent`, where the Electron app binary lives), not the user's actual workspace. As a result:

- Layer-8 context files (AGENTS.md) are read from `hermes-agent/AGENTS.md` — the official Hermes **Development Guide** (80 KB, source repo) — instead of the user's project `AGENTS.md`.
- The user's real workspace `AGENTS.md` (e.g. `Documents/Codex/.../life-science-research-plugin-life-science-4/AGENTS.md`) is **never auto-injected**.
- This compounds #85622: built-in MEMORY.md/USER.md are also suppressed by the external memory provider, so the agent effectively runs "context-blind" on a new desktop chat.

## Steps To Reproduce
1. Launch Hermes desktop (double-click app, or `hermes desktop`).
2. Open a new chat.
3. Run `hermes status` in the terminal — observe `Project: C:\Users\<user>\AppData\Local\hermes\hermes-agent`.
4. Run `hermes project show hermes` — observe `primary:` points to the **correct user workspace** (e.g. `Documents/Codex/.../life-science-research-plugin-life-science-4`).
5. Note the contradiction: project-state knows the workspace, but the running session CWD is the clone.

## Expected Behavior
- Desktop session CWD should follow the **active project's primary folder** (or an explicit `--cwd`), so the user's project `AGENTS.md` is injected as Layer-8 context.
- `hermes desktop --cwd <workspace>` should actually set the runtime CWD of the launched session.
- `hermes project use <name>` should make new desktop sessions start from that project's primary folder.

## Actual Behavior
- Desktop always starts with CWD = `hermes-agent` clone (the Hermes install/source dir), regardless of `hermes project use` or `--cwd`.
- Layer-8 AGENTS.md resolves from the **process CWD**, not from project-primary → wrong file injected.
- `hermes project use hermes` reports "Active project: hermes" but does NOT change the running process CWD (it is set by the desktop launcher).

## Affected Component
- Tools: Desktop app launcher (`hermes desktop`), project/CWD resolution, context-file (AGENTS.md) injection (Layer 8).

## Environment
- Hermes v0.20.0 (2026.8.3, upstream 7113a692, local ed5e17f4)
- Python 3.11.15, Node v24.18.0
- Windows 11 Pro (Hermes reports Win10 AMD64)
- Model: tencent/hy3:free via Nous Portal

## Debug Report
NOT ATTACHED — `hermes debug share` uploads the verbatim chat to a public paste (6h retention), disproportionate for this session's PII. Local `hermes debug share --local` dump available on request; minimal isolated repro above.

## Hypothesis
Desktop launcher sets process CWD to its own binary directory (`hermes-agent`) and does not honor `--cwd` / project-primary when spawning the agent backend. Context-file resolution reads from process CWD, so it always finds the clone's AGENTS.md. Fix: desktop should start the backend session from the active project's primary folder (or the `--cwd` arg), and Layer-8 injection should resolve AGENTS.md relative to that, not the Hermes install dir.

## Proposed Fix
1. In `hermes desktop`, pass the resolved workspace CWD (from `--cwd` or active project-primary) to the backend spawn, overriding the launcher's own dir.
2. Layer-8 AGENTS.md resolution should resolve from the session's working directory / project-primary, with a documented fallback order (session CWD → project-primary → HERMES_HOME).
3. Add a test asserting that a desktop session started from a user workspace injects that workspace's AGENTS.md (not hermes-agent/AGENTS.md).

## Additional Context (from local investigation, 2026-08-13)
- `config.yaml` has `cwd: .` (resolves to process CWD).
- `HERMES_WEB_DIST` env points into `hermes-agent/apps/desktop/...` — confirms launcher origin.
- `hermes chat --in <DIR>` (CLI) works correctly; the gap is desktop-only.
- Workaround for CLI users: `hermes chat --in "<workspace>"`. No working workaround for desktop users yet (the `--cwd` flag exists but is ignored at runtime).

## Signature
Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval.
