status: READ_BACK_VERIFIED
operation: create
project: theseus-local-lab
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 84772
purpose: Bug report — MCP tools not registered in main dispatch after lazy load; only callable via tool_call, not direct invocation.
approval_scope: publish bug report to NousResearch/hermes-agent via gh issue create (one operation), then read-back.
observed: https://github.com/NousResearch/hermes-agent/issues/84772
verified_at: 2026-08-12T21:30:00+03:00

## Title
[Bug]: MCP tools missing from main tool dispatch after lazy load (callable only via tool_call)

## Description
When an MCP server (e.g. `automem`) is configured and `hermes mcp test` reports "Connected" with N tools discovered, the tools are NOT registered in the agent's main tool dispatch. Direct invocation of `mcp__<server>__<tool>` fails with "Tool '<name>' does not exist", while `tool_call(name=...)` and `tool_search` both succeed.

Observed with `mcp__automem__store_memory` on Hermes (Windows 11, 2026-08-12):
- `hermes mcp test automem` → ✓ Connected, 6 tools discovered.
- `tool_search` for `mcp__automem__store_memory` → finds it (description indexed).
- Direct call `mcp__automem__store_memory(...)` → "Tool does not exist. Available tools: [list without automem]".
- Same call via `tool_call(name="mcp__automem__store_memory", ...)` → succeeds, writes memory.

## Steps to Reproduce
1. Configure an MCP server (stdio, e.g. `npx @verygoodplugins/mcp-automem` or any).
2. Restart Hermes session.
3. Run `hermes mcp test <server>` → confirm Connected + tools discovered.
4. Attempt to call `mcp__<server>__<tool>` directly as a tool → observe "Tool does not exist".
5. Call the same tool via `tool_call(name=...)` → observe success.

## Expected Behavior
A discovered MCP tool should be callable both directly (as `mcp__server__tool`) and via `tool_call`. The main dispatch registry and the MCP registry should be the same source of truth.

## Actual Behavior
MCP tools are reachable via `tool_call` / `tool_search` but not via direct invocation. The main dispatch table is not updated with MCP tools after lazy load, causing a desync between the search index / tool_call backend and the primary tool dispatcher.

## Affected Component
- Tools (terminal, file ops, web, code execution, etc.)
- Agent Core (conversation loop, context compression, memory)

## Environment
- OS: Windows 11 Pro
- Hermes Version: v0.20.0 (2026.8.3) · upstream 7113a692 · local ed5e17f4
- Python Version: 3.11.15
- Node Version: v24.18.0 (MCP stdio runtime)
- MCP transport: stdio → npx
- MCP server: @verygoodplugins/mcp-automem (also likely affects any stdio MCP)

## Debug Report
NOT ATTACHED — `hermes debug share` was deliberately not run. Reason: the debug share uploads the **verbatim content of recent chat messages** (prompts, responses, tool output) to a public paste service. This bug was discovered mid-session after a long multi-topic conversation (unrelated AutoMem/Hermes setup, Docker/Infisical changes, issue-publishing process recovery); the captured transcript would include large amounts of unrelated PII and private discussion, not just the minimal repro. We consider that disproportionate for a bug with a clean, self-contained reproduction (see Steps to Reproduce). Local `hermes debug share --local` dump (no upload) confirmed environment below. If maintainers need the full share, we can produce a minimal isolated repro session and attach it on request.

Local debug dump (from `hermes debug share --local`):
- Hermes: v0.20.0 [ed5e17f4] (2026-08-11)
- OS: Windows 10 AMD64 (host reports Windows 11 Pro)
- Python: 3.11.15
- Node: v24.18.0 (MCP stdio runtime)
- MCP transport: stdio → npx
- MCP server: @verygoodplugins/mcp-automem
- github key: set (auth OK)

## Hypothesis
Hermes builds the available-tools list for the session before the MCP server finishes lazy initialization (npx cold start ~6-11s). The MCP tools are registered in the backend used by `tool_call`/`tool_search`, but the primary dispatch table shown to the agent is not refreshed, so direct calls fail. A full Hermes restart sometimes resolves it (tools appear), confirming a load-timing / registration-desync issue rather than a config error.

## Proposed Fix
- Block session tool-list finalization until all enabled MCP servers report ready (or refresh dispatch table after MCP init completes).
- Or expose MCP tools in the primary dispatch the same way they are exposed to `tool_call`.

## Additional Logs / Traceback
Direct-call failure (verbatim):
  Tool 'mcp__automem__store_memory' does not exist. Available tools: [bfl_flux3_*, browser_exec, clarify, computer_use, cronjob, delegate_task, execute_code, image_generate, memory, patch, process, read_file, search_files, session_search, skill_manage, skill_view, skills_list, terminal, text_to_speech, todo, tool_call, tool_describe, tool_search, vision_analyze, web_extract, web_search, write_file]
Note: the list above excludes mcp__automem__* even though `hermes mcp test` reports them discovered.

## Signature
Prepared collaboratively by Semyon Poklad and Svarog, an AI engineering agent and engineering partner.
Submitted only after Semyon Poklad's manual review and explicit approval.
