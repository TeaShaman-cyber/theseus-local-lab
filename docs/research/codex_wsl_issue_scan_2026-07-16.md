# Codex WSL Issue Scan 2026-07-16

Purpose: identify known OpenAI Codex Windows/WSL migration risks before moving
the Theseus agent runtime again.

## Query

Used GitHub CLI against `openai/codex` with focused searches:

```text
WSL in:title,body
Windows WSL in:title,body
sandbox WSL in:title,body
```

The result set is high-signal: many open issues describe the same classes we
hit locally.

## High-Signal Issues

| Issue | Status | Relevance |
|---|---|---|
| [#31426](https://github.com/openai/codex/issues/31426) | Open | `CODEX_HOME` on `/mnt/c` can break WSL SQLite/socket state initialization. |
| [#18506](https://github.com/openai/codex/issues/18506) | Open | UNC cwd, Windows config leaking into WSL, and need for WSL-native `CODEX_HOME`. |
| [#32733](https://github.com/openai/codex/issues/32733) | Open | Windows `TEMP/TMP` forwarded through `WSLENV` can break Linux tooling on DrvFS. |
| [#31049](https://github.com/openai/codex/issues/31049) | Open | WSL-native mode can hide Chrome bridge and pass Windows attachment paths to Linux agent. |
| [#30288](https://github.com/openai/codex/issues/30288) | Open | Cold WSL timeout can fall back to Windows app-server and hide WSL project chats. |
| [#32902](https://github.com/openai/codex/issues/32902) | Open | WSL switch can fail during provisioning, then hide returned thread history. |
| [#27553](https://github.com/openai/codex/issues/27553) | Open | Agent environment set to WSL but commands still fail in WSL workspace. |
| [#30435](https://github.com/openai/codex/issues/30435) | Open | Bad cwd plus Chrome/Computer Use unavailable in WSL agent mode. |
| [#32323](https://github.com/openai/codex/issues/32323) | Open | PR integration can fail in WSL through `gh` parsing. |
| [#33047](https://github.com/openai/codex/issues/33047) | Open | VS Code extension can hang in WSL while stuck on Installing. |

## Local Findings

Fresh preflight now exists:

```text
node tools/wsl_migration_preflight/wsl_migration_preflight.mjs
```

It checks:

- Windows Node.
- Windows Docker socket proxy.
- WSL Node/Git/GitHub CLI.
- WSL visibility of active `D:\theseus-*` projects.
- WSL Docker socket proxy at `http://127.0.0.1:23760`.
- WSL SSH agent socket.
- WSL VS Code CLI.
- Codex hook JSON parse state.
- Global Codex config portability markers.
- VS Code task portability markers.
- WSL `CODEX_HOME`, `WSLENV`, `TEMP/TMP`, and `XDG_RUNTIME_DIR`.

Current result: WSL migration is possible only as a guarded pilot, not as the
default route yet.

Confirmed OK:

- WSL sees Node, Git, and GitHub CLI.
- WSL sees active `D:\theseus-*` project folders.
- WSL can reach the read-only Docker socket proxy on `127.0.0.1:23760`.
- The proxy blocks Docker writes with HTTP 403.
- WSL sees VS Code CLI.
- Project and global hook JSON parse.

Current warnings:

- WSL SSH agent is installed, but no active `SSH_AUTH_SOCK` is visible.
- Global Codex config still contains Windows-local monolith paths and raw
  `127.0.0.1:2375`.
- VS Code tasks still contain raw `127.0.0.1:2375` routes.

## Pre-Migration Fix List

1. Add a persistent WSL SSH-agent bootstrap or bridge.
2. Keep GitHub CLI HTTPS auth as the immediate WSL Git fallback.
3. Move or generate WSL-native Codex runtime/cache config before making WSL the
   default agent environment.
4. Keep browser, Computer Use, Chrome, and attachment-path workflows in the
   Windows context unless WSL mapping is proven.
5. Replace read-only Docker status paths with the socket-proxy route
   `127.0.0.1:23760`.
6. Leave raw `127.0.0.1:2375` marked as Windows-only privileged legacy bridge.
7. Run the preflight after every Codex update, environment switch, or project
   split migration.

## Decision

Do not attempt a full WSL move until the SSH-agent and config portability
warnings are either fixed or explicitly accepted as pilot constraints.

Use WSL today for:

- checked-in scripts;
- Graphify and Unix-style corpus processing;
- read-only Docker observability through socket proxy;
- GitHub CLI checks via existing WSL `gh` auth.

Do not use WSL today as the only home for:

- Codex runtime state;
- browser/computer-use workflows;
- privileged Docker writes;
- secret handling;
- long task history migration.
