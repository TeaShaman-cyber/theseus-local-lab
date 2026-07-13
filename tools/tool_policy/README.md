# Theseus Tool Policy

Small pre-action broker for local agent hygiene.

This is the first hard barrier between memory and behavior. AutoMem and
MemPalace can say what went wrong before; this broker turns those lessons into
an executable `allow`, `warn`, or `block` decision before the agent asks for a
fragile tool route.

## Check A Command

```text
node tools/tool_policy/tool_policy.mjs -- docker ps
```

Blocked commands exit with code `2`. Allowed and warned commands exit with code
`0`.

## Log A Decision

```text
node tools/tool_policy/tool_policy.mjs --log -- docker ps
```

Logs are written to ignored local files:

```text
outputs/tool_policy/YYYY-MM-DD.jsonl
```

## Current Reflexes

- Block raw Docker shell commands; route to Docker MCP, Docker TCP VS Code tasks,
  or `tools/docker_control_plane`.
- Block raw PowerShell scripts; route to VS Code tasks or Node wrappers.
- Block broad Git staging such as `git add -A`; require explicit scope review.
- Allow known Theseus Node wrappers, `hooks/hook-router.mjs`,
  `tools/service_status`, `tools/workshop_dashboard`, and read-only Git
  inspection.
- Warn on unclassified shell commands and direct network calls.

## Reinforcement

Every decision includes a small reinforcement signal:

- `reward +2` for known safe Theseus wrappers.
- `reward +1` for low-risk allowed routes.
- `neutral 0` for caution/warn routes.
- `friction -2` for blocked risky routes.

The goal is not to punish mistakes forever. The goal is to make good tool
choices visible and repeatable, so future analysis can track successful
adaptation as well as failures.

## Rank Candidate Routes

Use `route_ranker.mjs` when there are several plausible ways to act:

```text
node tools/tool_policy/route_ranker.mjs \
  --goal "read recent AutoMem container logs" \
  --candidate "docker logs --tail=80 automem-flask-api-1" \
  --mcp "theseus_docker docker_logs automem-flask-api-1" \
  --vscode-task "Theseus Docker TCP: AutoMem logs"
```

The ranker scores routes across:

- safety
- task fit
- repeatability
- context cost
- user friction
- verification strength

This is GRPO-inspired only in the small local sense: compare a group of route
candidates relative to each other instead of treating one reward score as
absolute truth.

## Goodhart Guardrail

Route score is not final reward. A route starts with `final_reward.status:
pending`; only a verification outcome should turn it into a reinforced habit.

Known-safe wrappers get positive reinforcement, but they can still lose when
they do not fit the goal. This prevents "use the blessed wrapper" from becoming
a new proxy that replaces the actual task.

## Intended Use

This is not a full sandbox. It is a small policy gate that makes repeated
mistakes visible and harder to repeat. Future work can connect it to the VS Code
bridge, hooks, or a stricter command broker that refuses to execute blocked
actions.
