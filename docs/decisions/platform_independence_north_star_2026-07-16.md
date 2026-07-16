# Platform Independence North Star

Date: 2026-07-16

## Decision

Codex remains the current lead harness because Theseus has accumulated practical
expertise, tools, memory, and trust around it. This is an operational choice,
not a permanent dependency.

The strategic goal is platform independence without losing the agent
relationship, memory, style, or engineering process.

## Design Implication

When choosing architecture, prefer moves that externalize durable state and
make the workshop transferable:

- memory and recall;
- route selection;
- secrets and credentials;
- logs and evidence;
- checks and postconditions;
- skills and task runners;
- dashboards and alerts;
- worker profiles;
- model/provider adapters;
- project maps and handoff packets.

## Anti-Pattern

Do not make Codex, one model, one IDE, one OS, one provider, or one chat window
the only place where the process lives.

## Practical Reading

Codex is currently the lead engineer/controller. NII workers, local models,
Bothub, CodeWhale, AutoMem, MemPalace, Graphify, GitHub, dashboards, and future
A2A agents are redundancy layers for antifragility, not decorative extras.
