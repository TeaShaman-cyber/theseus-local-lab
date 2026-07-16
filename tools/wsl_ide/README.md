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

## Guarded Codex pilot

`bootstrap_codex_pilot.mjs` prepares a separate Linux checkout at
`/home/poklad/theseus-local-lab` and a WSL-only Codex profile named
`theseus-pilot`. It does not change the desktop agent environment or overwrite
the Windows Codex configuration.

The profile starts with two local, credential-free routes:

- MemPalace through the existing Docker volume;
- Theseus Docker control plane through WSL's native Docker socket.

AutoMem is deliberately not written into the profile because its API key must
remain in Infisical. The next migration step is a process-local secret launcher,
not duplicating the key into `~/.codex`.

The compatible AutoMem MCP package is installed in
`/home/poklad/.cache/theseus-mcp/mcp-automem`, outside the Git checkout. This
keeps the pilot reproducible without relying on an ignored Windows
`node_modules` folder.

```text
node tools/wsl_ide/bootstrap_codex_pilot.mjs --dry-run
node tools/wsl_ide/bootstrap_codex_pilot.mjs
```

After the bootstrap, validate the profile from WSL:

```text
cd /home/poklad/theseus-local-lab
/home/poklad/.local/bin/codex -p theseus-pilot mcp list
```

Use the explicit Linux binary in non-interactive WSL automation. Some inherited
Windows `PATH` variants resolve `codex` to the Windows npm shim instead.

Run the smoke check after signing the native WSL CLI into the same ChatGPT
account:

```text
node tools/wsl_ide/wsl_pilot_smoke.mjs
```

The smoke check proves the Linux Codex binary, login state, Docker socket, and
the existing hook router separately. It intentionally returns `WARN` until the
native CLI is authenticated; a profile file alone is not treated as runtime
proof.
