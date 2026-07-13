# Theseus Harness Errors

Small classifier for recurring Codex/UI/network failure signatures.

Run:

```text
node tools/harness_errors/harness_errors.mjs
```

Outputs ignored local reports:

```text
outputs/harness_errors/YYYY-MM-DD-harness-errors.md
outputs/harness_errors/YYYY-MM-DD-harness-errors.json
```

## Current Signatures

- `harness-history-replay`: Responses item history/hydration mismatch, such as
  `web_search_call` without its required `reasoning` item.
- `windows-sandbox-socket`: Windows socket denial, usually sandbox, firewall,
  proxy, account, or ACL boundary.
- `proxy-network-timeout`: TLS handshake timeout, usually network/proxy/routing
  instability.
- `ephemeral-local-file`: temp screenshot or clipboard file disappeared before
  Codex could read it.

## Use

Use this report as observability input for `tools/learning_loop`. It should not
change behavior directly; it produces categorized evidence for later review.
