# MarcoPolo Secretless Proxy Contract v0.1

Status: ACTIVE
Date: 2026-07-20

## Decision

MarcoPolo is an operational runtime and outbound execution proxy for Git, GitHub,
public HTTPS endpoints, and future explicitly approved external APIs.

The target operating model is secretless-by-hand: routine agent work must not
require a user to copy, paste, reveal, or manually shuttle credentials through
chat, prompts, tracked files, screenshots, logs, or temporary public links.

## Existing Theseus precedent

This contract extends the established Theseus secret policy:

- Infisical/keychain is the source of truth for provider keys and local service credentials.
- Runtime wrappers prefer injected environment variables.
- `.env.local` is an ignored emergency fallback, not the normal operating path.
- Secrets are never committed to repositories or included in safe backups.
- Provider and worker manifests reference credential sources; they do not embed credentials.
- Git publication uses authenticated `gh`/Git sessions after one-time bootstrap and verifies authentication before work.

## MarcoPolo target flow

```text
Secret store / native credential store
        -> scoped runtime injection or persisted tool credential
        -> MarcoPolo runtime
        -> git / gh / approved CLI or API client
        -> external service
```

ChatGPT should pass intent and non-secret parameters only. Secret material should
remain behind the runtime boundary.

## GitHub

Current verified state:

- `gh` is installed in MarcoPolo.
- GitHub authentication is persisted in the MarcoPolo `gh` credential store.
- Repository reads through `gh` work from MarcoPolo.
- Git operations can use the authenticated CLI/runtime route without GitHub Actions as an intermediary.

Normal route:

```text
ChatGPT -> MarcoPolo -> git/gh -> GitHub
```

GitHub Actions remains useful for CI and repository-native automation, but is not
required merely to proxy routine repository writes from the agent runtime.

## Rules

1. Prefer native credential stores or Infisical-style runtime injection over `.env` files.
2. Never print secret values during health checks; verify presence and capability only.
3. Never commit `.env`, `.env.local`, private keys, credential exports, or secret-bearing backups.
4. Keep `.env.local` only as an ignored emergency fallback where no better route exists.
5. Use least-privilege credentials and separate credentials by provider/runtime when practical.
6. Verify authentication with harmless capability probes before adopting a route as VERIFIED.
7. Keep `DECLARED`, `EXPOSED`, and `VERIFIED` capability states distinct.
8. A safety or dispatch failure before the runtime is not evidence that the target service is broken.
9. Rotate any credential that was intentionally or accidentally exposed through a public link or unsafe transfer path.
10. Migrate one integration at a time; do not centralize every credential before each route has a tested injection and recovery path.

## Migration order

1. GitHub via persisted `gh` authentication.
2. Provider/API credentials via an Infisical-compatible or native MarcoPolo secret source.
3. Runtime wrappers that consume injected environment variables without logging values.
4. Health probes that report only credential source, scope/capability, and success/failure.
5. Recovery documentation that restores secret-store access rather than copying raw secrets from backups.

## Authority map

- Secret value authority: secret manager / native credential store.
- Runtime execution authority: MarcoPolo.
- Repository authority: Git/GitHub.
- CI authority: GitHub Actions when CI is actually required.
- Chat: orchestration and intent, never secret storage.

## Immediate invariant

No new workflow should be designed around manually moving a secret through chat
when a persistent credential store, scoped runtime injection, or authenticated
CLI session can provide the same capability.
