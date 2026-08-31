# AutoMem Lab Journal

Purpose: temporary working memory for setting up AutoMem on this computer before the real memory system is available.

Last updated: 2026-07-08

## Current State

- Goal: set up `verygoodplugins/automem` as a local or cloud-backed long-term memory service for Codex and other AI tools.
- Preferred first path: local setup on this Windows computer, then connect Codex through MCP.
- AutoMem repository is cloned locally at `work/automem`.
- AutoMem Docker stack is running.
- AutoMem API health endpoint is reachable from Codex at `http://127.0.0.1:8001/health`.
- FalkorDB browser should be available at `http://127.0.0.1:3000`.
- Qdrant HTTP endpoint is available at `http://127.0.0.1:6333`.
- Git is available in the Codex shell.
- Docker CLI, Docker Compose, Node.js, npm/npx, and Git are now available in the Codex shell.
- Docker Desktop and Docker Engine are running. Docker CLI access from the Codex sandbox remains restricted, but elevated/normal Docker context works.
- Python and the `py` launcher are not currently available in PATH.
- WSL2 backend is active through Docker Desktop.
- Computer Use plugin was successfully connected and could see Windows apps.
- Browser automation stopped because the helper could not verify the current Opera URL confidently enough.
- User is manually downloading/installing required software.

## Required Pieces

- Docker Desktop: needed for local FalkorDB, Qdrant, and AutoMem API.
- Node.js LTS: needed for `npx @verygoodplugins/mcp-automem`.
- Git: already detected.
- Optional Python 3.10+ / 3.12: useful for bare development, but Docker path can be first.

## Important Links

- AutoMem repository: https://github.com/verygoodplugins/automem
- AutoMem install guide: https://github.com/verygoodplugins/automem/blob/main/INSTALLATION.md
- MCP bridge repository: https://github.com/verygoodplugins/mcp-automem
- MCP install guide: https://github.com/verygoodplugins/mcp-automem/blob/main/INSTALLATION.md
- Docker Desktop: https://www.docker.com/products/docker-desktop/
- Node.js downloads: https://nodejs.org/en/download

## Intended Local Setup

1. Install Docker Desktop. Done.
2. Install Node.js LTS. Done.
3. Reopen or refresh Codex shell so PATH updates are visible. Done.
4. Verify. Done:

   ```powershell
   docker --version
   docker compose version
   node --version
   npm --version
   git --version
   ```

5. Clone AutoMem. Done at `work/automem`.
6. Start local stack. Done:

   ```powershell
   docker compose up --build
   ```

7. Verify AutoMem API health. Done:

   ```text
   http://localhost:8001/health
   ```

8. Configure MCP for Codex. Next:

   ```powershell
   npx @verygoodplugins/mcp-automem install
   ```

   Local endpoint:

   ```text
   http://127.0.0.1:8001
   ```

## Codex MCP Config Shape

Manual fallback for `C:\Users\s.poklad\.codex\config.toml`:

```toml
[mcp_servers.memory]
command = "npx"
args = ["-y", "@verygoodplugins/mcp-automem"]

[mcp_servers.memory.env]
AUTOMEM_API_URL = "http://127.0.0.1:8001"
```

## Decisions

- Start with local setup rather than Railway unless cross-device access becomes more important.
- Keep this journal short and factual.
- Use this file as the temporary shared memory until AutoMem is running.
- Prefer not to grant broad Docker access to the Codex sandbox unless truly needed. Safer path: run Docker Desktop/Compose as the normal Windows user, then let Codex interact with the AutoMem HTTP API on `localhost:8001`.

## Open Questions

- Should AutoMem stay in this workspace under `work/automem`, or later move to a more stable folder?
- Should the local API use default test tokens for now, or should we set stronger local tokens before deeper use?

## Event Log

### 2026-07-09

- Docker/AutoMem recheck from Codex:
  - Direct Docker CLI inside the normal sandbox is still blocked by Windows/Docker pipe permissions.
  - Elevated/normal Docker context can list running containers.
  - Running containers: `automem-flask-api-1`, `automem-falkordb-1`, `automem-qdrant-1`.
  - AutoMem health endpoint is healthy: FalkorDB connected, Qdrant connected, memory/vector count 49, enrichment running, sync status synced.
