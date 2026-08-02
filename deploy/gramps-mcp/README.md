# Gramps MCP HTTP profile

Status: `MVP_TEST_ONLY`

This profile runs `gramps-web-mcp` in Streamable HTTP mode on `127.0.0.1:8080`.
Caddy publishes the `/mcp` route over HTTPS.

## Boundary

- `GRAMPS_READ_ONLY=false` is intentional for the disposable empty test tree.
- The Gramps service account is an Editor account created for MVP smoke tests.
- The `/mcp` route currently has no separate MCP authentication layer.
- Treat the public endpoint as write-capable test infrastructure, not as a route for real family data.
- The compose profile is pinned to the validated `gramps-web-mcp` image digest; changing it requires a fresh protocol/CRUD verification.
- Before audit or production: add an auth boundary and replace the disposable account.

## Verification

Use the manual VS Code tasks:

- `Family Research: Gramps MCP HTTP endpoint probe`
- `Family Research: Gramps MCP HTTP protocol probe`
- `Family Research: Gramps MCP CRUD smoke test`

The CRUD task must finish with `final_people_count=0` and
`synthetic_record_remains=false`.
