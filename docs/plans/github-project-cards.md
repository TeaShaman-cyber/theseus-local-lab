# GitHub project cards

> Canonical working cards are now the individual files under
> `docs/plans/project-cards/`. This file is an index/snapshot only; it does not
> replace the authored-plus-commented interaction inventory in those cards.

Bounded inventory from the read-only command:

```text
gh search issues --author TeaShaman-cyber --limit 100
```

This is an authored-issue inventory, not an ownership list. The repository
owner is recorded separately from the fact that the user authored an issue
there.

## Card: Nakama Test blog

```yaml
project: "Nakama Test blog"
repository: "TeaShaman-cyber/nakama-test"
ownership: "user-owned"
repository_source: "user_contract"
issues:
  - number: 1
    state: open
    title: "Proposal: human-gated workflow for agent GitHub Issue actions"
    url: "https://github.com/TeaShaman-cyber/nakama-test/issues/1"
relationship: "local workflow test and blog project"
last_observed: "2026-08-03"
```

## Card: Gramps Web API

```yaml
project: "Gramps Web API"
repository: "gramps-project/gramps-web-api"
ownership: "external"
repository_source: "read_only_discovery"
issues:
  - number: 914
    state: closed
    title: "Feature request: first-class AI and service-account lifecycle"
    url: "https://github.com/gramps-project/gramps-web-api/issues/914"
  - number: 916
    state: closed
    title: "Provide a documented API flow for creating an active local service account"
    url: "https://github.com/gramps-project/gramps-web-api/issues/916"
  - number: 917
    state: open
    title: "Return a distinct error for token requests made with an inactive account"
    url: "https://github.com/gramps-project/gramps-web-api/issues/917"
  - number: 918
    state: open
    title: "Provide an administrator password-rotation flow for local service accounts"
    url: "https://github.com/gramps-project/gramps-web-api/issues/918"
relationship: "family-research MVP integration and service-account feedback"
last_observed: "2026-08-03"
```

## Card: Basic Memory

```yaml
project: "Basic Memory"
repository: "basicmachines-co/basic-memory"
ownership: "external"
repository_source: "read_only_discovery"
issues:
  - number: 1175
    state: open
    title: "[BUG] ChatGPT connector repeatedly prompts for permission and loses capability between discovery and execution"
    url: "https://github.com/basicmachines-co/basic-memory/issues/1175"
  - number: 1176
    state: closed
    title: "[BUG/FEATURE] External issues break Claude triage; add a native agent feedback path"
    url: "https://github.com/basicmachines-co/basic-memory/issues/1176"
relationship: "agent connector, issue-triage, and human-agent interaction feedback"
last_observed: "2026-08-03"
```

## Card: OpenAI Codex

```yaml
project: "OpenAI Codex"
repository: "openai/codex"
ownership: "external"
repository_source: "read_only_discovery"
issues:
  - number: 33965
    state: open
    title: "Windows Desktop does not surface a healthy WSL stdio MCP server"
    url: "https://github.com/openai/codex/issues/33965"
  - number: 34719
    state: open
    title: "Post-compaction turn silently loses tool_search, app connectors, and configured MCP tools"
    url: "https://github.com/openai/codex/issues/34719"
  - number: 35658
    state: open
    title: "ChatGPT Work web silently loses agent-turn continuation around tool calls; external write may still commit"
    url: "https://github.com/openai/codex/issues/35658"
relationship: "Codex Desktop, MCP, compaction, and agent continuity feedback"
last_observed: "2026-08-03"
```

## Evidence boundary

This inventory proves authorship results returned by one bounded GitHub search.
It does not prove that no older issue exists under another account, was opened
by another collaborator, or was only commented on rather than authored by
`TeaShaman-cyber`.
