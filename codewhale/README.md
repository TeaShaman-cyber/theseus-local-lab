# CodeWhale Harness

Purpose: run CodeWhale as a local harness for Bothub models without installing
it globally on the Windows host.

Primary source:

- https://github.com/Hmbown/CodeWhale

Why this fits:

- CodeWhale supports a generic OpenAI-compatible provider.
- Bothub exposes an OpenAI-compatible endpoint at
  `https://openai.bothub.chat/v1`.
- Running through Docker keeps the Windows host cleaner and follows the current
  `agent-shell` strategy.

## Run

List/help:

```powershell
.\scripts\codewhale.ps1 --version
.\scripts\codewhale.ps1 doctor
```

Headless smoke test:

```powershell
.\scripts\codewhale.ps1 exec --max-turns 1 "Reply exactly: codewhale-ok"
```

Verified smoke test:

```powershell
.\scripts\codewhale.ps1 exec "Reply exactly: codewhale-ok" --output-mode json
```

Result:

```json
{
  "response": "codewhale-ok",
  "output_mode": "json"
}
```

## Agent Image

The official CodeWhale image works, but `doctor` reports that Python and Node
are not available for CodeWhale execution tools. Build a local enriched image
when tool execution is needed:

```powershell
docker build -t codewhale-agent:latest .\codewhale
.\scripts\codewhale.ps1 -AgentImage doctor
```

Verified result:

- Local image: `codewhale-agent:latest`
- CodeWhale: `0.8.67`
- Bothub/OpenAI-compatible connection: successful
- Python: available; `code_execution` tool registered
- Node.js: available; `js_execution` tool registered
- Optional heavy tools not included yet: `pandoc`, `tesseract`, `pdftotext`

Resource note: this Debian-based image is a full mode. Installing `npm` pulled a
large dependency tree, so use the official image for cheap text-only harness
tasks and `-AgentImage` only when the worker needs code execution.

## Environment

The wrapper reads `.env.local` and maps:

- `BOTHUB_API_KEY` -> `OPENAI_API_KEY`
- `BOTHUB_BASE_URL` -> `OPENAI_BASE_URL`
- `BOTHUB_MODEL` -> `OPENAI_MODEL`

It also passes global CodeWhale options:

- `--provider openai`
- `--base-url <BOTHUB_BASE_URL>`
- `--model <BOTHUB_MODEL>`
- `--telemetry false`

Secrets are not written into this repository. By default, CodeWhale uses a
temporary container home. Add `-PersistHome` only after the smoke tests are
stable; that mounts `.codewhale-home/`, which is ignored by git.

## Notes

- Start with `Plan` or short `exec` tasks.
- Avoid `YOLO` mode on this laptop.
- Keep CodeWhale as a worker harness, not the owner of project memory.
- Let AutoMem store only validated DIFFs and durable decisions.
- CodeWhale global options such as `--model` must be placed before subcommands
  like `exec`; the wrapper already injects provider/base-url/model before the
  user arguments.
