# GitHub Issue Watch

Read-only field report for upstream GitHub issues that can affect the Theseus
local lab. The first target is:

```text
https://github.com/openai/codex/issues
```

## Usage

```text
node tools/github_issue_watch/github_issue_watch.mjs
node tools/github_issue_watch/github_issue_watch.mjs --write
node tools/github_issue_watch/github_issue_watch.mjs --json --write
```

`--write` stores:

```text
outputs/github_issue_watch/openai-codex.json
outputs/github_issue_watch/openai-codex.md
```

The workshop dashboard reads only this cache. It does not poll GitHub on every
page refresh.

## Our Upstream Reports

`tracked_issues.json` is a small, reviewed watchlist of reports submitted by
Theseus. Each refresh records state, labels, issue reactions, latest comment,
and a separate `maintainer_response` signal based on GitHub's author
association. This keeps a community reply distinct from a response by a
repository maintainer.

The watchlist is configuration, not a ledger of private conversations. Keep
only public issue references and a concise purpose there.

## Signal Shape

The report highlights issues that match Theseus pain points:

- sandbox, permissions, approvals, ACLs;
- Windows, PowerShell, WSL, Docker;
- Git, SSH, credentials, auth;
- context, memory, compaction, history;
- MCP, connectors, tool routing;
- crashes, hangs, network/proxy failures, UI problems.

This is observability, not a verdict. A noisy upstream issue should become a
local action only when it maps to a real Theseus route, guardrail, test, or
documented no-action rationale.
