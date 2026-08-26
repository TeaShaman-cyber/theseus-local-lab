# Documentation Audit Plan

Purpose: create a clean map of the Theseus local lab documentation before
rewriting or expanding it. The first output should be a documentation inventory
and debt report, not a polished manual.

## Scope

Audit tracked, curated project documentation:

- root markdown files such as `TASKS.md`, `AGILE.md`, `VISUAL_MAP.md`,
  `RESTORE.md`, `HOOKS_PIPELINE.md`, `MODEL_LIMITATIONS.md`,
  `CODEX_VSCODE.md`, `VSCODE_SETUP.md`, `VMWARE_UBUNTU_LAB.md`, and
  `GIT_META_SKILL.md`;
- service docs such as `backup-lattice/README.md`, `log-lattice/README.md`,
  `automem-graph-viewer/README.md`, `secrets-lab/README.md`,
  `stateful-agent-net/README.md`, `agent-shell/README.md`, and
  `codewhale/README.md`;
- tool docs under `tools/*/README.md`;
- local agent skills under `.agents/skills/*/SKILL.md` and
  `skills/*/SKILL.md`;
- VS Code task and workflow files when they define user-visible operations.

Also assess whether selected stable pages should be published outward to GitHub
Wiki after the repository docs are cleaned up. The repository should remain the
source of truth; Wiki can become a reader-friendly mirror for stable runbooks,
architecture maps, and public-facing explanations.

## Non-Goals

Do not read, summarize, export, or include:

- API keys, `.env`, `.env.local`, private keys, or secret values;
- raw backup archives;
- raw memory dumps;
- raw private transcripts;
- high-volume ignored logs except as aggregate evidence.

## Method

1. Build a documentation inventory table.
2. Classify each document by Diataxis type: tutorial, how-to, reference,
   explanation, or mixed.
3. Mark the current owner area: memory, Docker, backups, observatory, Git,
   VS Code, CodeWhale, keychain, research, agile/process, or recovery.
4. Identify how each workflow splits across skills, VS Code tasks, scripts,
   MCP tools, memory, and logs.
5. Identify duplicates, stale claims, missing entry points, and files that are
   too broad for one document.
6. Run a prompt hygiene pass over agent-facing instructions: mark duplicated or
   conflicting rules, inert examples, stale model-specific habits, irrelevant
   tools, missing success criteria, missing stop conditions, and missing
   verification loops.
7. Propose a minimal target structure before editing content.

## Expected Output

Write one audit report under `docs/audits/` with:

- a short executive summary;
- an inventory table;
- a proposed documentation map;
- a GitHub Wiki suitability note for stable reader-facing pages;
- a GitHub surface note for Wiki, Issues, Projects, Actions, and repo docs;
- a harness map showing which skills choose routes, which tasks/scripts/MCP
  tools execute them, which memory layer stores rationale, and which log layer
  proves the outcome;
- a prompt hygiene section covering `AGENTS.md`, project skills, task
  descriptions, advisor prompts, and tool docs;
- a list of high-risk stale or duplicated areas;
- a minimal rewrite sequence with small commits;
- open questions that need Semyon's judgment.

## Acceptance Criteria

- The report lets a future agent find the right doc without loading the whole
  repository into context.
- `AGENTS.md` remains short and route-oriented.
- No secrets, raw logs, raw transcripts, memory dumps, or backup archives are
  included.
- Any proposed rewrite is split into reviewable steps.
- GitHub Wiki, if recommended, is treated as a mirror/publication layer rather
  than the only editable copy.
- External advisor output is treated as a second opinion, not a replacement
  for local evidence.
- The audit preserves the distinction between cognitive route selection
  (skills), motor execution (tasks/scripts/MCP), durable rationale
  (AutoMem/MemPalace), and observable evidence (`session_timeline` /
  `log-lattice`).
- The audit preserves true invariants while reducing duplicated prompt rules,
  stale model-specific habits, and instructions that do not change behavior.
- Any model-specific prompting advice is dated, sourced, and treated as
  workload-dependent until validated on representative Theseus tasks.
- The audit names checks needed after documentation changes, such as JSON parse,
  markdown lint if available, and the Git staging scanner.

## Suggested First Pass

Use this rough grouping as a starting hypothesis:

- onboarding and workflow: `TASKS.md`, `AGILE.md`, `VISUAL_MAP.md`;
- recovery and backups: `RESTORE.md`, `backup-lattice/README.md`,
  `tools/backup_lattice/README.md`;
- memory and observability: `tools/memory_hook/README.md`,
  `tools/memory_context/README.md`, `tools/session_timeline/README.md`,
  `log-lattice/README.md`, `automem-graph-viewer/README.md`;
- infrastructure and IDE: `VSCODE_SETUP.md`, `CODEX_VSCODE.md`,
  `VMWARE_UBUNTU_LAB.md`, `agent-shell/README.md`,
  `tools/vscode_bridge/README.md`, `tools/docker_control_plane/README.md`;
- advisors and harnesses: `codewhale/README.md`,
  `tools/junior_context/README.md`;
- research and constraints: `HOOKS_PIPELINE.md`, `MODEL_LIMITATIONS.md`,
  `stateful-agent-net/README.md`.
