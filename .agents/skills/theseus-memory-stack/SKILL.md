---
name: theseus-memory-stack
description: Use when work in Theseus local lab involves prior context, memory, AutoMem, MemPalace, session continuity, decisions, debugging history, agent handoff, or any task where Codex might otherwise rely on chat context, local notes, raw transcripts, or ad hoc shell searches.
---

# Theseus Memory Stack

## Core Rule

Use MCP memory first. AutoMem is the primary graph-vector memory. MemPalace is
the verbatim palace and diary layer. Local files are fallback evidence, not the
normal memory path.

## Startup Reflex

For non-trivial Theseus work:

1. Check AutoMem health with `mcp__memory.check_database_health`.
2. Recall task context with `mcp__memory.recall_memory` using concrete nouns:
   project names, tools, files, errors, and user corrections.
3. If MemPalace MCP tools are available, search with `mempalace_search` before
   answering about prior work, decisions, people, projects, or old sessions.
4. If MemPalace tools are not available, say the MCP layer is missing and use
   `work/mempalace-pilot` docs or curated local artifacts only as an explicit
   degraded fallback.

## Tool Split

| Need | First tool |
|---|---|
| Preferences, decisions, bug fixes, reusable patterns | AutoMem recall |
| Exact wording, long chat history, session diary | MemPalace MCP |
| Health check for persistent memory | AutoMem health, then MemPalace status |
| Durable decision after discussion | AutoMem store, then verify by recall |
| Raw repo/file evidence | Local files after memory recall |

## Storage Discipline

Store only durable decisions, explicit corrections, reusable patterns, and root
causes. Never store secrets, keys, raw transcripts, backups, or private dumps.
After storing an important AutoMem item, recall a distinctive phrase to verify
it exists. Link related memories when the relation is clear.

## Failure Mode

Do not silently downgrade to model memory. If AutoMem or MemPalace MCP is
unavailable, report the missing layer, continue only with the safest fallback,
and prefer a repair plan over inventing context.