- Stateful agent net MVP:
  - Stored the concept in AutoMem as memory `46452572-07ce-4064-9790-40b5614a05f6`.
  - Added a small Docker prototype under `stateful-agent-net`.
  - First scope: NOAA/SWPC space-weather signals, OpenAI public status, and local AutoMem health.
  - Data policy: raw time series stay in SQLite; semantic conclusions and DIFFs go to AutoMem.
  - Packet output path: `outputs/state_packets`.
  - First Docker run succeeded and generated `outputs/state_packets/2026-07-09_034055Z.md`.
  - Local SQLite database created at `stateful-agent-net/data/state.db`.
  - Stored the first-run checkpoint in AutoMem as memory `5c0f0b6a-566e-4b4f-b060-1ea702f5cb44`.
- Bothub heavy model conclave:
  - Prompt saved at `outputs/bothub_conclave_space_weather_prompt_2026-07-09.md`.
  - Raw JSON saved at `outputs/bothub_conclave_space_weather_2026-07-09.json`.
  - Digest saved at `outputs/bothub_conclave_space_weather_digest_2026-07-09.md`.
  - Models: `deepseek-r1-0528`, `claude-opus-4.5`, `gemini-3.1-pro-preview`, `gpt-4.1`, `grok-4.3`; chair `claude-sonnet-4.6`.
  - All stages succeeded: 5 first answers, 5 peer reviews, 1 chair synthesis.
  - Main conclusion: treat the project as a baseline anomaly co-occurrence observatory, not a causal solar-AI claim.
  - Strong invariant: raw time series stay in SQLite; only timestamped DIFFs, quality flags, decisions, and cross-checked conclusions go to semantic memory.
- Windows/script friction log:
  - Added `outputs/windows_and_script_lessons_2026-07-09.md`.
  - Captured Docker pipe permission issues, Windows Store/sandbox identity split, sandbox network restrictions, silent long-running Bothub scripts, and non-standard `.git` behavior.
  - Updated `scripts/bothub-council.ps1` with `-TimeoutSec`, stderr progress logging, and `-Quiet` so long conclaves are less opaque and JSON stdout remains usable.
  - Fixed PowerShell interpolation issues around `$model:` / `$ChairmanModel:` by using `${model}:` form.
  - Forced `stage1` and `stage2` to JSON arrays even for one-model smoke tests.
  - Verified with two Bothub smoke tests:
    - `tmp/bothub-council-progress-smoke.json`
    - `tmp/bothub-council-array-smoke.json`
- Unix-like workbench:
  - WSL component exists, but no Linux distribution is installed.
  - Git Bash works through `C:\Program Files\Git\bin\bash.exe`.
  - Added `scripts/agent-bash.ps1` as a lightweight Git Bash wrapper.
  - Added Docker-backed `agent-shell` with Bash, Git, curl, jq, SQLite, Python, Node, and basic diagnostics.
  - Built and smoke-tested `agent-shell`; it sees the workspace at `/workspace` and reaches AutoMem through `host.docker.internal:8001`.
  - Fixed `scripts/agent-shell.ps1` so command strings run via `bash -lc` instead of being treated as one executable path.
  - Recommendation: use Git Bash for tiny shell tasks; use Docker `agent-shell` for repeatable Linux-style work; postpone WSL distro or full VM until necessary.
- Windows hut improvement conclave:
  - Prompt saved at `outputs/bothub_conclave_windows_hut_prompt_2026-07-09.md`.
  - Raw result saved at `outputs/bothub_conclave_windows_hut_2026-07-09.json`.
  - Digest saved at `outputs/bothub_conclave_windows_hut_digest_2026-07-09.md`.
  - `gpt-5-codex` was listed in Bothub `/models` but returned `403 Forbidden`; catalog presence does not guarantee usable access.
  - Main conclusion: keep Docker `agent-shell` as primary Unix-like workbench, postpone WSL/VM, add `doctor.ps1`, classify/fix empty `.git`.
  - Added `scripts/doctor.ps1`.
  - `doctor.ps1` normal sandbox run: AutoMem and Git Bash ok; Docker/agent-shell fail because of Docker pipe/config permissions; `.git` is empty; Chocolatey CLI is actually `2.7.3`; winget missing in sandbox.
  - `doctor.ps1` approved/elevated run: Docker, agent-shell, AutoMem, Chocolatey, Git Bash, winget all ok; `.git` still empty; `safe.directory` differs by execution identity.
