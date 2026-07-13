# Vim Workbench Fallback Plan

Date: 2026-07-13

## Intent

Explore vi/vim/neovim as a lightweight alternative workbench to VS Code for
Theseus local lab, especially for Unix-like environments, SSH sessions, WSL,
and the future Ubuntu VM path.

This is not a rejection of VS Code. VS Code remains useful for tasks, AHP,
Copilot, visible UI, and user-friendly workflows. Vim is the fallback and
portable operator console.

## Why This Matters

The project has repeatedly hit friction around:

- Windows shell behavior.
- GUI/IDE permission boundaries.
- VS Code/AHP availability and task invocation.
- SSH and WSL transitions.
- Long-lived agent work where a small, scriptable terminal surface may be more
  stable than a large GUI.

Vim/neovim gives a tiny, portable, low-resource editing layer that works well
over SSH and inside containers/VMs.

## Candidate Roles

- Emergency editor when VS Code integration is unavailable.
- Default editor inside Ubuntu VM or future Unix-like agent forge.
- Fast inspection/editing of config, markdown plans, logs, and scripts.
- Terminal-native companion for tmux, git, Docker, and SSH workflows.
- Possible agent-facing workbench when actions should be file/task based rather
  than GUI based.

## Non-Goals

- Do not migrate away from VS Code immediately.
- Do not build a full custom IDE.
- Do not add a large plugin stack.
- Do not make Vim depend on secrets or private credentials.
- Do not force the human user to become a Vim power user.

## Phase 0 - Decide Minimal Baseline

Choose one practical baseline:

- `vim` for maximum availability and simplicity.
- `neovim` if we want better LSP/plugin ergonomics later.

Keep the first profile small:

- sensible defaults;
- line numbers;
- search highlighting;
- safe clipboard behavior;
- markdown, JSON, YAML, shell, Python, and JavaScript syntax;
- no heavy plugin manager until justified.

## Phase 1 - Portable Config

Create a small tracked config template:

- `tools/vim_workbench/README.md`
- `tools/vim_workbench/init.vim` or `vimrc`
- optional install/copy script for VM/WSL

The config should be safe to copy into:

- Ubuntu VM home directory;
- WSL home directory;
- a container workbench;
- MobaXterm/SSH environment where practical.

## Phase 2 - Workbench Pattern

Define repeatable workflows:

- edit plan or config;
- run shell command in adjacent terminal/tmux pane;
- write timeline event;
- check git diff/status;
- ask Codex/agent to inspect the file result.

The goal is not keyboard wizardry. The goal is stable observable work.

## Phase 3 - Agent Integration

Investigate whether Vim/neovim can support agent workflows through:

- file-based task queues;
- terminal/tmux sessions;
- minimal RPC or socket bridge if needed;
- git diff as the shared truth;
- Log Lattice timeline events for action records.

Prefer file/task protocols over fragile GUI automation.

## Phase 4 - Evaluation

Test against concrete failure modes:

- VS Code unavailable;
- AHP not reachable;
- Windows GUI unavailable;
- SSH-only VM session;
- low bandwidth/mobile internet;
- old laptop under memory pressure.

Success means the agent and user can still inspect, edit, validate, and
checkpoint work without VS Code.

## First Next Step

Inventory available editors in Windows, WSL, Docker containers, and the Ubuntu
VM. Then decide whether `vim` or `neovim` is the first baseline.

