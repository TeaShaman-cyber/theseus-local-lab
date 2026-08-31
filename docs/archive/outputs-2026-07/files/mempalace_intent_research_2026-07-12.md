# MemPalace Intent Research - 2026-07-12

## What MemPalace Is For

MemPalace is a local-first AI memory system. Its core promise is verbatim
storage: keep original words, retrieve exact text with semantic search, and
avoid summary-first memory drift.

Official framing:

- Stores conversation history as verbatim text.
- Does not summarize, extract, or paraphrase as the primary storage path.
- Organizes memory into wings, rooms, halls, tunnels, closets, and drawers.
- Uses metadata filtering so search can be scoped by project/person/topic.
- Runs locally by default; nothing leaves the machine unless the user opts in.
- Exposes MCP tools so the AI searches and writes memory automatically after
  setup.

## Design Implications For Theseus

Use MemPalace for exact recall, not as a dumping ground.

Good use:

- Exact old wording from chats, decisions, logs, and session notes.
- Scoped project/person/topic lookup through wings and rooms.
- Agent-accessible MCP search before answering about prior work.
- Small curated drawers added during or after important sessions.
- Optional wake-up context only when it stays bounded.

Bad use:

- Mining every old output, backup, raw transcript, or stale pilot corpus by
  default.
- Treating MemPalace as a replacement for AutoMem.
- Using it as a huge context preloader.
- Manually running searches forever after MCP is connected.
- Mixing test/pilot data with the permanent palace.

## Relationship To AutoMem

AutoMem and MemPalace should complement each other:

| Layer | Role |
|---|---|
| AutoMem | Distilled decisions, preferences, bug roots, reusable patterns, graph links |
| MemPalace | Verbatim source memory, exact snippets, diaries, scoped semantic retrieval |

Default flow:

1. AutoMem for stable project state and preferences.
2. MemPalace for exact source recall when prior wording or session context
   matters.
3. Local files only as explicit fallback or primary repo evidence.

## Clean Setup Rule

Permanent MemPalace must start clean and fast.

- Use a fresh volume for the permanent MCP server.
- Do not point it at old pilot data.
- Do not mine `outputs/`, old chat exports, or backups wholesale.
- Add only curated seed drawers first.
- Use dry-run and small limits before any larger mining pass.

Current intended Docker MCP shape:

```text
docker.exe run -i --rm -v theseus-mempalace-clean:/data theseus-mempalace:pilot
```

## First Seed Candidates

For the clean palace, prefer a few high-signal drawers:

- Project purpose: Theseus local lab and memory stack.
- Current memory policy: AutoMem primary distilled memory; MemPalace verbatim
  recall.
- Current correction: do not drag old pilot data into permanent MemPalace.
- Git/secret safety policy if agents need exact wording.

Avoid raw secrets, `.env`, backup archives, huge transcripts, and stale
experimental corpora.

## Sources

- https://github.com/MemPalace/mempalace
- https://mempalaceofficial.com/concepts/the-palace.html
- https://mempalaceofficial.com/concepts/memory-stack.html
- https://mempalaceofficial.com/guide/getting-started.html
- https://mempalaceofficial.com/guide/mining.html
- https://mempalaceofficial.com/guide/searching.html
- https://mempalaceofficial.com/guide/mcp-integration.html
