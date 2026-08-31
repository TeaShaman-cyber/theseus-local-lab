# theseus-local-lab

Private research lab of the Theseus program: agent operations workshop,
documentation, tooling, and local infrastructure experiments.

> **Identity note:** the local folder is historically named
> `life-science-research-plugin-life-science-4` — this is intentional
> (renaming would break live sessions/terminals). The canonical project id
> is `theseus-local-lab`; see `docs/reference/workspace-registry.yaml`.

## Top-level map

| Path | What |
|---|---|
| `AGENTS.md` | entry map and operating rules for agents (read first) |
| `docs/reference/` | canonical registries: workspace-registry.yaml, infrastructure-registry.yaml |
| `docs/research/` | research data and chronologies (model-helper-chronology etc.) |
| `docs/audits/`, `docs/plans/` | audits and live plans |
| `docs/archive/` | historical material (issue drafts, July-era outputs) |
| `tools/` | 40+ small tool projects — see `tools/INDEX.md` before touching |
| `gtd/` | Docker stack for the GTD pilot |
| `hooks/`, `.githooks/`, `.agents/`, `skills/` | operating harness |
| `outputs/` | (archived 2026-09 → `docs/archive/outputs-2026-07/`; new outputs go to docs/research or stay untracked) |

## Twin directories (disambiguation)

- `secrets-lab/` (root, compose stack) vs `tools/secrets_lab/` (tooling)
- `backup-lattice/` (root, compose stack) vs `tools/backup_lattice/` (tooling)
- `log-lattice/` (root, stack) vs nothing in tools/
- `output/` (untracked scratch) vs `outputs/` (archived; now docs/archive/outputs-2026-07)

Provenance: prepared by Svarog (Hermes agent) with Semyon Poklad; structure
decision researched in theseus-local-lab#1 with a three-model free-pool
council (nemotron-ultra-550b, minimax-m3, ling-3.0-flash-fin).
