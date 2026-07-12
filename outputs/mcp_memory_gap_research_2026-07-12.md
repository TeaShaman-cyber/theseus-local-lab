# MCP Memory Gap Research - 2026-07-12

## Goal

Make AutoMem + MemPalace the default memory stack for Theseus agents. MCP memory
must be tried first; local notes, command-line searches, and repo artifacts are
fallbacks only when the MCP layer is unavailable.

## External Docs Checked

- OpenAI Codex config reference: MCP stdio servers use
  `mcp_servers.<id>.command`, `args`, `cwd`, `env`, `enabled`,
  `required`, `startup_timeout_sec`, and `tool_timeout_sec`.
- OpenAI customization docs: MCP servers provide tools/resources/prompts; skills
  define the workflow and name the MCP tools to use.
- AutoMem `mcp-automem` docs: Codex setup expects `[mcp_servers.memory]` in
  `~/.codex/config.toml`; optional but recommended Codex memory rules are added
  with `npx @verygoodplugins/mcp-automem codex`.
- MemPalace docs: MemPalace ships `mempalace-mcp`; Docker images default to MCP
  over stdio with `docker run -i --rm -v mempalace-data:/data mempalace`.

## Current Local State

### AutoMem

Current `C:\Users\s.poklad\.codex\config.toml` has:

```toml
[mcp_servers.memory]
command = "node"
args = ["...\\work\\mcp-automem-bridge\\node_modules\\@verygoodplugins\\mcp-automem\\dist\\index.js"]

[mcp_servers.memory.env]
AUTOMEM_API_URL = "http://127.0.0.1:8001"
AUTOMEM_API_KEY = "<placeholder>"
```

Observed runtime: `mcp__memory.check_database_health` is healthy, with FalkorDB
and Qdrant connected and memory/vector counts synced.

Gap: AutoMem is connected, but the behavior protocol is not first-class enough.
The server is not marked `required`, timeouts are not tuned, and the project did
not have a dedicated memory-stack skill before this pass.

### MemPalace

Local repo and image artifacts exist under:

- `work/mempalace-pilot/`
- `work/mempalace-pilot/docker-compose.yml`
- Docker image target `theseus-mempalace:pilot`
- Persistent volume `theseus-mempalace-data`

The image Dockerfile defaults to `CMD ["mcp"]`, so it can be used as an MCP
stdio server. Current local guide for juniors, however, uses commands such as:

```powershell
docker compose -f work\mempalace-pilot\docker-compose.yml run --rm mempalace search "..."
```

Gap: MemPalace is present as a Docker/CLI pilot, but it is not registered in
`~/.codex/config.toml` as an MCP server, and no `mcp__mempalace` tools are
visible in the current Codex session.

## Recommended Config Direction

Keep AutoMem enabled and add operational settings:

```toml
[mcp_servers.memory]
command = "node"
args = ["C:\\Users\\s.poklad\\Documents\\Codex\\2026-07-08\\life-science-research-plugin-life-science-4\\work\\mcp-automem-bridge\\node_modules\\@verygoodplugins\\mcp-automem\\dist\\index.js"]
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 90
```

Add MemPalace as an MCP stdio server after a smoke test from the same execution
context that Codex will use. Do not point the permanent MCP server at the old
pilot corpus or `/data/palace`; keep the first permanent setup clean and fast:

```toml
[mcp_servers.mempalace]
command = "docker.exe"
args = ["run", "-i", "--rm", "-v", "theseus-mempalace-clean:/data", "theseus-mempalace:pilot"]
enabled = true
startup_timeout_sec = 60
tool_timeout_sec = 120
```

Do not set `required = true` until both services survive restarts reliably on
this laptop. Strict mode can block Codex startup/resume and remove the fallback
path entirely.

## New Project Skill

Added `.agents/skills/theseus-memory-stack/SKILL.md` to encode the policy:

- AutoMem health + recall before non-trivial Theseus work.
- MemPalace MCP search before answering about prior work or exact old context.
- Local fallback only when the MCP layer is unavailable and the degraded mode is
  stated plainly.
- Store only durable decisions/corrections/patterns/root causes.

## Next Practical Step

Apply a small global `config.toml` patch through the VS Code task:

- `Terminal -> Run Task -> Theseus Memory: apply Codex MCP config`

The task runs `tools/memory_stack/apply_codex_config.mjs`, creates a timestamped
backup of `C:\Users\s.poklad\.codex\config.toml`, and applies:

1. AutoMem timeouts and `enabled = true`.
2. MemPalace MCP server entry.
3. Restart Codex.
4. Verify tool visibility:
   - AutoMem: `mcp__memory.check_database_health`
   - MemPalace: `mempalace_status` or equivalent exposed MCP tool.

If MemPalace fails to load through Docker stdio, test the alternative native
route from the MemPalace docs: install the CLI with `uv tool install mempalace`
or `pipx install mempalace`, then configure `command = "mempalace-mcp"`.
