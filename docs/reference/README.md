# Workspace and Infrastructure Reference

This directory is the checked-in reference layer for local Theseus project and
runtime ownership. It is not a replacement for a project's own README or
AGENTS.md; it answers the first routing question: **which local path is
canonical, and which path is only a runtime/archive/snapshot?**

## Files

- `workspace-registry.yaml` — canonical project repositories and preserved
  archives.
- `infrastructure-registry.yaml` — Docker/runtime stacks, compose roots,
  consumers, and recovery boundaries.

## Read order

1. Read the root `AGENTS.md`.
2. Read `workspace-registry.yaml` before opening or creating a project copy.
3. Read `infrastructure-registry.yaml` before inspecting or mutating Docker.
4. Read the target project's own `AGENTS.md`/README.
5. Verify the live Git/Docker state; registry entries are a routing contract,
   not proof that a service is currently healthy.

## Canonicality rules

- `canonical_path` is the only default source for new changes.
- `work/`, `tmp/`, `output/`, `artifacts/`, and `D:/theseus-archive/` are not
  canonical project sources unless a registry entry explicitly says otherwise.
- A second clone with the same remote must be classified as canonical, stale,
  pilot, or archive before use.
- A path absent from the registry must not become a new canonical project by
  agent guesswork.
- Registry files contain paths, owners, remotes, roles, and safety boundaries;
  never credentials, `.env` values, OAuth state, raw memory, or private dumps.

## Updating the registry

Update the registry in the same coherent checkpoint as a new canonical project,
compose source, runtime-root decision, or recovery-policy change. Run the normal
Git diff and secret/staging checks. Do not update the registry merely because a
runtime-generated directory appeared.
