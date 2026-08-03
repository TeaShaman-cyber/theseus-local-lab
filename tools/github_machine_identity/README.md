# Local GitHub launcher

This is the project-local GitHub route for the Theseus local contour.

```text
Windows Codex project
  -> WSL
  -> local Infisical Machine Identity
  -> Theseus Local Lab / local:/infra
  -> GH_TOKEN
  -> /usr/bin/gh
  -> GitHub
```

Run it from the repository root:

```text
node tools/github_machine_identity/run.mjs gh repo list --limit 20
```

The launcher does not read, print, or persist the token. It only injects the
local `/infra` secrets into the child process through `infisical run`.

This route is local-only. It is not the MarcoPolo `wrapper-gh.sh` route and it
does not modify the global Codex configuration.
