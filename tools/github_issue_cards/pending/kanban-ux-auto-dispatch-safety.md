---
status: DRAFT
operation: create
project: hermes-agent
repository: NousResearch/hermes-agent
repository_source: user_contract
target_confirmation: user_confirmed
approval_scope: "report UX failure: kanban plugin auto-spawned 30+ worker processes without user direction due to gateway dependency not being declared at install time"
issue_type: bug_report
purpose: "Report that the Kanban plugin's gateway dependency and automatic worker dispatch behavior is not documented at install time, causing users to accidentally spawn a multi-agent orchestration system when they thought they were using a simple task board."
observed: "Installed native Kanban plugin thinking it was a simple task board (like Redmine/Trello). After installing gateway (separately), the dispatcher auto-promoted triage tasks and spawned 30+ worker processes that froze the laptop. Documentation does not warn that: (1) gateway is a hard dependency for any task processing, (2) the dispatcher auto-promotes and forks workers without explicit user action, (3) there is no global max_concurrent_workers limit. This is a UX safety issue — users on paid models could burn significant token budget before they understand what happened."
labels:
  - ux
  - documentation
  - safety
---

# Kanban plugin: gateway dependency and auto-dispatch behavior not documented at install time

## Summary

I installed the Kanban plugin as a simple task board. After installing `gateway` for a separate cron job, the dispatcher auto-promoted my backlog tasks and spawned 30+ worker processes that froze my laptop. Documentation at install time does not disclose that gateway is a hard dependency, that dispatch is automatic, or that there is no global concurrency cap.

## Steps to reproduce

1. `hermes kanban init`
2. Create several backlog cards in `triage`
3. Install and start `hermes gateway` (separately, for another job)
4. Dispatcher auto-promotes triage → ready → running, forks workers for each
5. System freezes from 30+ concurrent worker processes

## Expected behavior

Either (a) declare gateway as a hard dependency at install, (b) require explicit opt-in before auto-dispatch, or (c) add a global `max_concurrent_workers` cap to prevent parallel floods.

## Environment

- Hermes v0.20.1, Windows 11
- Model: meituan/longcat-2.0:free (free tier — damage would be financial on paid models)
