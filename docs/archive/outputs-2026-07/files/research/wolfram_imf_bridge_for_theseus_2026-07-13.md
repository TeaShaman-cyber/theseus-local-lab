# Wolfram-IMF bridge for Theseus

Date: 2026-07-13

## Short thesis

IMF gives Theseus a physiology of stateful agents: homeostasis, allostasis, and enactive interaction.
Wolfram gives Theseus a computational ontology: rules, observers, symbolic expressions, computational irreducibility, and the ruliad.

Together:

```text
Agent = Model + Harness + Memory + Tools + Observer + Rules
```

The point is not to claim subjective experience. The practical claim is narrower and stronger: an agent becomes more robust when its internal and external state are represented symbolically and coupled to behavior-changing rules.

## Wolfram concepts mapped to Theseus

| Wolfram concept | Working interpretation | Theseus mapping |
|---|---|---|
| Computational irreducibility | Some trajectories cannot be shortcut; they must be run and observed | logs, checkpoints, experiments, junior-agent mentorship, Docker/Windows failure history |
| Principle of computational equivalence | Simple rules can generate behavior as sophisticated as many complex systems | small local agents can be useful when surrounded by strong harness, memory, and feedback |
| Ruliad | Entangled space of all possible computations/rules | Codex, Yuнга, DeepSeek, Bothub, CodeWhale, VS Code, Docker, AutoMem as different computational branches |
| Observer theory | An observer coarse-grains the ruliad into stable perceived facts | memory compaction, AutoMem graph, MemPalace diary, summaries, evidence cards |
| Symbolic language | Data, rules, code, UI, and knowledge can be represented as expressions | status cards, viability vectors, mode-switch rules, graph nodes, hook events |

## Why this matters for IMF

IMF says telemetry becomes interoception only when it regulates behavior. Wolfram's symbolic view suggests a practical implementation path:

```text
State[
  Memory -> Healthy,
  ContextPressure -> Yellow,
  Docker -> Stable,
  ProviderBudget -> Low,
  Uncertainty -> High
]

Rule[
  Uncertainty -> High,
  Action -> InvokeConclave
]

Rule[
  ContextPressure -> Yellow,
  Action -> CompactAndCheckpoint
]

Rule[
  Memory -> Down,
  Action -> DegradedFallback
]
```

This turns scattered exocortical layers into a control loop:

```text
observe -> symbolize -> apply rules -> change mode -> act -> log -> update memory
```

## Yuнга and conclave as early prototypes

The Yuнга mentoring loop was a vertical controller:

```text
Senior agent -> junior agent -> report -> critique -> next task -> memory update
```

The conclave loop was a horizontal allostatic controller:

```text
Question -> multiple model branches -> compare invariants -> choose action -> store result
```

Both are Wolfram-like in the sense that they sample different computational branches and then compress the result into observer-level invariants.

## Theseus viability vector

A minimal Theseus controller can represent agent viability as a symbolic expression:

```text
TheseusState[
  ContextPressure -> Green|Yellow|Red,
  MemoryHealth -> Green|Yellow|Red,
  DockerHealth -> Green|Yellow|Red,
  BackupFreshness -> Green|Yellow|Red,
  ProviderBudget -> Green|Yellow|Red,
  NetworkHealth -> Green|Yellow|Red,
  ObservatorySignal -> Green|Yellow|Red,
  TaskUncertainty -> Green|Yellow|Red
]
```

Each field needs:

- source;
- timestamp;
- threshold;
- confidence;
- recommended action;
- verification result.

## Design rule

Do not make the symbolic layer decorative. A status marker only matters if it changes behavior.

Bad:

```text
ContextPressure -> Red
```

Good:

```text
ContextPressure -> Red
Action -> SummarizeToAutoMemAndStopLargeEdit
Evidence -> MemoryWriteConfirmed
```

## Near-term engineering path

1. Define `TheseusState` as a small JSON document or JSONL event.
2. Add a reader that produces a short status card before non-trivial work.
3. Add rule evaluation for a few behaviors only:
   - compact/checkpoint;
   - invoke conclave;
   - degraded memory fallback;
   - repair Docker/memory before engineering work;
   - defer heavy tasks when provider/network state is poor.
4. Log every rule firing.
5. Review whether the rule actually reduced failures.

## Sources

- Interoceptive Machine Framework: https://arxiv.org/abs/2604.24527
- Wolfram ruliad concept: https://writings.stephenwolfram.com/2021/11/the-concept-of-the-ruliad/
- Wolfram observer theory: https://writings.stephenwolfram.com/2023/12/observer-theory/
- Wolfram computational irreducibility/ruliad metaphysics: https://writings.stephenwolfram.com/2026/02/what-ultimately-is-there-metaphysics-and-the-ruliad/
- Wolfram Language symbolic expressions: https://www.wolfram.com/language/

## Open caution

This bridge is a computational metaphor and an engineering design lens. It should not be used as proof of consciousness, subjective feeling, or biological equivalence. The safer claim is: stateful symbolic regulation can make agent behavior more coherent, resilient, and inspectable.
