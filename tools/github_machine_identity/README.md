# DEPRECATED: Local GitHub launcher (historical)

> **Status: DEPRECATED / DISABLED since 2026-08-12.**
>
> Do not use this launcher for current GitHub work. It depends on the local
> Infisical stack and WSL, but Infisical was intentionally disabled on the
> local machine. This directory is retained for historical audit and possible
> future reactivation only; it is not the active publication route.
>
> **Current route:** use the direct Windows `gh` / GitHub API route. For issue
> publication, follow the approved issue-card guard and read-back workflow.

This was the project-local GitHub route for the Theseus local contour before
the Infisical stack was disabled.

```text
Windows Codex project
  -> WSL
  -> local Infisical Machine Identity
  -> Theseus Local Lab / local:/infra
  -> GH_TOKEN
  -> /usr/bin/gh
  -> GitHub
```

Historical invocation (do not run for current work):

```text
node tools/github_machine_identity/run.mjs gh repo list --limit 20
```

The launcher does not read, print, or persist the token. It only injects the
local `/infra` secrets into the child process through `infisical run`.

This route is local-only. It is not the MarcoPolo `wrapper-gh.sh` route and it
does not modify the global Codex configuration.
