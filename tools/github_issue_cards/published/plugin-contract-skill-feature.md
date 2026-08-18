---
status: APPROVED
operation: create
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "architectural: plugins that auto-spawn processes should ship with a skill/contract so agents understand what they deploy"
issue_type: feature_request
issue_number: 87287
verified_at: 2026-08-15
purpose: "Systemic fix: plugins that auto-spawn workers (e.g. Kanban) should ship with a skill or contract declaring their behavior (type: orchestrator, auto-dispatches, spawns workers). Agents installing plugins need this to avoid accidental multi-agent spawns."
observed: "Agent found kanban plugin in hub, installed it, and started deploying. Without a contract/skill, the agent did not understand it was an orchestrator, not a passive task board. Combined with the missing gateway dependency, this led to 30+ auto-spawned workers and a frozen laptop."
labels:
  - enhancement
  - architecture
---

# [Feature]: Plugin installer — require skill/contract for orchestrator plugins

## Problem or Use Case

Agents installing plugins do not understand the plugin's behavior beyond its description. A plugin that auto-spawns workers (like Kanban) looks identical to a passive skill. Combined with missing gateway dependency declarations, this led to an accidental multi-agent orchestration spawn (30+ workers, frozen laptop).

## Proposed Solution

- Plugin manifest declares: `type: orchestrator`, `auto_dispatches: true`, `spawns_workers: true`
- Installer shows a warning: "This plugin auto-spawns worker processes via gateway. Install gateway and enable dispatch to start."
- Plugin ships with a skill (SKILL.md) that describes the operational contract

## Alternatives Considered

- Documentation-only — easy to miss, agents don't read docs at install time
- Manual agent review — unreliable, depends on agent's training

## Additional Context

User had to hard-reboot. On paid models, this would also burn token budget silently.
