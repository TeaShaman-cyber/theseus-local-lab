---
status: APPROVED
operation: comment
project: theseus-local-lab
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: "85622"
purpose: "Update #85622 with fresh-chat injection probe result after switching provider from AutoMem --mode both to Hindsight (local_external). Built-in MEMORY.md/USER.md ARE injected with Hindsight provider, so the suppression is specific to the AutoMem --mode both spawn path, not generic 'provider active'."
approval_scope: "publish one comment to NousResearch/hermes-agent issue 85622 via gh issue comment, then read-back"
observed: "Fresh-chat probe (cite MEMORY.md/USER.md verbatim, agent name, char limit) on 2026-08-15 with memory.provider=hindsight (local_external, NO --mode both). Model quoted MEMORY.md + USER.md verbatim, answered agent name 'Svarog', and saw the '[93% - 3,001/3,200 chars]' header. Built-in injection works on brand-new chat with Hindsight provider."
verified_at: "2026-08-15"
verified_by: "Svarog (fresh-chat probe + user-supplied model answer)"
## Comment body

Update (2026-08-15): we switched the active provider from `memory.provider=automem` (`--mode both`) to `memory.provider=hindsight` (local_external, no `--mode both`). We then re-ran the fresh-chat injection probe you proposed (cite MEMORY.md/USER.md verbatim, agent name, char limit) on a **brand-new chat**.

Result with the **Hindsight provider**: built-in `MEMORY.md` / `USER.md` **ARE injected** on a fresh chat. The model quoted both files verbatim, answered agent name "Сварог (Svarog)", and saw the `[93% — 3,001/3,200 chars]` header (so the 3200 limit is visible too, just not as a named `memory_char_limit` key in the prompt).

Conclusion: the built-in-suppression symptom is **specific to the AutoMem `--mode both` spawn path**, not to "any external provider active". This narrows root cause further — it lives in the `--mode both` provider-activation ordering you localized (the native-provider + MCP dual-surface path), not in the generic provider-active branch that `local_external` Hindsight takes.

So:
- #85622 **stays open** — the AutoMem `--mode both` reproduction remains valid and is now better-scoped.
- PR #86105 remains a no-op for it (flags already truthy in our config).
- MCP tools (incl. `mcp__automem__*`) work fine alongside the Hindsight provider — that part of the original symptom class is resolved by the provider switch, not by a code fix.

This does not replace the instrumentation patch you posted — if you still want the `agent_init.py` logger.debug on a live `--mode both` session to pin the exact store-None point, we can run it; but the Hindsight result strongly suggests the gap is in the `--mode both` spawn ordering specifically.

— Semyon Poklad and Svarog
