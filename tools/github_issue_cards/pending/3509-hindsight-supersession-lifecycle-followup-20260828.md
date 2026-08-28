---
card_id: ISSUE-20260828-HINDSIGHT-3509-SUPERSESSION
status: READ_BACK_VERIFIED
operation: comment
project: hindsight
repository: vectorize-io/hindsight
repository_source: user_contract
target_confirmation: user_confirmed
issue_number: 3509
issue_url: https://github.com/vectorize-io/hindsight/issues/3509
purpose: "Reply to maintainer feedback by replacing the original TTL/purge idea with a narrower evidence-driven supersession lifecycle for facts that were true when retained but are no longer current."
duplicate_check: "existing issue; follow-up comment only; live issue re-read 2026-08-28 and maintainer comment 5326317997 remains latest"
evidence:
  - "Maintainer feedback: age alone should not make a fact invalid, and physical purge risks destroying provenance/history."
  - "#3475: facts such as autocommit=false and the former agentmemory dependency were true when recorded, later retired, yet could still be restated as current."
  - "2026-08-28 operator-reported Hermes/Hindsight incident: an older Git approval policy remained retrievable alongside a later correction and contributed to reuse of the retired rule; the current AGENTS.md/Git-hygiene policy remained authoritative."
  - "Current Hindsight invalidation already covers facts judged wrong; the remaining proposal is intentionally about historically-true facts that later cease to be current."
  - "Algorithm references are non-normative: SciPy sparse graph/hierarchical clustering and survival-analysis primitives are candidate implementation aids; Poincare/hyperbolic geometry is explicitly research-only for hierarchical aboutness."
human_review:
  requested_at: 2026-08-28
  approved_at: 2026-08-28
  approval_scope: "Publish exactly the current Draft comment below, including both Mermaid diagrams, the non-normative algorithmic references, and the provenance signature, as one comment on vectorize-io/hindsight issue #3509; then perform read-back."
  approver: user
readback:
  required: true
  expected: "Issue #3509 remains OPEN and contains exactly one new TeaShaman-cyber comment whose normalized body matches the approved Draft comment below."
  observed: "Issue #3509 remains OPEN. Published exactly one comment at https://github.com/vectorize-io/hindsight/issues/3509#issuecomment-5457972982; author TeaShaman-cyber; normalized body exactly matches the approved 6223-character draft, including both Mermaid diagrams, algorithmic references, and provenance signature."
  verified_at: 2026-08-28T21:31:25Z
---

## Draft comment

Thanks — I agree with both objections. I was using **TTL** too loosely in the earlier proposal.

I do **not** think age should determine correctness. A fact does not become false because `N` hours passed, and I agree that deleting invalidated facts from the history can make later reconstruction worse.

The narrower gap I am trying to describe is this:

```text
invalidated  = the retained fact was wrong
superseded   = the retained fact was true, but later evidence replaced it as the current state
active       = still current
```

```mermaid
flowchart LR
    A["Memory A<br/>true at T1"] -->|later evidence| B["Memory B<br/>true at T2"]
    B --> C{relation}
    C -->|supersedes| S["A: SUPERSEDED<br/>B: ACTIVE"]
    C -->|contradicts / was wrong| I["A: INVALIDATED"]
    C -->|corroborates| K["A + B remain ACTIVE"]
    S --> CR["current recall:<br/>prefer B"]
    S --> HR["historical recall:<br/>A + B + supersession edge"]
```

#3475 is the clean example. `autocommit=false` really was the project setting on one day; a later change removed/reversed that policy. Likewise, `agentmemory` really was a dependency before the project migrated away from it. The older memories are useful historical evidence, but they should not compete with the later state as equally-current guidance.