- xAI/Grok and meta-harness:
  - User has obtained an xAI/Grok key.
  - Added safe `.env.example` placeholders for `XAI_API_KEY`, `XAI_BASE_URL`, and `XAI_MODEL`.
  - Added `scripts/xai-models.ps1` and `scripts/xai-chat.ps1`; both read `.env.local` and do not print the key.
  - Added `outputs/meta_harness_concept_2026-07-09.md`.
  - Direction: move from a council of raw model calls to a council of harnessed agents with roles, provider health, budget, input policy, and typed outputs.
- CodeWhale harness candidate:
  - Verified upstream repository `Hmbown/CodeWhale` exists and describes CodeWhale as a terminal coding agent, Rust/MIT, formerly `deepseek-tui`.
  - Upstream docs confirm generic `openai` provider for OpenAI-compatible gateways and config via `[providers.openai] base_url`.
  - Added Docker wrapper `scripts/codewhale.ps1` to run `ghcr.io/hmbown/codewhale:latest` without installing globally on Windows.
  - Wrapper maps Bothub `.env.local` values into CodeWhale-compatible `OPENAI_*` environment variables.
  - Added `codewhale/README.md` and ignored `.codewhale-home/`.
  - Downloaded and ran Docker image `ghcr.io/hmbown/codewhale:latest`; version `codewhale 0.8.67 (737ac9872808)`.
  - `codewhale doctor` succeeded: provider `openai`, base URL `https://openai.bothub.chat/v1`, model `deepseek-chat`, API connection successful.
  - Official CodeWhale image does not include Python/Node, so CodeWhale code/js execution tools are not advertised in that image.
  - Headless smoke test succeeded through Bothub/DeepSeek: `codewhale-ok`.
  - CLI nuance: global flags like `--model` must be placed before `exec`; wrapper injects provider/base-url/model before user args.
  - Built enriched Docker image `codewhale-agent:latest` from `codewhale/Dockerfile`.
  - `.\scripts\codewhale.ps1 -AgentImage doctor` succeeded: CodeWhale `0.8.67`, provider `openai`, Bothub base URL, model `deepseek-chat`, API connection successful.
  - Enriched image now exposes Python `code_execution` and Node.js `js_execution` tools to CodeWhale.
  - Resource caveat: Debian `npm` installation pulled a large dependency tree; keep this as a full worker mode, and prefer the official image for lightweight text-only tasks.
- Docker MCP Toolkit reconnaissance:
  - Docker CLI includes `docker mcp` version `v0.43.1`, plus visible `docker agent`, `docker ai`, and `docker model` commands.
  - Docker MCP Toolkit supports `codex` as a client, but Codex was not connected during this pass.
  - Existing project-wide MCP clients reported by Docker: `claude-code` and `crush` disconnected; `cursor`, `kiro`, and `vscode` have no MCP configured.
  - Starter templates: `ai-coding` (`context7`, `sequentialthinking`), `dev-workflow` (`github-official`, `atlassian-remote`), and `terminal-control` (`desktop-commander`, `filesystem`).
  - Created test profile `codex_safe_ai_coding` from `ai-coding` without connecting it to Codex.
  - Profile servers: remote `context7` and container image `sequentialthinking`.
  - Gateway dry-run succeeded with image verification; enabled servers were `context7` and `sequentialthinking`.
  - Gateway listed 3 external tools (`query-docs`, `resolve-library-id`, `sequentialthinking`) plus internal dynamic `mcp-*` management tools.
  - Resource/safety note: Docker runs `sequentialthinking` with `--cpus 1` and `--memory 2Gb`; this is acceptable for a test, but any Codex connection should use explicit profiles and avoid `terminal-control` by default.
  - Docker Model Runner CLI is present, but `docker model status` reports it is not running; enabling it would be a separate explicit action.
  - Connected Docker MCP Toolkit to Codex globally after Docker reported Codex only supports global configuration.
  - Global Codex MCP server added: `MCP_DOCKER`, command `docker.exe`, args `mcp gateway run --profile codex_safe_ai_coding`.
  - Docker `client ls --global --json` confirms Codex is connected with profile `codex_safe_ai_coding`.
  - Current Codex session likely needs restart before the new `MCP_DOCKER` tools become callable inside Codex.
  - After Codex restart, `MCP_DOCKER` tools are callable from Codex.
  - Verified Docker MCP Context7 path with `resolve-library-id` for Docker docs; selected `/docker/docs`.
  - Docker Model Runner enabled from Docker Desktop UI and is running.
  - Model Runner version: client/server `v1.2.5`; active backend: `llama.cpp latest-cpu`; `diffusers` not installed; `vllm` not available on Windows.
  - No local models are currently pulled; `docker model list` is empty and `docker model ps` shows no running models.
  - `docker model df` returned a `500 Internal Server Error`, so disk usage reporting is not reliable yet.
  - Search-only pass found many Qwen/DeepSeek candidates, but most useful small coder entries are `vllm` and therefore not usable on this Windows runner. First low-risk smoke candidate for the local runner is a tiny `llama.cpp` model such as `hf.co/ggml-org/tiny-llamas` (~145 MB), not a real coding assistant.

