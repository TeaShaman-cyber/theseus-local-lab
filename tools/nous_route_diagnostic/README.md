# Nous route diagnostic

A bounded, read-only diagnostic for OpenAI-compatible Nous routes. It exercises
`/chat/completions`, parses the response body, and emits only redacted JSON.
It does not write AutoMem/Hindsight memory, change Hermes config, refresh OAuth
state, or persist provider responses.

## Targets

| Target | Client/executor | Purpose |
|---|---|---|
| `direct` | Windows `curl.exe` / Schannel | Primary direct Nous control path |
| `direct-python` | host `python` / `urllib` | Labelled negative control for client/TLS differences |
| `proxy` | `docker compose exec` + internal Python | Probe `hermes-proxy:8645` from the Compose network |

The proxy target deliberately does not use host `127.0.0.1`: the Docker-owned
Hermes proxy is an internal service and has no published host port in the
canonical Hindsight Compose source.

## Safe invocations

From the repository root on Windows:

```bash
# Primary control. The bearer is read from the environment and passed to
# curl.exe through stdin, never through process arguments or result JSON.
node tools/nous_route_diagnostic/nous_route_diagnostic_cli.mjs \
  --target direct \
  --token-env NOUS_AGENT_KEY

# Same target with Python urllib, only as a labelled negative control.
node tools/nous_route_diagnostic/nous_route_diagnostic_cli.mjs \
  --target direct-python \
  --token-env NOUS_AGENT_KEY

# Internal proxy route; uses only the configured non-secret client placeholder.
node tools/nous_route_diagnostic/nous_route_diagnostic_cli.mjs \
  --target proxy \
  --compose-project hindsight-cloud \
  --compose-file deploy/hindsight/docker-compose.yml
```

The default model is `upstage/solar-pro4:free`. Override it with `--model` or
`NOUS_MODEL`. Override the base URL with `--base-url`; URLs containing userinfo,
query parameters, or fragments are rejected so credentials cannot be hidden in
the endpoint. `--timeout-ms` is bounded to 120 seconds and defaults to 30
seconds.

Use `--dry-run` to validate target selection without starting a process or
making a network request.

## Result contract

The command prints compact, redacted JSON with fields including:

- `target`, `client_stack`, `stage`, and `model`;
- `http_status`, `latency_ms`, `finish_reason`, and `content_nonempty`;
- a stable `classification` and sanitized `error_class`;
- `memory_write: false`, an empty `evidence_refs` list, and `observed_at`.

It never prints bearer values, request/response bodies, provider error
messages, OAuth state, or raw subprocess stderr. A successful completion must
have HTTP 2xx, parsed JSON, non-empty assistant content, and a finish reason.
The request uses a fixed prompt and `max_tokens: 256` so reasoning models are
not rejected solely because of a low budget.

Classifications include:

- `SUCCESS`;
- `CLIENT_TLS_FINGERPRINT_BLOCK` (`403` with Cloudflare 1010 markers);
- `AUTH_FAILURE`, `MODEL_NOT_FOUND`, `RATE_LIMITED`;
- `UPSTREAM_OVERLOAD`, `WRAPPED_PROVIDER_ERROR`;
- `PROXY_UNREACHABLE`, `NETWORK_UNREACHABLE`, `TIMEOUT`;
- `MALFORMED_RESPONSE`, `EMPTY_CONTENT`, `INCOMPLETE_RESPONSE`,
  `CONFIG_MISSING`.

A `CLIENT_TLS_FINGERPRINT_BLOCK` result is a client/transport observation, not
proof that the model or provider is dead. Compare the explicit `curl.exe`
control with `direct-python` before making that claim.

## Exit codes

- `0`: `SUCCESS` or `DRY_RUN`;
- `1`: a route was exercised but did not pass;
- `2`: local configuration or argument problem; no provider claim is made.

## Tests

```bash
node --test tools/nous_route_diagnostic/*.test.mjs
```

The test suite is fixture-backed and has no network or credential dependency.
AutoMem helper status is intentionally a separate concern: this tool measures
route/client/provider/model behavior and does not perform an AutoMem retain or
enrichment operation.
