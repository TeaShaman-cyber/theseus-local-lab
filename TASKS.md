# Theseus Local Lab Kanban

Updated: 2026-07-10

## Inbox

- [ ] P2 Research ChatGPT Work capabilities beyond official docs.
  - Outcome: compare official docs with independent reports, safety behavior,
    local desktop behavior, and real workflow implications.
  - Notes: include model safety/filter constraints that may affect
    mechanobiology, biology, medicine, and adjacent research.

- [ ] P2 Design model/harness selection matrix.
  - Outcome: when to use GPT-5.6 variants, Bothub/DeepSeek, CodeWhale, local
    Docker Model Runner, Chat, Work, and Codex.

- [ ] P3 Explore GitHub Issues or Projects sync.
  - Outcome: decide whether markdown kanban should remain source of truth or
    sync outward.

## Ready

- [ ] P1 Verify cloud backup restore path.
  - Outcome: download or inspect a Google Drive-synced archive, read manifest,
    and document restore commands.
  - Done when: latest archive is confirmed outside the repo-local fallback path.

- [ ] P1 Create `WORKFLOW.md` or keep `AGILE.md` as the stable workflow map.
  - Outcome: decide if `AGILE.md` is enough or whether a shorter user-facing
    workflow file is needed.

- [ ] P1 Add backup retention policy.
  - Outcome: keep enough local/cloud archives without filling phone-internet or
    laptop disk.
  - Candidate: keep hourly/daily recent archives locally, weekly/monthly in
    cloud mirror.

- [ ] P1 Add restore drill script or checklist.
  - Outcome: test backup archive structure without destructive restore.

- [ ] P2 Build Work briefing template.
  - Outcome: reusable prompt for ChatGPT Work sessions that imports project
    state without dumping secrets or excessive context.

## Doing

- [ ] P1 Establish agile-style project coordination.
  - Owner: Codex.
  - Current step: add Mermaid visual map.

## Review

- [ ] P1 VS Code visual IDE setup.
  - Status: VS Code updated, legacy extensions removed, GitHub/Docker/Python/
    Markdown/Mermaid/spellcheck/lint workspace configured.
  - Needs: user comfort check in real VS Code session.

- [ ] P1 Background data backup lattice.
  - Commit: `c223a47`.
  - Status: running locally; Google Drive folder sync configured by user.
  - Needs: cloud-side confirmation and retention policy.

- [ ] P1 CodeWhale memory context bridge.
  - Commit: `5741ff0`.
  - Status: context export and memory inbox tested.
  - Needs: real CodeWhale conclave with sanitized prompt or explicit export
    approval.

- [ ] P1 Background observatory service.
  - Commit: `d519215`.
  - Status: collector runs in Docker every 15 minutes when laptop is awake.
  - Needs: note hibernation gaps in observatory analysis.

## Blocked

- [ ] P2 Direct external upload of private backup archives through connector.
  - Blocker: export policy requires explicit confirmation for private local
    memory/data archives.
  - Fallback: Google Drive for desktop syncs local folder.

- [ ] P2 Full CodeWhale conclave over AutoMem-derived context.
  - Blocker: external model export risk without explicit confirmation.
  - Fallback: use sanitized prompts or local context packs.

## Done

- [x] P0 Initialize safe restore kit and private GitHub repo.
- [x] P0 Configure AutoMem local stack and MCP memory tools.
- [x] P0 Configure backup-runner local and Google Drive folder mirror.
- [x] P1 Configure Google Drive for desktop autostart.
- [x] P1 Create portable memory context bridge for CodeWhale.
- [x] P1 Create background observatory collector.
