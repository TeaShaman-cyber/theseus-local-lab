# IMF for LLM/agent systems: Interoceptive Machine Framework

Date: 2026-07-13

## Short conclusion

In this thread, IMF should be read as **Interoceptive Machine Framework**, not International Monetary Fund and not the separate LLM acronym "implicit model fusion". The relevant primary source is Diego Candia-Rivera, "Interoceptive machine framework: Toward interoception-inspired regulatory architectures in artificial intelligence", arXiv:2604.24527, submitted 2026-04-27, later listed by the author as a Physics of Life Reviews article with DOI `10.1016/j.plrev.2026.06.003`.

The framework is useful for Theseus local-lab as a design lens for stateful agents: memory, observability, resource limits, uncertainty, and interaction loops should not be passive telemetry. To count as interoceptive, they must participate in regulation.

## What the paper actually says

The paper defines interoception for artificial agents functionally, not biologically. Internal signals are interoceptive only when they:

1. encode the system condition relative to viability constraints;
2. influence policy selection and action evaluation;
3. participate in regulatory loops across multiple timescales.

The framework has three principles:

| IMF principle | Computational role | Theseus-local interpretation |
|---|---|---|
| Homeostatic | Keep internal viability variables in bounded ranges | context budget, memory health, Docker/service health, backup freshness, model/provider availability |
| Allostatic | Anticipate future instability and re-evaluate policy under uncertainty | warning before context overflow, degraded-mode switching, uncertainty-aware advisor/conclave use, rate-limit and cost prediction |
| Enactive | Generate new useful data through interaction | observatory probes, background monitors, research queue, agent tasks that create evidence instead of only answering prompts |

The paper explicitly warns against overstatement: interoceptive AI is not the same as consciousness or subjective experience. It is an empirically testable regulatory architecture.

## Minimum operational criteria

The paper gives four measurable requirements:

1. internal state estimation;
2. viability regulation;
3. uncertainty-sensitive modulation;
4. internally modulated goal adjustment.

For our project, this means a metric is not enough. For example, "AutoMem is healthy" is passive telemetry. It becomes IMF-like only if the agent/hook changes behavior because of it: recall first, compact before overflow, pause when memory is down, route to local notes as degraded fallback, or spawn a repair task.

## Relation to current Theseus architecture

Already close to IMF:

- AutoMem + MemPalace: semantic and episodic state layer.
- Memory hook / compact hook: early homeostatic control for context pressure.
- Observatory: enactive data generation for external and infrastructure conditions.
- Infisical/keychain: viability layer for secret hygiene and provider access.
- Docker control plane and backup lattice: operational state and recovery loops.
- Conclave/CodeWhale/advisors: allostatic re-evaluation when uncertainty is high.

Still missing:

- a small shared "viability vector" that the agent reads before non-trivial work;
- explicit thresholds and mode switches, not just logs;
- a feedback path from observatory/resource metrics into agent behavior;
- routine evaluation: did the regulatory signal actually change behavior and reduce failures?

## About DeepSeek and L2 claims

The Drive notes connect IMF with L2 semantic markers such as `[SNAPSHOT]`, coherence/noise variables, and protocol markers. This is a useful design metaphor, but should be stored as a **semantic surrogate**, not as evidence that DeepSeek has a formal IMF architecture.

Safer wording:

"L2 markers can emulate part of an interoceptive control layer at the prompt/protocol level: they expose state, encourage stabilization, and guide mode switches. They do not by themselves prove architectural interoception unless they are coupled to measurable internal variables and behavior-changing regulatory loops."

## Practical next step

Implement an IMF-lite status card for Theseus:

- `context_pressure`
- `memory_health`
- `backup_freshness`
- `docker_health`
- `provider_budget`
- `observatory_signal`
- `uncertainty_level`

Each field should have: source, timestamp, threshold, recommended behavior. This can feed the memory hook, session journal, and later a visual dashboard.

## Sources checked

- arXiv: https://arxiv.org/abs/2604.24527
- PDF: https://arxiv.org/pdf/2604.24527
- Author publications page: https://www.candia-rivera.com/publications
- Google Drive notes found: "Interoceptive Machine Framework" and "Семантическое Тело: L2-Интероцепция"

## Search notes

Sider Scholar confirmed arXiv metadata for `2604.24527`. PubMed lookup hit a temporary rate limit. Google Drive search found two existing user notes. Earlier broad searches for "IMF LLM" also surfaced unrelated acronyms, especially "implicit model fusion"; keep the acronym disambiguated in future work.
