# Restore Kit

This folder is the local recovery plan for the Windows AI hut.

The goal is not to back up every cache or Docker layer. The goal is to keep
enough trusted state to rebuild the working setup after disk, Windows, or Docker
trouble.

## Backup Layers

### GitHub

Use a private repository for reproducible project state:

- `scripts/`
- `agent-shell/`
- `codewhale/`
- `stateful-agent-net/`
- `outputs/*.md`
- `.env.example`
- `RESTORE.md`

Do not commit secrets or local state:

- `.env.local`
- `.env`
- `.env.*` except `.env.example`
- `.codewhale-home/`
- `work/`
- `tmp/`
- Docker volumes
- raw AutoMem database files

### Google Drive

Use Drive for timestamped archives and larger snapshots:

- safe workspace archives from `scripts/backup-safe.ps1`
- optional AutoMem API backup tarballs
- sanitized Codex config snapshots
- notes and restore manifests

### AutoMem

AutoMem has two separate backup needs:

- semantic memories and graph/vector data through the AutoMem `/backup` API
- local operating instructions through this repository and restore kit

The safe backup script can include an AutoMem API backup if an admin token is
available.

## Create A Safe Archive

From the project root:

```powershell
.\scripts\backup-safe.ps1
```

Dry run:

```powershell
.\scripts\backup-safe.ps1 -DryRun
```

Include AutoMem API backup if an admin token is available:

```powershell
$env:AUTOMEM_ADMIN_TOKEN = "<admin-token>"
.\scripts\backup-safe.ps1 -IncludeAutoMemApi
```

The script writes archives to `backups/`, which should be copied to Google
Drive. It intentionally excludes secrets and heavy generated folders.

## Restore Order

1. Install Docker Desktop and enable WSL2 backend.
2. Install Git, Node.js, and PowerShell 7.
3. Restore this repository or unpack the latest safe archive.
4. Prefer restoring local secrets through Infisical. Recreate `.env.local` from
   `.env.example` only as an ignored emergency fallback; never restore it from a
   shared archive.
5. Start AutoMem:

   ```powershell
   .\scripts\automem-start.ps1
   .\scripts\automem-status.ps1
   ```

6. Rebuild local helper containers if needed:

   ```powershell
   docker compose -f agent-shell\docker-compose.yml build
   docker build -t codewhale-agent:latest .\codewhale
   ```

7. Restore or reconnect Codex MCP config:

   - AutoMem MCP server as `memory`
   - Docker MCP server as `MCP_DOCKER`
   - profile `codex_safe_ai_coding`

8. Run:

   ```powershell
   .\scripts\doctor.ps1
   ```

## Current Known Caveats

- The workspace `.git` directory is empty, so this folder is not currently a
  healthy Git repository.
- Docker CLI often needs the normal/elevated Windows user context.
- Docker Model Runner is enabled with `llama.cpp`, but no local models are
  pulled yet.
- `docker model df` previously returned `500 Internal Server Error`; do not rely
  on it as the only disk usage signal.