### 2026-07-08

- Read AutoMem and MCP documentation from GitHub.
- Confirmed Git is available.
- Confirmed Docker, Python, Node.js, and npm were not available in the shell at that time.
- Connected Computer Use plugin successfully.
- Computer Use listed Windows applications.
- Computer Use did not find Docker or Node among Windows apps.
- Browser automation was stopped by safety policy after URL confidence failed.
- User began manually downloading/installing prerequisites.
- After reboot, environment check found:
  - Git: `2.52.0.windows.1`
  - Docker CLI: `29.6.1`
  - Docker Compose: `v5.2.0`
  - Node.js: `v24.18.0`
  - npm/npx: `11.16.0`
  - Python/py launcher: not found
  - WSL: not installed
  - Docker Desktop processes present, but `docker info` cannot connect to `docker_engine`; `com.docker.service` is stopped.
- Docker recheck:
  - Docker CLI and Compose still available.
  - Docker Desktop processes are running.
  - `docker info` inside Codex sandbox reports permission/access issues; outside sandbox it reports `Docker Desktop is unable to start`.
  - Current Codex shell user is `spoklad\codexsandboxoffline`.
  - Local `docker-users` group contains `poklad`, but the current Codex token groups do not include `docker-users`; it includes `SPOKLAD\CodexSandboxUsers`.
  - Likely next distinction: test Docker from a normal user PowerShell. If it works there but not in Codex, the remaining issue is Codex sandbox access to Docker. If it fails there too, Docker Desktop itself still needs first-run setup, WSL/Hyper-V/virtualization, or service startup.
- Docker setup research with Tavily/offical docs:
  - Docker Desktop on Windows should use WSL 2 backend for this use case.
  - WSL 2, Virtual Machine Platform, and hardware virtualization need to be enabled for WSL-backed Linux containers.
  - `docker-users` membership matters for Docker Desktop permission issues, but Codex runs as `spoklad\codexsandboxoffline`, not the normal `poklad` user.
  - For AutoMem, Codex does not need Docker pipe access if the user starts the stack and exposes the API on `localhost:8001`.
- Account boundary diagnosis:
  - Docker is associated with the local Windows user context.
  - Codex from Windows Store appears to run commands as a separate sandbox identity (`spoklad\codexsandboxoffline`), likely tied to the Store/app container model.
  - This makes direct Docker CLI control from Codex harder and potentially unsafe to force.
  - Preferred workaround remains: user runs Docker/AutoMem locally; Codex talks to AutoMem over `localhost` HTTP.
- Docker is now working for the normal/elevated user context:
  - `docker info` outside the Codex sandbox succeeds.
  - Docker Desktop context: `desktop-linux`.
  - Server version: `29.6.1`.
  - Backend: WSL2 (`Kernel Version: 6.18.33.2-microsoft-standard-WSL2`).
  - Containers/images currently: 0.
  - Codex sandbox still cannot access Docker pipe directly, which is acceptable if AutoMem is started by the user and exposed via HTTP.
  - AutoMem health endpoint `http://127.0.0.1:8001/health` is not responding yet.
