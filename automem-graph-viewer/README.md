# AutoMem Graph Viewer

Standalone local viewer for the Theseus AutoMem graph.

## Start

Use the VS Code task:

- `Theseus AutoMem Graph Viewer: start`

Or run the compose file directly with the project-local Docker control plane.

## Open

Open:

```text
http://127.0.0.1:5174/
```

Set `Server URL` to:

```text
http://127.0.0.1:8001
```

Then enter the AutoMem API key from the local keychain/config. Do not put the
key in this repository, URL history, screenshots, or logs.

The query-string `server=` parameter was not picked up by the current stable
viewer image during local smoke testing, so the server URL is filled manually in
the web form for now.

## Keychain

The AutoMem API URL and key are stored in the local Infisical project under:

```text
/infra
```

Use the VS Code task below to refresh the keychain values from the ignored local
AutoMem config:

- `Theseus Secrets: sync AutoMem to keychain`

This task reads `work/automem/.env`, writes a temporary `.env` file outside the
repository, imports only `AUTOMEM_API_URL` and `AUTOMEM_API_KEY`, and removes the
temporary file.

## Notes

- The viewer talks to AutoMem through HTTP only.
- It must not receive database credentials or private internal service URLs.
- The local AutoMem API already exposes the graph endpoints used by the viewer:
  `/graph/snapshot`, `/graph/neighbors/:id`, `/graph/stats`, and `/health`.
- A future convenience bridge can read the token from Infisical at runtime, but
  this compose file intentionally keeps secrets out of Docker labels, env, git,
  browser history, and logs.
