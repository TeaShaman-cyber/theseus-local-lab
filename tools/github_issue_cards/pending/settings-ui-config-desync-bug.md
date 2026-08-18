---
status: READ_BACK_VERIFIED
operation: create
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: project_card
target_confirmation: user_confirmed
approval_scope: "publish issue settings-ui-config-desync-bug as-is with attached UI screenshot"
issue_number: "86530"
title: "Settings UI shows stale values, not the live config/runtime (UI/config desync)"
purpose: >
  The Hermes Desktop Settings screens do not reflect the actual values in
  config.yaml / runtime after a provider or mode switch. Fields keep showing
  the previous (often default) value, so the user cannot trust what the UI
  displays and may believe data is sent to the wrong endpoint.
observed:
  - "Example (Hindsight provider): after switching Mode to 'Local External'
    and restarting, `hermes config get memory.hindsight` and
    `hermes memory status` both show mode=local_external,
    api_url=http://localhost:8888 (correct, local)."
  - "Runtime actually writes locally (verified: retains/recalls succeed
    against localhost:8888, fact_count grows)."
  - "But the Memory Setup UI still renders api_url =
    https://api.hindsight.vectorize.io (the cloud default) — it did not pick
    up the localhost URL from config."
  - "Switching Mode in the UI does not refresh dependent fields (e.g. api_url)
    from config.yaml; the field keeps the prior/default value."
  - "Evidence (reproducible, no secrets):"
  - "  $ hermes config get memory.hindsight"
  - "    mode: local_external"
  - "    api_url: http://localhost:8888"
  - "    bank_id: hermes"
  - "  $ hermes memory status"
  - "    Provider:  hindsight"
  - "      mode: local_external"
  - "      api_url: http://localhost:8888"
  - "    Status:    available"
  - "  logs/agent.log: 'Memory provider hindsight activated' (01:47:30)"
  - "  Screenshot: Memory Setup shows Mode=Local External but"
  - "    API URL=https://api.hindsight.vectorize.io (stale cloud default)."
verified_at: ""
verified_by: "Svarog (cross-checked UI vs hermes memory status vs live Hindsight recall on localhost:8888)"
impact:
  - User cannot trust Settings screens; false alarms about cloud data leakage
    when running fully local.
  - Same UI/runtime desync class as MCP tool-dispatch bug (#84772) — the
    surface shows one thing, the engine does another.
  - Privacy-sensitive: a user self-hosting for local-only memory may wrongly
    believe data leaves the machine.
  - Not Hindsight-specific: any provider/mode switch with dependent fields is
    affected (the field is simply not re-read from config on change).
reproduction:
  - Settings -> Memory -> provider = Hindsight.
  - Set Mode = Local External, apply, restart Hermes.
  - Reopen Memory Setup: the API URL field still shows the cloud vectorize URL
    instead of the configured localhost URL.
  - (General form: change any provider/mode whose dependent fields have
    defaults; the UI retains the default, not the config value.)
expected:
  - When a mode/provider is selected, all dependent fields (api_url, keys,
    etc.) should be repopulated from the live config.yaml / runtime, never
    from a stale cached default.
actual:
  - Dependent fields keep showing the previous/default value until manually
    overwritten in the UI.
severity: P3 (functional data still correct; trust-breaking UI desync)
labels: ["type/bug", "comp/ui", "comp/config", "platform/desktop", "area/memory-setup"]
related: ["NousResearch/hermes-agent#84772"]
signature: "Prepared collaboratively by Semyon Poklad and Сварог, an AI engineering agent and engineering partner. Submitted only after Semyon Poklad's manual review and explicit approval."
---