- AutoMem setup:
  - Cloned `https://github.com/verygoodplugins/automem.git` into `work/automem`.
  - Ran `docker compose up --build -d` from `work/automem`.
  - Docker pulled `falkordb/falkordb:latest` and `qdrant/qdrant:v1.11.3`.
  - Docker built local image `automem-flask-api`.
  - Running containers:
    - `automem-falkordb-1` healthy, ports `3000`, `6379`
    - `automem-qdrant-1` running, ports `6333`, `6334`
    - `automem-flask-api-1` running, port `8001`
  - `http://127.0.0.1:8001/health` returns `200 OK`; status healthy, FalkorDB connected, Qdrant connected, memory count 0.
  - `http://127.0.0.1:6333/healthz` returns `200 OK`.
- MCP/Codex setup:
  - Added global Codex MCP server block to `C:\Users\s.poklad\.codex\config.toml`.
  - Backup created: `C:\Users\s.poklad\.codex\config.toml.bak-20260708-153648`.
  - MCP server name: `memory`.
  - Command: `npx -y @verygoodplugins/mcp-automem`.
  - Env:
    - `AUTOMEM_API_URL=http://127.0.0.1:8001`
    - `AUTOMEM_API_KEY=test-token`
  - Ran `npx -y @verygoodplugins/mcp-automem install --yes --target existing --endpoint http://127.0.0.1:8001 --api-key test-token --clients codex` from `work/automem`.
  - Installer wrote `work/automem/.env` and updated `work/automem/AGENTS.md` with AutoMem Codex rules.
  - CLI smoke test succeeded: `npx -y @verygoodplugins/mcp-automem recall --query "automem setup smoke test" --limit 3` returned an empty but valid result set from AutoMem.
  - Current Codex session may need restart/new thread before `mcp__memory__*` tools appear, because MCP servers are loaded at session start.
- Post-restart MCP check:
  - `mcp__memory` tools are now visible to Codex.
  - `check_database_health` reports healthy AutoMem backend, FalkorDB connected, Qdrant connected, vector dimensions 1024, enrichment running.
  - Stored first useful memory about the local AutoMem setup.
  - Recalled that memory successfully by query and `automem` tag; memory id `58ffc5fc-5a90-4415-9c76-2f5ea50d5c72`.
- Memory operating rule:
  - Use AutoMem automatically for project context, decisions, preferences, and fixes.
  - If AutoMem is unavailable, continue work without blocking, write important notes to this journal, then retry health checks or restart the Docker stack later.
  - Stored this fallback rule in AutoMem; memory id `274127d1-f904-42c9-9aeb-dc41c817e23b`.
- Initial exocortex import into AutoMem:
  - Sources inspected: ButlerBrain, Notion, Airtable, GitHub.
  - Stored first insight that the user's Codex memory care is part of an exocortex/extended-mind project; memory id `0c01ea47-cc7c-4f19-b3eb-680399de71ac`.
  - Stored 10 source-derived memories covering the exocortex role split, UES v2, UES validation, Crystal Snapshot, Airtable UES/Trace/OSINT bases, and AutoMem/mcp-automem GitHub repos.
  - Stored 6 additional memories covering TID, TID-node architecture, MemPalace, HADI, trace recovery lessons, and the Airtable-confirmed role split.
  - Created graph associations between architecture, methodology, operational tables, GitHub implementation repos, and fallback rules.
  - Verified recall query for the exocortex memory architecture and UES validation setup returned the expected connected memory cluster.
  - Health after import: AutoMem healthy, FalkorDB connected, Qdrant connected, `memory_count=19`, `vector_count=19`, enrichment processed 19 with no queue.
- Local stability/resource optimization:
  - Confirmed `work/automem/docker-compose.yml` already has `restart: unless-stopped` on `falkordb`, `qdrant`, and `flask-api`.
  - Added helper scripts:
    - `scripts/automem-status.ps1`
    - `scripts/automem-start.ps1`
    - `scripts/automem-stop.ps1`
  - `automem-status.ps1` verifies `http://127.0.0.1:8001/health`; Docker CLI status may still require a normal/elevated user shell because Codex runs under a restricted Windows sandbox identity.
  - Installed `@verygoodplugins/mcp-automem@0.15.0` locally under `work/mcp-automem-bridge`.
  - Updated `C:\Users\s.poklad\.codex\config.toml` so `[mcp_servers.memory]` runs `node` with the local `dist/index.js` instead of `npx -y @verygoodplugins/mcp-automem`.
  - Config backup created: `C:\Users\s.poklad\.codex\config.toml.bak-20260708-190409`.
  - Direct smoke test through local `node ...\dist\index.js recall` succeeded.
  - Stored this stability decision in AutoMem; memory id `d7d26a4e-46b4-425b-a209-48761661daf8`.
