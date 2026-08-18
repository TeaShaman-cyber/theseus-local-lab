# Draft issue — SagTask fails to load on Hermes v0.20.0 ("no register() function")

> STATUS: DRAFT — not submitted. For maintainer review before opening on
> github.com/ethanchen669/sagtask.
> Author: TeaShaman-cyber (Semyon Poklad) — local Windows user s.poklad.

## Summary

SagTask 2.2.1 installs cleanly via `pip install sagtask` and Hermes lists it as
`enabled` with source `entrypoint`, but **no `sag_task_*` tools ever register**.
Hermes logs:

```
WARNING hermes_cli.plugins: Plugin 'sagtask' has no register() function
```

## Root cause

`pyproject.toml` declares the Hermes plugin entry point as:

```toml
[project.entry-points."hermes_agent.plugins"]
sagtask = "sagtask:register"
```

Hermes' loader (`hermes_cli/plugins.py`, `_load_plugin`) expects the entry point
to resolve to a **module** and then does:

```python
register_fn = getattr(module, "register", None)
```

Because the entry point targets the `register` **function** (`sagtask:register`),
`ep.load()` returns the function object itself, not the `sagtask` module. The
function has no `register` attribute, so `getattr(...) is None` and Hermes
reports "no register() function" and silently skips the plugin.

Bundled Hermes plugins (e.g. calculator) declare the entry point as the module
(`calculator = calculator`), which is what the loader expects.

## Reproduction

1. `pip install sagtask` (2.2.1) into the Hermes venv
   (`~/.hermes/hermes-agent/venv`).
2. `hermes plugins enable sagtask`.
3. Restart Hermes (desktop app, v0.20.0, Windows).
4. Observe `hermes plugins list` shows `sagtask | enabled | entrypoint`,
   but no `sag_task_*` tools appear in the agent's toolset, and
   `~/.hermes/logs/agent.log` contains the WARNING above.

## Local workaround (verified)

Edit the installed `sagtask-2.2.1.dist-info/entry_points.txt`:

```
[hermes_agent.plugins]
sagtask = sagtask          # was: sagtask = sagtask:register
```

After this, `ep.load()` returns the module, `getattr(module, 'register')`
succeeds, and the `sag_task_*` tools register correctly on restart.

## Suggested fix

Change `pyproject.toml` to point the entry point at the module (which already
exposes `register`):

```toml
[project.entry-points."hermes_agent.plugins"]
sagtask = "sagtask"
```

This matches the contract Hermes' loader expects and requires no code change in
`src/sagtask/__init__.py` (which already defines `register(ctx)`).

## Environment

- Hermes Agent v0.20.0 (2026.8.3), Windows 11 (native).
- Python 3.11 venv at `~/.hermes/hermes-agent/venv`.
- sagtask 2.2.1 (pip, PyPI).
- Plugin discoverable, enabled, but tools never load.