We hit the same shape again in a live Hermes/Hindsight workflow today. An older retained policy said that **local commit and push both require a separate user request**. The current project policy later changed to **local commit is an allowed checkpoint inside an approved bounded workflow; push is a separate downstream-effect gate**. Hindsight still had both historical memories. A correction ranked above the older one after we added it, but the retired rule remained retrievable and contributed to the agent selecting it again. The authoritative `AGENTS.md` / Git-hygiene policy corrected the action, but retrieval ranking was doing work that seems better represented explicitly as lifecycle.

So I would withdraw automatic `expires_at` and correctness-driven purge from the core request. A smaller possible model would be an explicit directed relation/state, for example:

```text
memory A --superseded_by--> memory B

A: historically valid, no longer current
B: current
```

Candidate matching could stay bounded: when a new fact is retained, use the existing semantic-neighbour/relationship machinery to find likely facts about the same subject, then classify the relation as something like `corroborates | contradicts | supersedes | unrelated`. Only an explicit `supersedes` result would retire the older fact. I am not proposing that vector distance or age alone make that decision.

```mermaid
flowchart LR
    N["New retained fact B"] --> R["semantic neighbours"]
    R --> Q["same-subject candidates"]
    Q --> L{relation}
    L -->|corroborates| C["keep active"]
    L -->|supersedes| S["retire A<br/>link A → B"]
    L -->|invalidates| I["invalidate A"]
    L -->|unrelated| U["no lifecycle change"]
```

The retrieval contract could then be testable:

```text
Given A was true at T1
and B is later evidence that supersedes A on the same subject,

current recall:
  returns B as current
  does not present A as competing current guidance

historical/audit recall:
  may return both A and B
  exposes that A was superseded by B
```

This preserves exactly the provenance/history concern you raised: nothing has to disappear. `invalidated` remains the right state for facts that were wrong when retained; `superseded` would cover facts that were correct and later ceased to describe the current state.

If time metadata is useful at all, I would now treat it only as a **review hint**, not validity. For example `review_after` could raise revalidation priority for classes of facts that historically change often. Even a learned survival/hazard estimate from prior supersession intervals would only answer *"what deserves another look?"*, never *"is this now false?"*.

### Possible implementation references (non-normative)

These are not dependencies of the proposal, just concrete algorithmic directions for experiments:

- **Directed/sparse lifecycle graph:** SciPy's `scipy.sparse.csgraph` provides sparse directed-graph primitives that are a reasonable prototype substrate for explicit `superseded_by` relations and graph traversal: https://docs.scipy.org/doc/scipy/reference/sparse.csgraph.html
- **Candidate grouping / subject neighbourhoods:** `scipy.cluster.hierarchy` provides hierarchical/agglomerative clustering (`linkage`, `fcluster`, etc.) that could be explored as a bounded candidate-grouping aid before relation classification: https://docs.scipy.org/doc/scipy/reference/cluster.hierarchy.html
- **Review priority, not validity:** SciPy supports censored observations and empirical survival functions; `scipy.stats.ecdf` uses Kaplan–Meier for right-censored data. That could estimate *when a class of facts deserves re-checking*, without making age a truth predicate: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ecdf.html and https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.CensoredData.html
- **Research-only hierarchical aboutness:** if Hindsight ever explores hierarchical semantic geometry, Geomstats exposes a Poincaré-ball model of hyperbolic space. I would treat this as a separate research direction for `aboutness` / hierarchy, not as part of this lifecycle feature: https://geomstats.github.io/api/geomstats.geometry.html

So the core proposal remains deliberately smaller:

```text
core correctness:     evidence-driven supersession
candidate generation: semantic neighbours / subject grouping
review scheduling:    optional age/hazard signal
hierarchical geometry: research only
```

And agreed on subject attribution — I would leave that with #3476 rather than broaden this issue again.

Does this narrower `active / superseded / invalidated` lifecycle match the distinction you were asking for, or is there already a Hindsight primitive that should represent the historically-true-but-retired case?

---
Prepared collaboratively by Semyon Poklad and Shut (ChatGPT / GPT-5.6 Sol). Submitted only after Semyon's manual review and explicit approval.
