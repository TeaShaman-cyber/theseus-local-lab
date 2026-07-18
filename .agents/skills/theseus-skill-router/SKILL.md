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
| PowerShell, WSL, Bash, Node one-liners, quoting, pipes, JSON/text shell work | `theseus-shell-routing` | WSL/Node/script route, then `local-agent-hygiene` |
| Windows, Docker, VS Code, local services, repeated commands | `local-agent-hygiene` | `tools/tool_policy` or VS Code tasks |
| Git status, commit, push, GitHub sync | `theseus-git-hygiene` | Git safety wrapper or VS Code task |
| Creating or changing skills | `skill-creator` | Validate skill shape before adding content |
| Broad research or search pipelines | research queue/hook docs | Store distilled findings, not raw dumps |
| Fresh facts, scientific evidence, external technical second opinion, plugin choice | `theseus-plugin-conclave` | Choose one primary oracle and a bounded corroborator |
| Learning-loop review, reward drift, repeated route patterns | `tools/learning_loop` | Generate proposal, then store accepted decisions |
| Visual maps or diagrams | `visualize` or Mermaid | Keep diagram source in project files when durable |

If two routes are plausible, prefer the one with lower user friction, stronger
verification, and less context load.

## Pre-Action Gate

Skills and tools are one execution cycle, not two independent checklists:

```text
goal -> smallest matching skill -> route packet -> tool-policy verdict
     -> execute selected route -> verify -> timeline/memory
```

Before local actions, create a route packet when the action touches shell,
Docker, Git, VS Code tasks, memory hooks, or repeated infrastructure checks.
The packet makes the selected skill explicit input to the tool-policy decision.

```text
node tools/route_packet/route_packet.mjs \
  --skill "theseus-shell-routing" \
  --goal "read recent AutoMem container logs" \
  --candidate "docker logs --tail=80 automem-flask-api-1" \
  --mcp "theseus_docker docker_logs automem-flask-api-1" \
  --vscode-task "Theseus Docker TCP: AutoMem logs"
```

The chosen route is provisional until verification. Do not treat the score as
the reward or use the tool policy to choose a skill after the fact.

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
