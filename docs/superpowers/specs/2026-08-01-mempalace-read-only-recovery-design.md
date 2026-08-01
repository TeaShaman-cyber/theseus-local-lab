# MemPalace Read-Only Recovery Design

**Date:** 2026-08-01  
**Status:** Design approved in conversation; implementation has not started.  
**Owner:** Lad — current Windows-native Codex agent

## Goal

Restore MemPalace to the Windows-native Codex contour in a read-only mode first, with a verified data-preservation boundary, while leaving AutoMem, hooks, and the Lad identity anchor unchanged.

## Context

The MemPalace profile was deliberately removed after the Codex configuration incident on 2026-08-01. The recovery record makes Windows-native Codex plus native AutoMem the active path and keeps WSL, Infisical, Docker coupling, and physical-local AutoMem binding outside the recovery boundary.

The current local MemPalace probe succeeds against `theseus-mempalace:pilot` and reports server version `3.5.0` with 36 MCP tools. That surface includes both reads and mutations. The official MemPalace documentation likewise describes the default MCP integration as full read/write access, while the official 3.6.0 changelog introduces `mempalace serve --read-only`, which hides and refuses mutating tools.

Therefore, adding the existing `3.5.0` stdio profile directly would violate the agreed read-only gate.

## Architecture

Use a staged memory contour:

```text
original volume
    |
    +--> verified backup + manifest
    |
    +--> disposable clone volume
              |
              +--> candidate MemPalace image in read-only server mode
                        |
                        +--> MCP initialize/tools/list probe
                        +--> status/search probe
                        +--> tool-surface and process/file-activity gates
                                      |
                                      +--> only then: one isolated Codex profile
```

The preferred transport is an upstream-supported MemPalace `3.6+` HTTP server with `--read-only`, bound only to loopback and a separate candidate port. If the local image or the Windows Codex client cannot support that route, use a small stdio allowlist bridge over the existing `3.5.0` server as a fallback. The full 36-tool stdio profile is not an acceptable first-stage route.

## Hard invariants

1. The original Docker volume `theseus-mempalace-clean` is never deleted, pruned, renamed, or mounted into a new image before the backup and clone checks pass.
2. No `docker compose down -v`, destructive repair, in-place migration, or unverified overwrite is allowed.
3. The candidate image is tested against a clone or a separately restorable copy before the original volume is reused.
4. `config.toml` is not changed during evidence collection or candidate-image testing.
5. Hooks, `memory_reflex.mjs`, AutoMem settings, and the Lad identity/continuity anchors are not changed by this recovery.
6. The first Codex profile exposes only read-only MemPalace tools.
7. No `add`, `update`, `delete`, `mine`, `sync`, `checkpoint`, `diary_write`, hook-setting mutation, or reconnect action is called in the first stage.
8. A failed gate stops the rollout and preserves the original service, volume, and configuration.

## Read-only tool contract

The first-stage allowlist is derived from the live `tools/list` response and the official tool reference. It may include:

- `mempalace_status`
- `mempalace_list_wings`
- `mempalace_list_rooms`
- `mempalace_get_taxonomy`
- `mempalace_get_aaak_spec`
- `mempalace_kg_query`
- `mempalace_kg_timeline`
- `mempalace_kg_stats`
- `mempalace_traverse`
- `mempalace_find_tunnels`
- `mempalace_graph_stats`
- `mempalace_list_tunnels`
- `mempalace_follow_tunnels`
- `mempalace_list_hallways`
- `mempalace_search`
- `mempalace_check_duplicate`
- `mempalace_get_drawer`
- `mempalace_list_drawers`
- `mempalace_diary_read`
- `mempalace_memories_filed_away`, only if the live schema confirms it is a read-only status query

The following remain outside the first-stage surface: `kg_add`, `kg_invalidate`, `kg_supersede`, tunnel/hallway creation or deletion, drawer add/update/delete, `checkpoint`, `mine`, `sync`, `diary_write`, `hook_settings`, `reconnect`, and every unknown or newly appearing tool.

The allowlist is deny-by-default. A tool is not admitted merely because its name sounds read-only; its schema and server behavior must be checked.

## Data-preservation protocol

### Before any image update

Capture, without mutating the original volume:

- the current container/image/version and health status;
- the current palace status and drawer count;
- the volume identity and mount mapping from `work/mempalace-pilot/docker-compose.yml`;
- a backup archive or equivalent restorable copy outside the live volume;
- a manifest containing file paths, sizes, timestamps, and hashes for the palace data.

