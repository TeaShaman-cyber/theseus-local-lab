# Copilot Advisor Bridge

Purpose: ask GitHub Copilot for narrow GitHub, VS Code, and CI/CD advice
without giving it automatic access to project files, secrets, or memory dumps.

This bridge is deliberately small:

- The prompt is explicit.
- No files are attached automatically.
- `.env`, backups, AutoMem exports, and raw private context stay local unless a
  human deliberately copies a safe excerpt into the prompt.
- The command is configurable, so the same bridge can work with a future
  `copilot` CLI, `gh copilot`, WSL, or a container wrapper.

The bridge has a 45-second timeout by default. Set
`COPILOT_ADVISOR_TIMEOUT_MS` only when a bounded longer request is justified.
On timeout it returns exit code `124`; use the visible VS Code Copilot chat as
the fallback rather than waiting indefinitely.

## Use From VS Code

Run the task:

```text
Theseus: ask Copilot advisor
```

VS Code will ask for a short prompt. Keep it focused, for example:

```text
Suggest a minimal GitHub Actions workflow for markdownlint and script syntax checks.
```

## Canonical Route

Prefer the VS Code task `Theseus: ask Copilot advisor`. It is the canonical
route for this repo because it keeps advisor usage visible and reduces raw
Windows shell drift.

Use terminal fallback only after stating why the VS Code task is unavailable or
inadequate for the current turn.

## Use From Terminal

```powershell
node tools/copilot_advisor/copilot_advisor.mjs "How should this repo organize GitHub Actions for lint checks?"
```

On Windows, the bridge calls the npm-installed `copilot.cmd` wrapper through a
small PowerShell launch step so prompts with spaces survive command-line
quoting.

GitHub's public Copilot CLI FAQ says CLI access is included in all Copilot
plans, including Free. In practice, if the bridge reaches Copilot and returns
`Access denied by policy settings`, GitHub authentication worked but CLI access
is blocked by account, subscription, organization policy, or server-side
entitlement state. Check:

```text
https://github.com/settings/copilot
```

If VS Code works through a regional-blocking bypass but Copilot CLI does not,
set one bridge-specific proxy variable before running the task:

```powershell
$env:COPILOT_ADVISOR_PROXY = "http://127.0.0.1:10808"
```

For v2rayN, this is usually the local `mixed` proxy port shown in the status
bar, for example `Local: [mixed:10808]`.

Alternatively, set standard proxy variables directly:

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:PORT"
$env:HTTP_PROXY = "http://127.0.0.1:PORT"
```

Copilot CLI reads `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`; it may not inherit
browser, extension, or app-specific proxy settings automatically.

If your Copilot CLI command is not named `copilot`, set:

```powershell
$env:COPILOT_ADVISOR_COMMAND = "gh"
$env:COPILOT_ADVISOR_ARGS = "copilot suggest --type shell --prompt {prompt}"
```

`{prompt}` is replaced with the exact prompt text.
