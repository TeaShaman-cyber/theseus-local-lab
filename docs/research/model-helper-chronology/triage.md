# Triage playbook — failing helper/model (wait vs switch)

Purpose: one-screen decision aid during an incident. Written from the
2026-08-31 events (hy3:free death, Nemotron overload). Update when a new
failure class appears; never delete entries.

## Step 1 — classify the error (30 seconds)

| Signal | Class | Default action |
|---|---|---|
| HTTP 404 "free period has ended" | DEATH (permanent) | switch immediately; quarantine the model |
| HTTP 403 (access gate / harness-only) | GATE (permanent for us) | switch; mark route-incompatible |
| HTTP 502 "upstream overloaded" | TRANSIENT overload | wait 15–60 min; check provider status |
| HTTP 429 rate limited | TRANSIENT quota | wait or rotate to sibling free model |
| HTTP 401 unauthorized | ROUTE/KEY | check key/scope; not a model fault |
| HTTP 403 "error code: 1010" on SOME clients only | CF bot-mitigation (TLS fingerprint), NOT provider death | re-probe with different TLS stack (curl/schannel vs python) and/or browser before any verdict |
| timeout / empty content | AMBIGUOUS | re-probe with max_tokens>=200 before judging |

Rule from chronology 2026-08-31: DEATH and OVERLOAD happened the same evening
to different helpers — never assume "all helpers are down" from one failure.

## Step 2 — check blast radius (1 minute)

- Who uses this model? (main / fallback / delegation pin / compression /
  hindsight LLM / reflect) — see INDEX.md current-state table.
- Compression note: the compression helper currently inherits the main model
  (no dedicated config key) — a main-model problem is automatically a
  compression problem.
- Hindsight note: general LLM is round-robin [3,1,1] across BotHub Nemotron,
  OpenRouter Nemotron, and Nous Solar via the Docker-owned `hermes-proxy`.
  A Nemotron outage affects two routes; Solar is an independently verified
  fallback, not an equivalent-quality claim.

## Step 3 — wait vs switch

WAIT when: class is TRANSIENT (502/429), role has a working fallback, and no
user-facing work is blocked. Record in chronology after recovery.

SWITCH when: class is DEATH/GATE, or TRANSIENT persists >2 work sessions, or
a blocked user task has no fallback. Verified free replacements (probe
2026-08-31 22:20): nemotron-3-ultra-550b:free, minimax-m3:free,
minimax-m2.7:free, nemotron-3.5-lightning:free (rotation pool in
sources/free-helper-pool-2026-08-31.md). Paid micro-fallback (user-approved
policy: free first, paid only where necessary): bothub hy4-preview.

After any switch: update INDEX.md, append chronology entry, and if the dead
model is in any config pin/fallback, propose the config edit to the user
(config files are user-owned; agent proposes, user applies unless told).

## Probe discipline (from 2026-08-31 lessons)

1. max_tokens >= 200 (reasoning models return content=None below that)
2. verify with a completion probe, not /models listing
3. record http status, finish_reason, latency, cost in the probe dump
4. re-probe 429 models before declaring them dead
5. On 403 "error code: 1010": re-probe with a DIFFERENT TLS stack
   (curl/schannel, browser) — python urllib gets fingerprint-blocked by
   Cloudflare while the route itself is healthy (verified 2026-09-01)
6. Parse probe BODIES, not just HTTP status: OpenRouter wraps upstream
   errors as HTTP 200 + {"error": {"code": 502, ...}} (verified 2026-09-01
   on nemotron-ultra during the same Nvidia overload that hit Hindsight)
7. Nous credentials: use the short-lived agent_key from
   auth.json credential_pool.nous[0] (auto-refreshed); a static key from
   .env does not exist and 401s on the direct route
