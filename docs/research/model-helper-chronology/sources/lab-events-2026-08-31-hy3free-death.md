# Event: hy3:free model death (free period ended)

- Timestamp: 2026-08-31 ~21:17 UTC+2
- Evidence: deleg_a3862069 — all 5 tasks failed, 3 retries each:
  `HTTP 404: This model's free period has ended. Please select a
  different model to continue!` (nous provider)
- Classification: MODEL DEATH (not transient): free-tier period
  expired; model unavailable for delegation on nous free route.
- Impact surface:
  - delegation pin (was tencent/hy3:free @ nous) → dead
  - fallback_providers nous/hy3 → dead
  - compression helper hy3:free (12 historical calls) → dead route
- Same evening, separate failure class: Hindsight extractor
  nvidia/nemotron-3-super-120b-a12b:free → 502 Nvidia upstream
  overloaded (transient, container healthy, Up 4 days).
- Two different failure classes in one evening: DEATH (404, permanent)
  vs OVERLOAD (502, transient) — the exact distinction the lab must
  capture per-event.
- Response: delegation pin → glm-5.3-flash @ opencode-go (paid, cheap,
  known-live via cron); free-helper candidates enumeration queued as
  first lab experiment.
