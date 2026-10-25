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

`block` and `warn` decisions are logged automatically when using the CLI. Use
`--log` to also record allowed decisions, or `--no-log` for a one-off dry check.

Logs are written to ignored local files:

```text
outputs/tool_policy/YYYY-MM-DD.jsonl
```

The workshop dashboard reads these logs as blameless route incidents. A yellow
alert means a route choice needs review; it is not a moral failure or a service
outage by itself.

## Current Reflexes

- Warn on raw Docker CLI, but do not blanket-block it. Prefer Docker MCP, Docker
  TCP VS Code tasks, or `tools/docker_control_plane` when they support the
  operation; keep CLI use bounded to the explicit task scope.
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

## Bind Skill To Tool Choice

`route_packet` closes the gap between a semantic skill choice and a concrete
tool choice. It records one small, machine-readable handoff:

```text
selected skill -> ranked candidates -> policy verdict -> verification pending
```

```text
node tools/route_packet/route_packet.mjs \
  --skill "theseus-shell-routing" \
  --goal "inspect Docker containers" \
  --candidate "docker ps" \
  --mcp "theseus_docker docker_ps"
```

Packets are written to ignored `outputs/route_packet/YYYY-MM-DD.jsonl` and
mirrored to the session timeline. The packet is a route contract, not a new
large skill and not an execution sandbox.

This is GRPO-inspired only in the small local sense: compare a group of route
candidates relative to each other instead of treating one reward score as
absolute truth.

## Goodhart Guardrail

Route score is not final reward. A route starts with `final_reward.status:
pending`; only a verification outcome should turn it into a reinforced habit.

Known-safe wrappers get positive reinforcement, but they can still lose when
they do not fit the goal. This prevents "use the blessed wrapper" from becoming
a new proxy that replaces the actual task.

Penalty is score hygiene, not behavior change. When a route fails, the useful
learning artifact is not "subtract more points"; it is one or more concrete
changes to the harness:

- classify the failure class;
- add or tighten a policy guardrail;
- change a VS Code task, preflight bundle, or route candidate;
- add a regression test or dashboard alert;
- store the accepted decision in memory;
- document why no action is needed.

A reward model must not promote a route-policy change from score movement alone.
It needs causal evidence that the future route became more observable,
verifiable, or harder to misuse.

## Intended Use

This is not a full sandbox. It is a small policy gate that makes repeated
mistakes visible and harder to repeat. Future work can connect it to the VS Code
bridge, hooks, or a stricter command broker that refuses to execute blocked
actions.
