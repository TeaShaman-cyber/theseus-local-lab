---
name: theseus-skill-router
description: Use at the start of non-trivial Theseus local-lab work to choose the smallest relevant skill set and execution route. Triggers include meta-skill design, skill priority conflicts, Git/Docker/VS Code/memory/research routing, tool-policy checks, and avoiding one giant Theseus skill.
---

# Theseus Skill Router

Use this as a thin dispatcher. Do not turn it into a knowledge base.

## Council opt-in firewall

Never infer permission for a model council, mask board, or multi-model fan-out
from complexity, architecture, security, a second-opinion request, or a loaded
skill. Without explicit user opt-in, use one model or one bounded worker.

## Execution Cycle

For every non-trivial route, keep these states distinct and observable:

1. **Select** the smallest matching skill set.
2. **Hand off** to the named executor: an existing task, script, MCP tool,
   WSL/Node wrapper, or bounded connector route.
3. **Execute** the selected route.
4. **Verify** an observable postcondition from the executor output, test, log,
   or service response.
5. **Stop** after the postcondition, or re-enter the router for a genuinely new
   phase.

A selected skill is not evidence of execution. A tool call is not evidence of
verification. A memory recall is not current runtime authority. If the route
has no concrete executor or no observable postcondition, it is incomplete.

After one quoting, surface, or route mismatch, choose a compatible executor.
After materially equivalent repeated failure, use `execution-guard` and stop
blind retries. Do not silently reuse a completed phase's route for a new phase.

## Routing Rule

Pick the smallest set of skills and tools that covers the current request:

| Request shape | Load first | Then route through |
|---|---|---|
| Prior context, durable decisions, handoff, recall | `theseus-memory-stack` | AutoMem, then MemPalace |
| Cross-layer authority, compact/model switch, repeated failure, conflicting memory | `theseus-memory-stack` | Selective Local Sonar preflight, then live verification |
| PowerShell, WSL, Bash, Node one-liners, quoting, pipes, JSON/text shell work | `theseus-shell-routing` | Native shell/tool route from the skill |
| Windows, Docker, VS Code, local services, repeated commands | `docs/reference/operations.md` | Native CLI, project task, or verified MCP route |
| Git status, commit, push, GitHub sync | `docs/reference/git.md` | Native `git`/`gh` plus the repository safety scanner |
| Delivering a change: issue, PR, CI gate, review, merge | `theseus-pr-gate-cycle` | Own worktree, `tools/dev/check`, `gh pr checks`, subagent review |
| Creating or changing skills | `skill-creator` | Validate skill shape before adding content |
| Broad research or search pipelines | research queue/hook docs | Store distilled findings, not raw dumps |
| Fresh facts, scientific evidence, external technical oracle, plugin choice | `theseus-plugin-conclave` | Choose one primary oracle and a bounded corroborator; this is not a model council |
| Explicit multi-model council or mask board | `subagent-orchestration` | Require `council_opt_in` and a locked-down advisory runtime |
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
