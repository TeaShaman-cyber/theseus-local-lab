card_id: ISSUE-20260815-001
status: READ_BACK_VERIFIED

project: "Hermes Agent"
repository: "NousResearch/hermes-agent"
repository_source: "user_contract"
target_confirmation: "user_confirmed"
issue_number: 87045
issue_url: "https://github.com/NousResearch/hermes-agent/issues/87045"
operation: "create"

purpose: "Report bug: native xAI TTS provider uses xAI-OAuth subscription credentials (403 on /v1/tts) instead of the paid XAI_API_KEY, so Grok TTS never works even with a funded key"
duplicate_check: "not-run"
evidence:
  - "tools/xai_http.py: resolve_xai_http_credentials() prefers managed xai-oauth pool over XAI_API_KEY"
  - "tools/tts_tool.py: _generate_xai_tts() calls resolve_xai_http_credentials() with no key priority"
  - "Empirical: direct POST https://api.x.ai/v1/tts with XAI_API_KEY -> 200; native _generate_xai_tts() -> 403"

draft:
  title: "Bug: native xAI TTS provider returns 403 (uses OAuth subscription creds, not paid XAI_API_KEY)"
  body: |
    ## Context

    A user funded an xAI API key (`XAI_API_KEY` in `~/.hermes/.env`) and set
    `tts.provider=xai` with `tts.xai.voice_id=Zagan` + `tts.xai.language=ru`.
    TTS should work, but the native provider fails.

    ## Observed behavior

    - Direct `POST https://api.x.ai/v1/tts` with the same `XAI_API_KEY`
      (Bearer) returns `200` and valid audio.
    - The native Hermes path (`tools.tts_tool._generate_xai_tts`) returns
      `403 Client Error: Forbidden for url: https://api.x.ai/v1/tts`.

    ## Root cause

    `tools/xai_http.py::resolve_xai_http_credentials()` resolves credentials in
    this order:

    1. Load the managed `xai-oauth` credential pool and `select()` the first
       entry. If its `access_token` is non-empty, return it immediately
       (`provider: xai-oauth`).
    2. Only if that fails, fall back to `XAI_API_KEY`.

    The user has an xAI/Grok **subscription** connected via OAuth
    (`xai-oauth`). That OAuth token covers chat but **does not cover TTS**
    (xAI returns `403` on `/v1/tts`). Because the OAuth token is non-empty,
    the function returns it and the paid `XAI_API_KEY` is never consulted.

    Result: native xAI TTS always sends the subscription OAuth token and gets
    `403`, even when a funded `XAI_API_KEY` is present.

    ## Suggested fix

    For TTS specifically, prefer an explicit `XAI_API_KEY` over the
    `xai-oauth` subscription token. Minimal change in
    `tools/tts_tool.py::_generate_xai_tts`:

    ```python
    explicit_key = str(get_env_value("XAI_API_KEY") or "").strip()
    if explicit_key:
        creds = {
            "provider": "xai",
            "api_key": explicit_key,
            "base_url": str(get_env_value("XAI_BASE_URL") or DEFAULT_XAI_BASE_URL).strip().rstrip("/"),
        }
    else:
        creds = resolve_xai_http_credentials()
    ```

    (Chat/image paths can keep the existing OAuth-first order; only speech
    synthesis needs the paid key.)

    ## Verification

    - With `XAI_API_KEY` set and a funded balance: native `_generate_xai_tts`
      must return `200` and write audio.
    - Without `XAI_API_KEY`: behavior unchanged (falls back to OAuth logic).

    ## Scope / non-goals

    - Does not change chat/image auth.
    - No secrets in this card; `XAI_API_KEY` value is never included.
  comment: ""
  labels: ["bug", "tts", "xai"]

human_review:
  requested_at: "2026-08-15"
  approved_at: "2026-08-15"
  approval_scope: "Создать issue в NousResearch/hermes-agent (user_confirmed)"
  approver: "user"

readback:
  required: true
  expected: "После создания получить номер, URL, title и state новой issue"
  observed: "Created #87045; state OPEN; title and URL match exactly; body matches approved local draft (xAI TTS 403 OAuth-vs-API-key root cause + suggested fix)."
  verified_at: "2026-08-15T15:30:00+02:00"

notes: "Issue опубликован. Локальный фикс в tts_tool.py уже применён и проверен E2E (success=True, Заган по-русски). PR не делали — user решил оставить issue."
