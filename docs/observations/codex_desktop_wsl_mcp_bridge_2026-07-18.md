# Windows Desktop does not surface a healthy WSL stdio MCP server

Upstream report: https://github.com/openai/codex/issues/33965

## Summary

On Windows, Codex Desktop did not expose the tools of a healthy stdio MCP
server launched through `wsl.exe`, although the same configuration was enabled
in `codex mcp list` and the exact server command completed a full MCP protocol
probe. This resembles the existing WSL spawn-bridge reports, but the server in
this reproduction is Docker-backed and does not require Node or Python on the
Windows host.

## Environment

- Codex Desktop Windows: `26.715.3651.0`
- Codex CLI: `0.144.1`
- WSL distribution: Ubuntu 24.04
- Docker Desktop engine: 29.6.1
- MemPalace container: 3.5.0

## Sanitized configuration

```toml
[mcp_servers.mempalace]
command = "wsl.exe"
args = ["-d", "Ubuntu-24.04", "--", "docker", "run", "-i", "--rm",
        "-v", "theseus-mempalace-clean:/data", "theseus-mempalace:pilot"]
enabled = true
startup_timeout_sec = 60
tool_timeout_sec = 120
```

## Evidence

1. `codex mcp get mempalace` reported the server as enabled using stdio.
2. Running the exact launcher independently completed MCP `initialize`, then
   `notifications/initialized`, then `tools/list`.
3. The response identified MemPalace 3.5.0 and returned 36 tools.
4. In the running Desktop task, no `mempalace_*` tools were surfaced, while
   other configured MCP tools were available.
5. A bounded Windows process/network snapshot found Codex Desktop, its
   code-mode host, Docker Desktop, and expected local service listeners alive;
   it did not indicate a Docker or WSL outage.

## Candidate workaround

The same container and volume pass the identical full MCP probe when launched
with native `docker.exe` instead of `wsl.exe`:

```toml
[mcp_servers.mempalace]
command = "docker.exe"
args = ["run", "-i", "--rm", "-v", "theseus-mempalace-clean:/data",
        "theseus-mempalace:pilot"]
```

This removes only the Desktop-to-WSL process hop. It preserves the volume and
MCP server. Desktop reload verification is still pending after a full restart,
so this is a candidate workaround rather than a confirmed product fix.

## Expected behavior

When `codex mcp list` reports an enabled stdio server and the exact command
successfully completes `initialize` and `tools/list`, Codex Desktop should
surface the server tools or provide a visible startup error with captured
stderr.

## Related reports

- #21147: Windows Desktop WSL mode launches a Windows app-server path.
- Discussion #5471: MCP servers work from WSL CLI but are not detected in the
  Windows IDE/WSL bridge.
