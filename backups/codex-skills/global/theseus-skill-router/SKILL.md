---
name: theseus-skill-router
description: Use at the start of non-trivial Theseus local-lab work to choose the smallest relevant skill set and execution route. Triggers include meta-skill design, skill priority conflicts, Git/Docker/VS Code/memory/research routing, tool-policy checks, and avoiding one giant Theseus skill.
---

# Theseus Skill Router

Use this as a thin dispatcher. Do not turn it into a knowledge base.

## Routing Rule

Pick the smallest set of skills and tools that covers the current request:

| Request shape | Load first | Then route through |
|---|---|---|
| Prior context, durable decisions, handoff, recall | `theseus-memory-stack` | AutoMem, then MemPalace |
| Cross-layer authority, compact/model switch, repeated failure, conflicting memory | `theseus-memory-stack` | Selective Local Sonar preflight, then live verification |
| PowerShell, WSL, Bash, Node one-liners, quoting, pipes, JSON/text shell work | `theseus-shell-routing` | WSL/Node/script route, then `local-agent-hygiene` |
| Windows, Docker, VS Code, local services, repeated commands | `local-agent-hygiene` | `tools/tool_policy` or VS Code tasks |
| Git status, commit, push, GitHub sync | `theseus-git-hygiene` | Git safety wrapper or VS Code task |
| Creating or changing skills | `skill-creator` | Validate skill shape before adding content |
| Broad research or search pipelines | research queue/hook docs | Store distilled findings, not raw dumps |
| Learning-loop review, reward drift, repeated route patterns | `tools/learning_loop` | Generate proposal, then store accepted decisions |
| Visual maps or diagrams | `visualize` or Mermaid | Keep diagram source in project files when durable |

If two routes are plausible, prefer the one with lower user friction, stronger
verification, and less context load.

## Selective Sonar Gate

Call `sonar_preflight` only when at least one condition holds:

- work resumes after compact or a model/harness switch;
- the task crosses projects or has unclear authority boundaries;
- a local infrastructure mutation needs memory plus runtime constraints;
- a failure or route anti-pattern has repeated;
- recalled decisions conflict, supersede one another, or show temporal drift.

Skip Sonar for trivial prompts and when one clear memory plus fresh runtime
evidence already constrains the route. Sonar is a read-only preflight, never a
permission source or substitute for operational verification.

## Pre-Action Gate

Before local actions, run the intended route through `tools/tool_policy` when
the action touches shell, Docker, Git, VS Code tasks, memory hooks, or repeated
infrastructure checks.

Use the route ranker when there are competing paths:

```text
node tools/tool_policy/route_ranker.mjs --goal "<goal>" --candidate "<route A>" --candidate "<route B>"
```

Treat route scores as provisional. Final reward only exists after verification.

## Skill Size Guardrail

Keep project skills short:

- Put stable procedures in small scripts or VS Code tasks.
- Put detailed references in separate files only when they are needed.
- Put durable lessons in AutoMem.
- Put exact episodic recall in MemPalace.
- Do not copy plugin skill bodies into this router.

## Completion Reflex

When a task changes future agent behavior, store a concise AutoMem decision and
verify recall with a distinctive phrase. Link it to older memories when it
evolves an existing pattern.