- Checked installed plugins/connectors:
  - Working smoke tests: GitHub, Google Drive, Notion, Airtable, OpenAI Platform, Wolfram, Deepnote, Todoist, smarts.bio.
  - Computer Use: previously connected successfully and listed Windows apps.
  - Opera Browser Connector: installed, but currently requires reauthentication.
  - BioRender: installed/visible, but smoke test failed with an MCP tool lookup error.
  - Local plugin cache includes: Airtable, BioRender, Deepnote, GitHub, Google Drive, Life Science Research, MarcoPolo, Midpage, NGS Analysis, Notion, OpenAI Developers, Browser, Computer Use.
- Bothub local auxiliary model access:
  - Created `.env.local` for local secrets and `.env.example` for a safe template.
  - Added `.gitignore` rules for `.env` and `.env.*`, while keeping `.env.example` trackable.
  - Verified `https://openai.bothub.chat/v1/models` with the local key; Bothub returned 394 available models.
  - A free model smoke test with `gpt-oss-120b:free` returned `429 Too Many Requests`, likely a model/rate-limit condition.
  - A tiny chat smoke test with `gpt-4o-mini` succeeded with response `bothub-ok`; reported usage was 24 total tokens and cost `0.0000054`.
  - Added helper scripts `scripts/bothub-models.ps1` and `scripts/bothub-chat.ps1`; both read `.env.local` without printing the API key.
- ButlerBrain update import: Palace small shipyard / Theseus continuity:
  - Source: ButlerBrain thought `default/thoughts/2026-07-08T16:30:48.831448+00:00`.
  - Imported the idea that local AutoMem should first become a small, local-first memory forge before cloud mirroring and external connector exposure.
  - Stored staged rollout: local laptop AutoMem -> stabilize memory practice -> cloud AutoMem mirror -> background sync -> custom connector access for other chats.
  - Stored key invariant: memory is a managed process, not just a database; it includes logging, retrieval, trace structure, DIFF preservation, invariants, and continuity restoration.
  - Stored operational ritual: `standup_in -> trace -> diff -> standup_out`.
  - Stored minimal future connector API shape: `search_memory`, `save_trace`, `save_diff`, `get_invariants`, `healthcheck`.
  - AutoMem memory ids: `208f6a43-01fb-4282-aafa-31e8d42eca3b`, `4896c1e2-48fa-4a62-8140-c4bafb7d114f`, `30861790-a0c3-43d7-8b2d-e4d05bbf2acd`, `26359c5d-159b-4fb6-83f2-d24cacfc8697`.
  - Linked these memories to existing exocortex, local AutoMem setup, Stanford AutoMem alignment, and `invariant-isomorphism-adaptation` nodes.
- Manual reverse sync to ButlerBrain and Airtable:
  - Saved a compact reverse-sync DIFF to ButlerBrain owner `default`; ButlerBrain reported `stored=true`, `chunks=3`, `visibility=shared`.
  - Created Airtable Trace record in `UES Trace Recovery Lab` / `Trace`: `recOVh5cviDMks1Jq`.
  - Stored local AutoMem checkpoint for this reverse sync: `a79ef8cb-d168-4ebc-b6bb-2a170875cf05`.
  - Checked the supplied LinkedIn PDF screenshot at `C:\Users\s.poklad\Downloads\(3) How I cut cold-search latency in half on a vector store that costs almost nothing at rest _ LinkedIn.pdf`; it has one page, no extractable text, very small file size, and rendered as visually empty/non-informative, so no claims from it were imported.
