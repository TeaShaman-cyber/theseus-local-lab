# Bothub Conclave Digest: Windows Hut Improvements

Date: 2026-07-09

Raw result: `outputs/bothub_conclave_windows_hut_2026-07-09.json`

Prompt: `outputs/bothub_conclave_windows_hut_prompt_2026-07-09.md`

## Run

- Models requested: `claude-opus-4.8`, `gpt-5-codex`,
  `deepseek-r1-0528`, `qwen3-coder-plus`, `gemini-3.1-pro-preview`.
- Chair: `claude-sonnet-5`.
- Stage 1: 4/5 succeeded.
- Stage 2: 4/5 succeeded.
- `gpt-5-codex` appeared in the Bothub model catalog but failed with `403
  Forbidden` in both answer and review stages.
- Gemini returned a blank first answer but produced a peer review.
- Total reported tokens: 40,440.
- Known reported cost: 0.05158295.

## Main Conclusion

The highest-value path is not a broad upgrade spree. Protect the working Docker
and AutoMem setup, keep the new `agent-shell` as the primary Unix-like workbench,
and add small diagnostics around the fragile Windows seams.

## Priority Order

1. Fix or explicitly classify the workspace Git state. The `.git` directory
   exists but is empty, and `git rev-parse --show-toplevel` fails. This is not a
   `safe.directory` problem; the workspace is not a valid Git repo right now.
2. Add a cheap `doctor.ps1` script for repeatable health checks.
3. Keep using Docker `agent-shell` for Linux-style coding, JSON, SQLite, Python,
   Node, and jq work.
4. Do not update Chocolatey based on `Get-Command` file metadata alone. The real
   CLI version from `choco --version` is `2.7.3`; the earlier `0.12.1.0` was
   misleading file-version metadata.
5. Leave PowerShell 7.4.17 and Git 2.52 alone for now; they are good enough and
   not the current bottleneck.

## WSL / VM Decision

Do not install a full WSL distro or VM yet. The Docker `agent-shell` already
provides the required Unix-like surface. A separate WSL distro would add another
stateful environment to maintain and more RAM/disk pressure on an older laptop.

Revisit WSL only if Docker `agent-shell` cannot satisfy a concrete need, such as
native Linux filesystem performance or a tool that does not behave well in the
container.

## Install Channel Policy

- Docker: development toolchains and repeatable agent workbench.
- Windows host: Docker Desktop, filesystem/GUI integration, host orchestration.
- Chocolatey: small host utilities only, after updating Chocolatey itself.
- Official installers: system-integrated tools such as Docker Desktop, Git,
  PowerShell, App Installer/winget.

## Bothub Model Availability

The catalog is useful but not authoritative for actual access. `gpt-5-codex`
was listed but returned `403 Forbidden`. Future councils should maintain a
`known-working` roster based on smoke tests, not just `/models`.

Known working in this run:

- `claude-opus-4.8`
- `deepseek-r1-0528`
- `qwen3-coder-plus`
- `gemini-3.1-pro-preview` for review, though its first answer was blank
- `claude-sonnet-5` as chair

## Top 5 Actions

1. Add and use `scripts/doctor.ps1`.
2. Decide whether to initialize this workspace as a real Git repo or treat it as
   an artifact workspace without Git.
3. Keep using `agent-shell` for Unix-like work.
4. Add stage checkpoints to long Bothub council runs.
5. Create a Bothub `known-working-models` note or smoke-test script.

## Doctor Findings

Normal sandbox run:

- `automem-http`: ok.
- `git-bash`: ok.
- `docker-cli` and `agent-shell`: fail due Docker config/pipe permissions.
- `git-workspace`: fail because `.git` directory exists but is empty.
- `chocolatey`: ok, `2.7.3`.
- `winget`: missing in the normal sandbox shell.

Approved/elevated run:

- `docker-cli`: ok.
- `agent-shell`: ok.
- `automem-http`: ok.
- `winget`: ok, `v1.29.280`.
- `git-workspace`: still fail, empty `.git`.
- `safe-directory`: warn in that context, so Git trust config differs between
  execution identities.

## Do Not Touch Yet

- Do not install WSL Ubuntu/Debian just because WSL exists.
- Do not update Docker Desktop while AutoMem is healthy.
- Do not broadly update PowerShell/Git.
- Do not install heavy IDEs or large language toolchains on the Windows host.
- Do not disable security features for convenience.

## One Invariant for the Windows Hut

Windows hosts and orchestrates; Docker `agent-shell` does repeatable Unix-like
work; AutoMem stores cross-checked conclusions, not raw operational noise.
