# Bothub Conclave Prompt: Improving a Windows Host for a Codex Agent

Date: 2026-07-09

We are running Codex Desktop on an older Windows laptop. The user jokingly calls
it a "Windows hut" for an emergent AI collaborator. The goal is not to turn the
machine into a perfect developer workstation; the goal is to improve stability,
repeatability, and comfort for local agent work without overloading the laptop
or breaking the already-working AutoMem/Docker setup.

Local constraints and facts:

- Host OS: Windows.
- Codex shell is sandboxed and often cannot directly access the Docker pipe.
- Approved/elevated execution can run Docker commands.
- Docker Desktop works with WSL2 backend.
- AutoMem runs in Docker and is healthy at `http://127.0.0.1:8001/health`.
- PowerShell: 7.4.17.
- Git for Windows: 2.52.0.windows.1.
- Chocolatey exists but is old: 0.12.1.
- `winget` was not found from the Codex sandbox.
- WSL component exists, but no Linux distribution is installed.
- Git Bash works and is wrapped by `scripts/agent-bash.ps1`.
- Docker Linux workbench `agent-shell` was built and tested. It includes Bash,
  Git, curl, jq, SQLite, Python 3.11, Node 24, and can reach AutoMem through
  `host.docker.internal:8001`.
- Scripts and notes already added:
  - `scripts/agent-bash.ps1`
  - `scripts/agent-shell.ps1`
  - `agent-shell/`
  - `outputs/windows_and_script_lessons_2026-07-09.md`
- Known pain points:
  - PowerShell quoting/interpolation pitfalls.
  - PowerShell single-item arrays collapsing into scalar JSON.
  - Long Bothub/model runs need progress logs and checkpoints.
  - Docker pipe permissions differ between sandbox identity and normal Windows
    user.
  - Network calls from sandbox often require approved external execution.
  - The workspace `.git` entry is not recognized as a normal git repository.

Current Bothub model catalog snapshot from `/models`:

- Claude: includes `claude-opus-4.8`, `claude-opus-4.8-fast`,
  `claude-sonnet-5`, `claude-sonnet-4.6`, `claude-opus-4.5`.
- GPT: includes `gpt-5-codex`, `gpt-5.5-pro`, `gpt-5.4-pro`,
  `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5-chat`, `gpt-5`.
- OpenAI o-series: includes `o3`, `o3-pro`, `o3-deep-research`,
  `o3-mini-high`.
- Gemini: includes `gemini-3.1-pro-preview`, `gemini-2.5-pro`,
  `gemini-3.5-flash`.
- Grok: includes `grok-4.5`, `grok-4.3`, `grok-4.20-multi-agent`.
- DeepSeek: includes `deepseek-r1-0528`, `deepseek-r1`,
  `deepseek-v4-pro`, `deepseek-chat`.
- Qwen/Kimi: includes `qwen3-coder-plus`, `qwen3-coder`,
  `qwen3.6-max-preview`, `kimi-k2.7-code`, `kimi-k2-thinking`.

Please answer as a senior systems/programming council member. Assume the user
can approve installations, but we should avoid broad risky upgrades unless they
clearly improve stability. Favor small reversible steps.

Questions:

1. What should we improve first in this Windows host for Codex-agent work?
2. Should we update PowerShell, Git, Chocolatey, install winget, install a WSL
   distro, or rely on the existing Docker `agent-shell`? Rank by value/risk.
3. What should be installed via Chocolatey, what via official installers, what
   via Docker, and what should be left alone?
4. How should we reduce PowerShell friction while still keeping Windows host
   scripts maintainable?
5. What should move into the Unix-like `agent-shell`, and what should remain on
   the Windows host?
6. What health checks or "doctor" script should we add so the agent can diagnose
   environment drift without burning context?
7. Are the Bothub models listed above enough for serious programming/system
   architecture conclaves, or should we expect gaps despite the catalog names?
8. What should we explicitly not do on an older laptop?

End with:

- `Top 5 actions`
- `Do not touch yet`
- `One invariant for the Windows hut`