- LinkedIn article import: ButlerBrain S3-backed memory search:
  - Read `https://www.linkedin.com/pulse/how-i-cut-cold-search-latency-half-vector-store-costs-jackson-f9egc/` directly after the PDF copy proved empty.
  - Source metadata: Christopher Jackson, `How I cut cold-search latency in half on a vector store that costs almost nothing at rest`, published 2026-06-11.
  - Imported key architecture: ButlerBrain search is serverless, multi-tenant, MCP-accessed, and backed by embedded vector storage on S3 with per-tenant prefixes and no database server.
  - Imported key performance lesson: cold and warm requests are separate populations; reported path moved from about 17s cold worst case to 8.5s cold and about 1.3s warm.
  - Imported patterns for future cloud mirror/sync: phase tracing, parallel independent S3 work, skip missing tenant tables, fetch content after visibility filtering, avoid write-on-open in read paths, compact immutable fragments, prefer tenant isolation over clever session caching, and define stopping conditions.
  - AutoMem memory ids: `c6b9b647-99ce-4d44-bcdf-bc83328ae1d6`, `25e6bb47-fcd4-41e5-ab72-8ae0417cf980`, `43491cf6-358e-4176-a879-a2ce05aa8773`, `75aea33c-bd50-4581-b530-befc66a8e52c`, `ef9fe49d-5fe4-4fb1-be47-ba6969455d03`.
  - Mirrored compact DIFF back to ButlerBrain owner `default`; ButlerBrain reported `stored=true`, `chunks=3`, `visibility=shared`.
  - Created Airtable Trace record in `UES Trace Recovery Lab` / `Trace`: `recLCnK4jn8gnkuwi`.
- Bothub external critique pass:
  - Used Bothub `gpt-4o-mini` as an external architecture critic for the local-first AutoMem -> ButlerBrain/Airtable -> future cloud mirror sync loop.
  - Sent only a compact public/article-derived summary and non-secret architecture context; no API keys, private memory contents, or local files were sent.
  - Main risks returned: consistency/conflict resolution, sync latency/performance, scalability, security/privacy, and sync-logic complexity.
  - Main next steps returned: define shared schema, build a lightweight local capture/sync layer, define ButlerBrain transformation role, integrate Airtable API safely, and test the loop for accuracy/performance on the laptop.
- LLM Council / Bothub invariant pass:
  - Inspected `karpathy/llm-council` README, CLAUDE.md, and backend source.
  - Extracted transferable invariants: parallel first opinions, anonymized peer review, explicit final ranking, chairman synthesis, raw-output transparency, parsed-ranking validation, graceful degradation when some models fail, and JSON conversation storage.
  - ButlerBrain search surfaced the humor invariant: humor prevents premature fixation and interpretation collapse; for our use, council process should include lightness/playfulness as an anti-bureaucracy guardrail.
  - Bothub model inventory showed viable council families: `gpt-*`, `claude-*`, `gemini-*`, and `grok-*`.
  - Added `scripts/bothub-council.ps1`, a local Bothub council helper that reads `.env.local`, supports configurable models/chairman, optional peer review, anonymous response labels, and a review criterion for avoiding premature fixation and keeping humane tone.
  - Smoke test with `gpt-4o-mini` and `-SkipPeerReview` succeeded; total reported Bothub cost was about `0.0000789`.
- DeepSeek / Google Drive seed pass:
  - User prefers using DeepSeek more often as an engineering architecture voice.
  - Bothub model inventory includes `deepseek-chat`, `deepseek-r1`, `deepseek-r1-0528`, `deepseek-r1-distill-llama-70b`, `deepseek-v3.2`, `deepseek-v4-flash`, and related variants.
  - Updated `scripts/bothub-council.ps1` defaults so `deepseek-chat` is the first council member.
  - Google Drive overview found a direct seed document: `Техническая спецификация: MoE-to-LUCA Transition` / `DeepSeek_R1_Scaling_Dynamics`.
  - Seed invariant: DeepSeek R1 as static MoE suggests a transition toward Open-World MoE/LUCA, where standardized context serialization and routing make expert switching cheaper than monolithic retraining.
  - Additional Drive seeds inspected: `Карта Экосистемы: Слой Памяти ИИ` and `Протокол: Память Исследования`, both supporting the distributed cognitive memory / open expert mesh framing.
  - AutoMem memory ids: `8bd925d0-b62e-4c08-9efe-743b0527e385`, `d75642f5-514b-4208-93c4-6a4543ce10cb`.