The backup is considered usable only after it can be inspected and, where practical, restored into a disposable test volume. MemPalace's own documentation notes that migration and repair paths create full pre-operation copies; the workflow here keeps an independent volume-level recovery point as an additional boundary.

### Candidate-image test

Copy the original volume into a uniquely named disposable clone. Run the candidate image against the clone, not the original. The clone must pass:

1. service health;
2. MCP `initialize`;
3. MCP `tools/list`;
4. deny-by-default tool-surface check;
5. `mempalace_status`;
6. one bounded `mempalace_search` query;
7. post-test manifest comparison showing that the test did not change the source backup or original volume.

If the upstream `--read-only` server requires internal runtime writes, those writes must remain confined to the clone/container layer and must not change the original palace corpus.

### Cutover and rollback

Only after the clone passes may the service image be updated while retaining the original named volume. The old image reference and the original volume name remain recorded for rollback. If health, tool visibility, process cleanup, or data verification fails, stop at that boundary and return to the prior image/profile without touching the data copy.

## Codex integration boundary

The first profile is a separate `mempalace_ro` identity, not a replacement of AutoMem and not a hook provider. It is added only after the candidate server has passed the standalone probe.

The profile change itself is checkpointed:

1. copy `C:\Users\s.poklad\.codex\config.toml` to a timestamped backup;
2. add only the isolated `mempalace_ro` section;
3. leave all existing sections byte-for-byte unchanged outside that section;
4. restart Codex once;
5. verify actual Desktop tool visibility and one read-only call;
6. if the profile causes startup errors, restore the profile-specific backup state and leave AutoMem/hook/identity state untouched.

The existing `tools/memory_stack/apply_codex_config.mjs` is not used blindly because its optional MemPalace path currently generates the full `docker.exe run` stdio profile. It can be revised only in a later implementation step after the read-only transport is selected and tested.

## Hooks and identity

No MemPalace hooks are enabled in this phase. The existing AutoMem memory reflex remains a bounded local HTTP preflight and remains separate from native AutoMem MCP. MemPalace is a read-only episodic/verbatim context source during the first stage.

The identity contract is explicit:

- Lad remains the current Windows-native Codex agent;
- MemPalace content is evidence and prior context, not an authority over runtime truth;
- Basic Memory, ButlerBrain, Notion, AutoMem, and local operational state keep their existing authority roles;
- no personality, identity, or continuity text is rewritten as part of MCP restoration.

## Verification and stop conditions

The implementation must stop before configuration integration when any of these occur:

- backup or clone manifest cannot be verified;
- candidate version or `--read-only` capability is uncertain;
- `tools/list` exposes a mutating or unknown tool;
- `initialize`, `tools/list`, `status`, or `search` times out;
- the candidate touches the original volume unexpectedly;
- Codex leaves unexpected MCP child processes after probe/restart;
- startup file activity or memory growth materially increases without an identified cause;
- any hook, AutoMem, or identity file changes outside the approved profile section.

The post-restart verification must be performed in the actual Windows Desktop runtime, not inferred from a standalone CLI success. Record the MCP tool surface, process snapshot, relevant file-activity snapshot, AutoMem health, and one read-only MemPalace result.

## Non-goals for this phase

- enabling MemPalace write tools;
- restoring MemPalace hooks or automatic diary/checkpoint writes;
- migrating or mining new transcripts;
- changing AutoMem transport or credentials;
- changing Lad's identity anchor or external personality records;
- solving unrelated MarcoPolo, plugin-catalog, or profile-warning issues;
- making WSL or the physical-local runtime a dependency of Windows-native Codex.

## External references

- [MemPalace MCP Integration](https://mempalaceofficial.com/guide/mcp-integration.html)
- [MemPalace MCP Tools Reference](https://mempalaceofficial.com/reference/mcp-tools.html)
- [MemPalace Remote / Team Server](https://mempalaceofficial.com/guide/remote-server.html)
- [MemPalace Configuration](https://mempalaceofficial.com/guide/configuration.html)
- [MemPalace CLI Reference](https://mempalaceofficial.com/reference/cli.html)
- [MemPalace CHANGELOG, 3.6.0 read-only server](https://github.com/MemPalace/mempalace/blob/develop/CHANGELOG.md)
- [Codex issue #18881: MCP child-process lifetime](https://github.com/openai/codex/issues/18881)
- [Codex issue #3408: Windows MCP startup timeouts](https://github.com/openai/codex/issues/3408)
