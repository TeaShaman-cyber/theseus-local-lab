# VPN endpoint change → provider availability reassessment (2026-09-01)

## Event

User changed their VPN endpoint (phone-tethered host, VPN routes all cloud
traffic). After the change:
- Groq opened up (previously 403 from both browser and python);
- Nous availability appeared restored.

## Diagnosis (verified by experiment, not assumption)

The 2026-08-31 "403s" were **Cloudflare bot-mitigation (error code 1010,
TLS fingerprinting), NOT provider death and NOT pure VPN-IP blocking**:

| Client stack | groq/nous result | egress IP |
|---|---|---|
| python urllib (hermes kernel) | 403 code:1010 | 45.85.105.214 |
| curl (schannel TLS) | 200 OK | 45.85.105.214 (same!) |
| user's browser | 200 (after VPN endpoint change) | (user-side) |

Same egress IP passes via curl and fails via python urllib → Cloudflare
separates clients by TLS fingerprint, not by IP alone. The VPN endpoint
change likely refreshed CF's per-fingerprint reputation, unblocking the
browser path; curl (schannel) passes independently.

## Post-change probe results (curl stack, 2026-09-01)

| Route | Models | Status |
|---|---|---|
| nous (agent_key from auth.json credential_pool) | solar-pro4:free, longcat-2.0:free, step-3.7-flash:free, ling-3.0-flash-fin:free | **ALL ALIVE** (200, content OK) |
| nous | tencent/hy3:free | DEAD (404 free period ended — confirmed permanent) |
| groq (GROQ_API_KEY) | catalog 14 models; gpt-oss-120b, compound-mini, qwen3.8-27b probed | **ALL ALIVE** |
| openrouter | minimax-m3:free | ALIVE |
| openrouter | nemotron-3-ultra-550b:free | **502 Nvidia upstream overloaded again** (200-wrapped error body!) |

## Key lessons (folding into triage.md)

1. **403 code:1010 ≠ provider death.** It is CF bot-mitigation against a
   client TLS fingerprint. Before declaring a route dead: re-probe with a
   DIFFERENT TLS stack (curl/schannel vs python urllib) and/or from a browser.
2. **OpenRouter returns some upstream errors as HTTP 200 + error body**
   (`{"error": {..., "code": 502}}`) — a probe that only checks HTTP status
   will mark a dead model ALIVE. Parse the body; treat embedded `error.code`
   as the real status.
3. Nous credentials: the working key is `agent_key` in
   `auth.json → credential_pool.nous[0]` (short-lived, auto-refreshed),
   NOT a static API key in .env.
4. Free pool after reassessment: THREE independent routes (nous 4+ free,
   groq 14, openrouter ~10 free) — single-route failure no longer blocks
   the helper rotation.

## Disposition

- chronology.md: new PROBE entry appended.
- triage.md: Step-1 table gains "403 code:1010 (CF fingerprint)" row and
  "OpenRouter 200-wrapped upstream error" note in probe discipline.
- INDEX.md current-state: fallback replacement still pending (nous/hy3 dead);
  rotation pool now spans 3 routes.
