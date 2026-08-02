# Skill Router Contract And Skill Graph Audit

Status: active; first router contract edit applied and verified.

## Outcome

Make `theseus-skill-router` an observable dispatcher rather than a collection
of good intentions. The router must select the smallest sufficient route,
preserve surface and authority boundaries, and hand off to an executable
skill, task, script, MCP tool, or explicit no-skill path. A route is accepted
only when a representative test proves the selected path and its stop or
verification condition.

The main router remains the contract owner. Individual skills own their local
procedure. Tasks, scripts, MCP tools, and IDE actions own execution. Memory
stores durable rationale, not live runtime truth.

The current rollback baseline is the private repository commit `ddc7ddf` on
`main`. It contains the current Gramps MCP workflow, audit artifacts, and
tracked global skill backups. Any future skill change should remain a small
reviewable commit after this baseline.

## Non-goals

- Do not overwrite the main router from the historical Grok snapshot.
- Do not copy Grok-specific surface names or CLI connector procedures into
  Codex.
- Do not turn the router into a catalogue of every skill or tool.
- Do not introduce a mandatory router call for trivial conversation.
- Do not add a new memory system or persist prompts, secrets, or raw logs.
- Do not claim that a route works because a skill file parses.

## Contract under review

These are candidate invariants, not yet approved text for the router:

```text
skill applicability != skill executability
route selection != route execution
route execution != verification
connector availability != authority
memory claim != current runtime fact
```

The router should also define:

```text
request -> surface/context -> intent -> smallest sufficient skill
-> capability gate -> executable route -> handoff -> verification/stop
```

Candidate governance order:

```text
current user instruction
-> current project/runtime instructions
-> account defaults
-> selected skill defaults
```

Candidate re-entry rule: route once per task or decision epoch; re-enter only
after a material change in runtime, project, capability, user instruction, or
task phase.

## Review gates before a router edit

1. **Local baseline** — preserve the restored router and record its current
   routes, gates, and completion reflex.
2. **Wolfram formal lens** — check only whether the proposed relations can be
   represented without a direct logical contradiction. Do not use Wolfram to
   decide runtime authority or user intent.
3. **Conclave/local corroboration** — compare the candidate against the actual
   Codex router, current global skills, project instructions, and the dated
   Grok snapshot. Local evidence outranks the snapshot.
4. **User decision** — produce a bounded diff and proceed only after explicit
   approval. The current user instruction to continue is approval for the
   first narrow edit; it does not approve a bulk rewrite.

The review result must be one of:

```text
ACCEPT       candidate is coherent and sufficiently bounded
ACCEPT-EDIT  coherent after named wording/scope edits
REWORK       direct conflict, missing owner, or excessive router scope
HOLD         evidence or executable test is insufficient
```

## Audit phases

### Phase 0 — Telemetry validity audit

Before using monitoring to judge the router, establish what the monitor can
and cannot observe. The existing `tools/skill_observatory` is useful evidence,
but its current model is asymmetric:

```text
text heuristic -> expected skill identifiers
route packet    -> selected route packet
policy event    -> tool-policy verdict
```

It does not yet prove that an expected skill was actually applicable, that the
router selected it, that the skill executed, or that the executor verified its
postcondition. In particular, an expectation count must not be reported as
skill usage.

Audit the monitor on these dimensions:

| Signal | Current meaning | Required caution |
|---|---|---|
| `expected_skills` | heuristic expectation from user text | candidate, not selection |
| `selected_skill` | route-packet field | selection receipt, not execution proof |
| `next_action.surface` | intended executor surface | not proof the surface was reached |
| `policy.verdict` | policy decision for the candidate action | not success/failure |
| `verification.status` | declared verification state | must be reconciled with evidence |
| `underused_skills` | expectation without matching packet | monitor mismatch until correlation is fixed |

The first observatory baseline currently shows passing unit tests and a live
`WARN`, but the WARN is dominated by expectation/packet mismatch rather than
repeated policy incidents. Treat it as an instrumentation finding, not a
router failure.

Required improvements before using the monitor as a gate:

- use stable task/epoch identifiers to correlate expectation, selection,
  handoff, execution, and verification;
- store route identifiers as structured arrays rather than delimiter-variant
  strings;
- distinguish `expected`, `selected`, `executed`, `verified`, `skipped`, and
  `blocked` states;
- record an explicit reason for a deliberate no-skill path;
- measure false-positive expectations separately from underused skills;
- keep the current privacy boundary: identifiers and observable metadata only;
- preserve a small sample of representative receipts for manual review.

Do not change the router or weaken the monitor's privacy boundary to make the
counts look healthier.

#### Calibration budget and stop rule

This is a bounded calibration pass, not a monitoring-repair project. Spend at
most one small implementation slice on identifying whether existing records
can be correlated. Do not add a new event bus, database, dashboard, hook
family, or background watcher for this audit.

Stop Phase 0 when either condition is met:

- the existing fields are sufficient to label the monitor as diagnostic-only;
- correlation requires a new subsystem or broad changes to hooks/tasks.

