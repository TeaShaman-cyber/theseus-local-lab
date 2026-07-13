# WSL/Codex Sandbox Limitations - 2026-07-13

## Context

This note records the practical limits observed while moving the Codex desktop agent from the Windows runtime into the WSL runtime for the Theseus local lab.

The goal was to reduce Windows/PowerShell friction and work from a Unix-like environment while keeping AutoMem, Docker Desktop, VS Code, and project files usable.

## Confirmed Findings

- In the WSL Codex agent runtime, `/tmp` was writable, but `/home/poklad` and `/mnt/c/...` were not writable from the agent sandbox.
- The real project under `C:\Users\s.poklad\Documents\Codex\2026-07-08\life-science-research-plugin-life-science-4` could be read through `/mnt/c/...`, but could not be modified from that WSL sandbox.
- The Codex WSL workspace root was mapped through a broken WindowsApps-style path, not as the normal WSL project path.
- Normal user WSL could run `docker ps`, `node.exe --version`, and see WSLInterop, but the Codex WSL sandbox could not access the same capabilities.
- In the Codex WSL sandbox, WSLInterop-related checks failed or were absent, and Docker/localhost service access did not match the normal user WSL terminal.
- `curl http://127.0.0.1:8001/health` behaved differently between normal user WSL and the Codex WSL sandbox, proving a split-context problem rather than a simple AutoMem service failure.

## AutoMem Evidence

- AutoMem MCP is currently healthy from the Windows Codex runtime:
  - FalkorDB connected.
  - Qdrant connected.
  - Memory count: 126.
  - Vector count: 126.
  - Vector dimensions: 1024 configured and 1024 effective.
  - Sync status: synced.
- The current `work/automem/.env` contains:
  - `EMBEDDING_PROVIDER=local`
  - `VECTOR_SIZE=1024`
- Older `C:\Users\s.poklad\log.txt` entries show the previous AutoMem container auto-selected OpenAI embeddings and hit `429 insufficient_quota`.
- The same older log also shows `/health` returned `200` at least once, so the service was not simply dead; the main observed failure was the embedding provider/quota path.

## Current Windows Runtime Boundary

- After returning Codex to the Windows runtime, project file writes are available again inside the configured workspace.
- Docker named-pipe access from the Codex Windows runtime failed with:
  - `Error loading config file: open C:\Users\s.poklad\.docker\config.json: Access is denied.`
  - `permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine`
- This boundary is now partially bypassed by Docker Desktop TCP exposure:
  - `DOCKER_HOST=tcp://127.0.0.1:2375`
  - `tools/docker_control_plane/direct_bridge.mjs`
  - `mcp__theseus_docker` health and `docker_ps` checks succeeded after Codex restart.
- Therefore, the preferred current Docker path is the allowlisted `theseus_docker` MCP bridge over TCP, not the named pipe.
- This does not prove the WSL runtime is ready. It proves a stable Windows-runtime Docker control path for the current workspace.

## Working Interpretation

The WSL attempt was useful as a diagnostic boundary test, but it was not a successful migration of the primary Codex runtime.

The problem is not just WSL itself. The problem is the combination of:

- Codex sandbox writable-root restrictions,
- WindowsApps path mapping,
- split WSL user vs Codex sandbox capabilities,
- Docker Desktop access differences,
- and incomplete workspace remapping when moving a long-running task into WSL.

## Recommended Direction

Do not treat the current WSL mode as the main workbench yet.

Preferred next architecture:

1. Keep the current long Codex task as the coordination/history thread.
2. Create a clean Unix-like workspace separately:
   - WSL-native ext4 path, VHDX-backed ext4 disk, or Ubuntu VM.
3. Open that exact Unix-like path as a fresh Codex workspace.
4. Verify before migration:
   - writable project root,
   - Git status and push,
   - Docker access,
   - VS Code Remote or equivalent,
   - AutoMem MCP health,
   - MemPalace MCP search,
   - backup path.
5. Only then move practical engineering work there.

## Durable Rule

Config visibility is not runtime proof. For this lab, every environment migration must prove:

- Can the agent write the project?
- Can the agent read and write Git state?
- Can the agent reach Docker or the chosen container runtime?
- Can the agent call AutoMem and MemPalace?
- Can the user reproduce the same result from their normal terminal?

If any one of these differs between user terminal, VS Code, Docker Desktop, WSL, VM, and Codex sandbox, treat it as a split-context boundary rather than a normal bug.
