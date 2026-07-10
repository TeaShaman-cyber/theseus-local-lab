# VS Code Workspace Setup

This repo treats VS Code as the visual IDE layer for the Theseus local lab.
Codex remains the engineering agent; VS Code provides navigation, previews,
tasks, Git visibility, Docker visibility, and a calmer visual workspace.

## Current Audit

Checked from Codex on 2026-07-10:

- VS Code updated: `1.126.0`
- Current useful installed extensions:
  - Docker
  - GitHub Pull Requests
  - GitLens
  - Markdown All in One
  - Markdown Mermaid
  - Markdownlint
  - Python / Pylance
  - PowerShell
  - Remote Containers
  - Remote WSL
  - Russian language pack
  - ShellCheck
  - Shell Format
  - Spell checker with English and Russian dictionaries
  - YAML
  - Rainbow CSV
- Removed legacy/noisy extensions:
  - GitLab workflow, notifications, pipeline monitor, CI validator
  - Ansible
  - old Bash packs and shell snippets
  - Atom keybindings
  - Jupyter pack
  - Prometheus and XML extensions

`.vscode/extensions.json` records the lean extension set for this repo.

## Recommended Role

- Use Explorer and Markdown Preview for `TASKS.md`, `AGILE.md`,
  `VISUAL_MAP.md`, and `MODEL_LIMITATIONS.md`.
- Use Source Control for reviewing Codex commits before pushing.
- Use Tasks for routine local checks instead of asking Codex to type commands
  every time.
- Use Docker extension for observing AutoMem, observatory, and backup-runner
  containers.
- Use Mermaid preview through Markdown preview or the Mermaid extension.
- Use spellcheck and linters as a quiet external sensor layer. They are allowed
  to correct Codex and user text because their rules update independently from
  model weights.
- Treat VS Code as the visual control surface; Codex remains the agent that
  edits, verifies, commits, and records durable decisions.

## Workspace Tasks

Open Command Palette and run `Tasks: Run Task`.

Available tasks:

- `Theseus: git status`
- `Theseus: AutoMem status`
- `Theseus: Observatory status`
- `Theseus: Backup runner status`
- `Theseus: Export CodeWhale context`
- `Theseus: Create data backup now`

## Codex Integration Boundary

No official OpenAI Codex VS Code extension was installed. Avoid random
marketplace extensions that claim to be Codex integrations unless they are
verified and explicitly chosen.

The integration is repo-native:

- Codex writes and commits files.
- VS Code shows the workspace, diffs, Mermaid maps, Docker containers, and Git.
- `.vscode/tasks.json` exposes common Codex-adjacent checks as visual commands.
- GitHub Desktop or VS Code Source Control can push after Codex commits.
- AutoMem remains accessed through Codex/MCP, not through VS Code extensions.

## Left-Handed / Visual Workflow

Keep the left sidebar focused on:

1. Explorer
2. Source Control
3. Docker

Pin these files near the top of a VS Code workspace session:

- `VISUAL_MAP.md`
- `TASKS.md`
- `AGILE.md`
- `MODEL_LIMITATIONS.md`

This gives the user a visual control surface while Codex keeps the repo,
memory, Docker, and backups consistent.