- DeepSeek external pass on Drive seed notes:
  - User explicitly approved sending these Google Drive notes to DeepSeek via Bothub, noting they contain no private keys and are intended for open architectural analysis.
  - Updated `scripts/bothub-chat.ps1` to support `-PromptFile` and `-MaxTokens`.
  - Created `outputs/deepseek_seed_prompt.md` with a curated seed packet from the three Drive documents.
  - Sent the packet to Bothub `deepseek-chat`; reported usage was 1747 total tokens and cost `0.0007696794`.
  - Created `outputs/deepseek_drive_index.md` as the first lightweight map of DeepSeek/Drive material.
  - DeepSeek confirmed useful invariants: LUCA as interface rather than single architecture, MCP as connector, local memory under long-context cost pressure, lower expert-switching costs, and isolation of high-entropy metaphor/humor.
  - New ingestion rubric: label material as `verified`, `hypothesis`, `metaphor`, or `noise`.
  - AutoMem memory ids: `4e7274d6-9daa-479c-9c5f-bbe69f2a9e24`, `ac8ddcaa-4434-4a68-a10b-f9f2636a32d1`.
- Crystallization checkpoint:
  - Created `outputs/crystallization_2026-07-08.md` to reduce live-context pressure after AutoMem, ButlerBrain, Airtable, Bothub/DeepSeek, Google Drive, and PDF seed work.
  - Preserved current core invariants: research-trajectory memory, invariant -> isomorphism -> adaptation, local AutoMem as substrate, MCP as connector, DeepSeek as structure voice, humor/metaphor isolation, and mandatory `verified` / `hypothesis` / `metaphor` / `noise` labels.
  - Read `C:\Users\s.poklad\Downloads\Краткое резюме.pdf`; text extraction succeeded, 8 pages.
  - PDF claims about Anthropic `J-space` / `J-lens` were marked `local_pdf / needs_live_verify`, so they can guide research routing but should not enter strict memory as verified claims until primary sources are confirmed.
- Space-weather / biosphere sensing evidence sync:
  - Created `outputs/space_weather_biosphere_evidence_2026-07-09.md` after checking DeepSeek's "Compass" answer with Liner Search, Consensus, SciSpace, Elicit, smarts.bio, and web search where available.
  - Elicit was unavailable on the current plan; SciSpace returned server error 500; smarts.bio timed out on the broad evidence-map query and should be retried in smaller chunks.
  - Strongest confirmed branch: `Photobacterium phosphoreum` bioluminescence as a geomagnetic bioindicator; Liner found a paper reporting `R = -0.41` vs K-index and `R = -0.51` in months of increased geomagnetic activity.
  - SIF branch: Liner found a 2026 bioRxiv preprint claiming decade-scale satellite SIF / geomagnetic-index coupling with cryptochrome and iron-sulfur mechanisms; status is `preprint`, not settled fact.
  - Fungal/mycelium branch: modern evidence supports fungal electrophysiology and fungal biosensing, but no direct proof was found that mycelium predicts solar or geomagnetic storms 6-240 minutes ahead of satellites.
  - Historical prior: the mycelium extrapolation likely draws from Chizhevsky-style heliobiology and later solar/geophysical biological-rhythm literature rather than a direct modern fungal early-warning paper.
  - Working memory label: `space-weather-biosphere sensing / mixed evidence / do not collapse into fact yet`.
- Space-weather / early biodetector second search pass:
  - Used Acumen, Tavily, Parallel Search, and Exa to search for early biological detectors and stronger adjacent candidates.
  - Added a second-pass section to `outputs/space_weather_biosphere_evidence_2026-07-09.md`.
  - New strong plant candidate: Elizabeth Davies 2023 `Elodea` oxygen-production study, with continuous local measurements of dissolved oxygen, light, temperature, air pressure, and geomagnetic variability; status `verified / promising plant-biodetector`.
  - New mechanism support: 2023 Lima bean GMF/near-null magnetic-field study connecting geomagnetic field conditions with photosynthesis, ROS, RubisCO/chlorophyll/carotenoid changes, and MagR/IScA-related gene expression.
  - New fungal substrate support: Springer 2023 `Fungal Machines: Sensing and Computing with Fungi`, plus fungal wearables/moisture/pressure/electrical sensing work; this supports mycelium as a plausible sensing substrate but not yet as a direct space-weather early-warning system.
  - Methodological refinement: treat "early biodetector" as a multi-channel time-series design requiring lead-lag analysis and confound control, not as a single organism with prophetic status.
