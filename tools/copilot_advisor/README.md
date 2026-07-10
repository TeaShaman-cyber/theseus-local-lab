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

## Use From VS Code

Run the task:

```text
Theseus: ask Copilot advisor
```

VS Code will ask for a short prompt. Keep it focused, for example:

```text
Suggest a minimal GitHub Actions workflow for markdownlint and script syntax checks.
```

## Use From Terminal

```powershell
node tools/copilot_advisor/copilot_advisor.mjs "How should this repo organize GitHub Actions for lint checks?"
```

If your Copilot CLI command is not named `copilot`, set:

```powershell
$env:COPILOT_ADVISOR_COMMAND = "gh"
$env:COPILOT_ADVISOR_ARGS = "copilot suggest --type shell --prompt {prompt}"
```

`{prompt}` is replaced with the exact prompt text.
