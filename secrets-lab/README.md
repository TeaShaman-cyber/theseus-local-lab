# Secrets Lab

Local Docker keychain for Theseus lab secrets.

This starts a self-hosted Infisical instance on `http://localhost:8088`.
Use it as the source of truth for API keys and local service credentials instead
of writing real values into chat, `.env.example`, or committed files.

## Files

- `docker-compose.yml`: Infisical, Postgres, and Redis.
- `.env.example`: safe template.
- `.env`: generated locally, ignored by Git, contains instance secrets.

## First Start

Generate local instance secrets:

```powershell
node tools/secrets_lab/generate_infisical_env.mjs
```

Start the keychain:

```powershell
docker compose -f secrets-lab\docker-compose.yml up -d
```

Open:

```text
http://localhost:8088
```

The first user to sign up becomes the instance administrator.

## First Project

In the Infisical UI, create a project named `Theseus Local Lab`.

Suggested starter layout:

- Environment: `Development`
- Environment: `Local` (`local` slug)
- Folder: `/providers`
- Folder: `/agents`
- Folder: `/infra`

Put API keys in `/providers`, agent-specific tokens in `/agents`, and local
service credentials in `/infra`. Do not paste real values into chat; add or
rotate them directly in the UI.

Current pilot status: `Theseus Local Lab` exists, `Local` exists, and the three
starter folders exist in both `Development` and `Local`.

Current `/providers` names in `Local`:

- `BOTHUB_API_KEY`
- `BOTHUB_BASE_URL`
- `BOTHUB_MODEL`
- `XAI_API_KEY`
- `XAI_BASE_URL`
- `XAI_MODEL`

Values live only in Infisical.

## SSH And VM Credentials

Use `/infra` for SSH and local infrastructure access metadata:

- `UBUNTU_VM_SSH_USER`
- `UBUNTU_VM_SSH_PASSWORD`
- `UBUNTU_VM_HOST`
- `UBUNTU_VM_SSH_KEY_PATH`
- `UBUNTU_VM_SSH_KEY_PASSPHRASE`

Preferred rule: keep SSH private key files on disk with OS permissions and
ssh-agent; keep passphrases, passwords, host aliases, and key paths in
Infisical. Store a private key body in Infisical only as an explicit emergency
exception, never as the default workflow.

Current `/infra` names in `Local`:

- `UBUNTU_VM_SSH_USER`
- `UBUNTU_VM_SSH_PASSWORD`

Values live only in Infisical.

## Daily Checks

```powershell
docker compose -f secrets-lab\docker-compose.yml ps
Test-NetConnection -ComputerName 127.0.0.1 -Port 8088
```

Only inspect application logs during troubleshooting, and avoid copying them
into chat because a secrets manager can occasionally log sensitive bootstrap
context.

## Rules

- Never commit `secrets-lab/.env`.
- Never paste real secret values into chat.
- Keep `.env.example` as the public schema only.
- Back up both the Postgres volume and `secrets-lab/.env`; without the
  encryption key in `.env`, restored encrypted secrets cannot be decrypted.
- Use Infisical for local/dev secrets first. Keep production or paid-service
  credentials more restricted until the workflow is proven.

## Next Integration

Once the project exists, install and authenticate the Infisical CLI in the
agent shell. Then prefer `infisical run -- <command>` over exporting secrets in
chat or writing provider keys into committed files.

Current CLI status:

- Local CLI cache: `tools/infisical_cli`
- Project config: `.infisical.json`
- `infisical run --env=local --path=/providers -- ...` injects provider names.
- CodeWhale runner: `node tools/codewhale_infisical/run.mjs --provider BOTHUB`
