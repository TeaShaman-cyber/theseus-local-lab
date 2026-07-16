# WSL IDE Baseline

Theseus uses Windows VS Code as the editor and a Remote WSL workspace as the
Linux-native execution environment. This preserves the familiar VS Code surface
without maintaining a second GUI editor inside WSL.

## One-time editor setup

1. Install `ms-vscode-remote.remote-wsl` and `openai.chatgpt` in Windows VS
   Code.
2. Enable `chatgpt.runCodexInWindowsSubsystemForLinux`.
3. Reload VS Code, then use `Remote-WSL: Open Folder in WSL` for Linux-native
   projects under `/home/poklad/...`.

Keep project sources in the WSL filesystem once a project is migrated. The
`/mnt/c` copy is a compatibility fallback and is slower for large dependency or
graph workloads.

## Ubuntu baseline

`install_baseline.mjs` installs the narrow command-line tools used by the
editor and Theseus tasks: Bubblewrap, Git, ripgrep, fd, jq, ShellCheck, shfmt,
Python venv/pip, and build tools.

Run it only through Infisical so the Ubuntu credential stays process-local:

```text
tools/infisical_cli/node_modules/.bin/infisical.cmd run --env=local --path=/infra -- node tools/wsl_ide/install_baseline.mjs
```

The installer emits JSON progress records and never prints the credential.