In the second case, record the missing correlation as a deferred issue and
continue with the skill inventory. Router and skill evaluation must not wait
for a perfect observability layer.

### Phase 1 — Inventory and ownership

Build a machine-readable inventory of tracked skill backups and active global
runtime skills without reading secret files. This stage has one active
monolithic project; a tracked copy is a backup/review artifact, not a second
project runtime. For each skill record:

| Field | Meaning |
|---|---|
| `id` | canonical skill name |
| `scope` | runtime-global, repository-backup, plugin, or historical |
| `trigger` | when it may apply |
| `owns` | decision, procedure, execution, or verification |
| `inputs` | context required for selection |
| `handoff_to` | next skill/tool/task/MCP route |
| `stop_condition` | when the skill must stop |
| `verification` | observable success evidence |
| `authority` | source of truth for its claims |
| `status` | active, adapted, historical, or unknown |

Existing `tools/skill_observatory` may collect identifiers and observable route
events. It must not be expanded into prompt capture or hidden-reasoning
collection.

### Phase 2 — Contract and graph

Represent the relationships as a directed graph:

```text
request -> router -> skill -> executor -> evidence
                  \-> no-skill -> response/stop
```

Edges must be typed:

- `selects`: router chooses a skill;
- `hands_off`: skill names the next executor;
- `requires`: prerequisite context or capability;
- `verifies`: observable test or postcondition;
- `stores`: durable rationale destination;
- `supersedes`: historical guidance is not active authority.

Every active skill needs one owner and one explicit next route. A skill may
have multiple consumers, but it must not silently perform another skill's
decision or verification role.

### Phase 3 — Representative route tests

Create small tests for the router's actual behavior, not prose inspection:

| Case | Expected result |
|---|---|
| trivial conversation | no-skill fast path |
| memory/continuity request | memory route only, then live verification if needed |
| shell/WSL/Docker task | shell-routing plus the narrow executor route |
| Git operation | git-hygiene plus explicit Git executor |
| fresh external research | conclave/research route with bounded oracle count |
| skill creation/edit | writing-skills route and validation gate |
| current runtime conflict | surface split and no authority inference |
| repeated same failure | execution-guard, no blind retry |
| task phase transition | explicit re-entry and new route packet |

Each test records only observable metadata: input class, selected route,
rejected candidates, executor surface, verdict, and evidence reference.

### Phase 4 — Handoff and failure tests

Verify connections between skills, not just each skill in isolation:

- router → memory stack;
- router → shell routing → task/script/MCP executor;
- router → Git hygiene → staging scanner;
- router → plugin conclave → one oracle plus one corroborator;
- router → execution guard after a repeated failure;
- selected skill → verification-before-completion where required;
- historical/imported guidance → imported-memory-gate before promotion.

Failure tests must prove that a missing capability, wrong surface, stale memory
claim, or failed executor results in a stop/fallback/ask outcome rather than a
new speculative route.

### Phase 5 — Minimal implementation

The first review result is `ACCEPT-EDIT`. The first narrow implementation is
complete:

1. the execution lifecycle was added to the main router;
2. the global runtime, project copy, and Git backup were synchronized;
3. route tests, skill validation, route-packet generation, and diff checks
   passed;
4. the review is recorded in `docs/audits/skill-router-review.md`.

The next implementation slice must keep the same size: prove one executor
handoff and one failure-stop path before changing another skill.

No bulk rewriting of all skills is part of this phase.

## Acceptance criteria

The router project is complete only when:

- the inventory covers all active global and project skills;
- every active skill has an owner, executor/handoff, and stop condition;
- the graph has no orphaned active skill and no unexplained cycle;
- representative cases select the intended smallest route;
- at least one test proves the no-skill fast path;
- at least one test proves a phase-transition re-route;
- at least one test proves surface separation;
- at least one test proves repeated-failure stopping;
- route selection, execution, and verification are separately observable;
- historical Grok material is labelled as adapted or superseded;
- no secrets, prompts, raw transcripts, or hidden reasoning enter reports;
- the approved router diff is small enough to review in one pass.

## Stop conditions

Stop and return for a decision when:

- a skill has two competing owners;
- an edge depends only on memory and has no current evidence;
- a proposed router rule requires copying a procedure into the router;
- a test cannot identify an observable success condition;
- the graph grows faster than the tested execution surface;
- the only evidence is a plugin suggestion or historical snapshot.

## First deliverables

1. `docs/audits/skill_inventory.json` — identifiers and ownership metadata,
   with no prompt or secret content.
2. `docs/audits/skill_graph.mmd` — typed relationship graph.
3. `docs/audits/skill-router-review.md` — Wolfram/local review decision and
   bounded proposed diff.
4. Focused route tests under `tools/skill_router/` or the nearest existing
   harness, after the contract shape is approved.

The first deliverables were the inventory, typed graph, route fixtures, and
bounded router review. The router edit remains intentionally small; no bulk
rewrite of the skill set is implied.

The telemetry audit is a prerequisite for interpreting the later route-eval
results. If correlation cannot be made reliable with small reversible changes,
the monitor remains diagnostic context and is not promoted to an enforcement
gate.
