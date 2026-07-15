# Theseus Local Lab Kanban

Updated: 2026-07-15

## Inbox

- [ ] P2 Research ChatGPT Work capabilities beyond official docs.
  - Outcome: compare official docs with independent reports, safety behavior,
    local desktop behavior, and real workflow implications.
  - Notes: include model safety/filter constraints that may affect
    mechanobiology, biology, medicine, and adjacent research.

- [ ] P2 Design model/harness selection matrix.
  - Outcome: when to use GPT-5.6 variants, Bothub/DeepSeek, CodeWhale, local
    Docker Model Runner, Chat, Work, and Codex.

- [ ] P1 Add usage-limit telemetry to observatory.
  - Outcome: collect visible usage percentage, reset time, and work-session
    notes so limit pressure can be analyzed with local system signals.

- [ ] P1 Design Stanford-style learning loop for Codex.
  - Outcome: turn repeated mistakes into session journal entries, AutoMem
    memories, and local skills that change future tool-choice behavior.

- [ ] P1 Prototype hooks-based research pipeline.
  - Outcome: use ChatGPT Work/Codex hooks to add startup context, log prompts
    and tool results, route repeated research needs into connector-backed
    queues, and protect against unsafe or wasteful tool paths.
  - Status: local queue scripts and VS Code tasks added; exact ChatGPT Work hook
    config surface still needs verification.

- [ ] P1 Create local inventory script for WSL/Docker/proxy contexts.
  - Outcome: collect comparable read-only facts from Codex, normal PowerShell,
    VS Code terminal, and later VS Code Remote WSL.
  - Notes: write JSON to ignored `outputs/local_inventory/`; do not read
    `.env`, Docker credentials, backup archives, raw memory, or private
    transcripts.

- [ ] P1 Build durable AutoMem/Docker control path.
  - Outcome: let Codex check, restart, and inspect AutoMem through a narrow
    approved path without relying on raw Docker CLI access from the sandbox.
  - Candidate paths: VS Code user-context task, Docker Desktop MCP Toolkit, or a
    small local bridge with allowlisted commands and journaled output.
  - Notes: manual Docker Desktop start works as an emergency fallback only.

- [ ] P1 Pilot Ubuntu VM agent workbench over SSH.
  - Outcome: use VMware Ubuntu as a clean Linux test stand without migrating the
    primary Codex/ChatGPT Work project state yet.
  - Known VM: `C:\Users\s.poklad\Documents\Virtual Machines\Ubuntu 64-bit\Ubuntu 64-bit.vmx`.
  - Next: configure SSH in the guest, then run read-only inventory for OS,
    packages, Docker, Git, proxy/network, disk, RAM, and VMware Tools.

- [ ] P1 Harden PDF reading workflow.
  - Outcome: use bundled Python with UTF-8 stdout, `pypdf`/`pdfplumber`, and
    render/OCR fallback when text extraction is weak.
  - Notes: store temporary extracts under ignored `outputs/pdf_extracts/`.

- [ ] P3 Explore GitHub Issues or Projects sync.
  - Outcome: decide whether markdown kanban should remain source of truth or
    sync outward.

## Ready

- [x] P2 Add Graphify harness pilot task.
  - Outcome: create a repeatable wrapper or VS Code task that builds a sanitized
    corpus outside ignored repo paths, runs `graphify extract --code-only`, runs
    smoke queries, and writes a compact summary.
  - Guardrail: do not run `graphify install`; do not modify `AGENTS.md`, Codex
    hooks, Git hooks, or secret-bearing files.
  - Pilot: `docs/research/graphify_pilot_2026-07-15.md`.
  - Done: `tools/graphify_harness/graphify_harness.mjs` and VS Code task
    `Theseus Graphify Harness: build`.

- [ ] P1 Run runtime resilience sea trial.
  - Outcome: execute one small continuity task through AutoMem recall, route
    choice, safe permission/tool denial, failure classification, evidence save,
    `RETURN_TO_CYCLE`, and verification across Git/AutoMem/Deepnote.
  - Tracks: `model_identity_drift`, `audit_context_cost`,
    `premature_stop_after_formal_deliverable`.
  - Plan: `docs/plans/runtime_resilience_sea_trial.md`.

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

- [ ] P1 Direct Docker control from Codex sandbox.
  - Blocker: Codex runs as `spoklad\codexsandboxoffline`; Docker CLI can see the
    client but cannot access the user Docker config or named pipe.
  - Fallback: user can start AutoMem in Docker Desktop; Codex can then use the
    AutoMem MCP tools normally.

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
