# External review of the skill-router complex

Date: 2026-08-02
Status: `REVIEWED / FOLLOW-UP APPLIED`

## Scope

The external review checked whether our current skill complex has the right
shape for a real agent workflow:

```text
select -> hand off -> execute -> verify -> stop or re-enter
```

The local tests and receipts remain the primary evidence. External sources are
used as a design cross-check, not as runtime authority.

## Sources and roles

- Exa found the OpenAI Agents execution-lifecycle references and official
  orchestration material.
- Acumen supplied a freshness signal about current agent failure patterns,
  especially action/escalation breakdowns and dialogue loops. This is a signal,
  not a primary implementation source.
- Tavily extracted a recent provenance survey focused on tool selection,
  arguments, output reliability, verification, recovery, and privacy-aware
  traces.
- Parallel Search independently surfaced MCP-specific evaluation material and
  recovery benchmarks.
- Hugging Face was queried for papers, documentation, models, and datasets, but
  the connected search tools returned server-side `not found` or `disabled`
  errors. No claim was based on the failed HF calls.

## Convergent findings

### 1. Planning, approval, invocation, and output checks are separate

The OpenAI Agents references separate discovery/planning, approval partitioning,
invocation, input/output guardrails, failure conversion, cancellation, and
resumed execution. A completed approval is not a completed tool call, and a
tool start is not a successful final state.

This directly supports our router's distinction between skill selection,
executor handoff, execution, and verification.

### 2. Handoff ownership must be explicit

The orchestration guidance distinguishes a handoff, where control moves to a
specialist, from an agent-as-tool call, where the manager retains ownership.
It recommends narrow specialists and adding a split only when the contract,
tools, policy, or ownership really changes.

This supports keeping `theseus-skill-router` as dispatcher and leaving actual
procedures in the individual skills and tasks.

### 3. Final-answer correctness is not enough

The independent evaluation material converges on separate checks for tool
discovery, tool selection, parameter correctness, invocation sequence, result
interpretation, and the final outcome. Provenance research adds recovery,
memory lineage, action boundaries, and privacy minimization as separate review
dimensions.

This confirms that our current `route-receipt` is necessary but not sufficient:
it proves the route shape, not semantic correctness of every returned result.

### 4. Representative traces should come from real failures

The external evaluation guidance recommends small representative scenarios,
including successful runs, obvious failures, ambiguous cases, and recurring
failures. It favors tracing before aggregate scoring and warns against changing
prompts blindly from a final answer alone.

This agrees with our bounded approach: add one route and one failure case at a
time, then stop before building a monitoring platform.

## What this changes locally

No new architecture is required. The next useful route receipts should add
only these fields where the evidence exists:

```text
tool_identity / route_id
call_identity
handoff_owner
execution_state
verification_kind
result_interpretation
resume_or_duplicate_guard
```

They must remain observable metadata, not hidden reasoning or raw prompts.

The read-only memory handoff is now proven: AutoMem is selected by route-packet,
the checkpoint is recalled, and the receipt records the verified result while
keeping memory separate from current runtime authority. Duplicate/resumed-call
handling is also covered by a focused local test; a completed `call_id` is
blocked on resume while an interrupted one may continue.

The first semantic result checks are now proven for both memory layers:

- AutoMem requires the expected identity, decision type, and non-empty content;
- MemPalace requires the expected wing, room, and non-empty episodic text.

Both results remain non-authoritative for current runtime. The live MemPalace
search is healthy, but its `skill-router` room currently returns an older
checkpoint than the latest AutoMem decision. That is a freshness distinction,
not a service failure. Other executors still need their own narrow semantic
checks; do not generalize this into a large result-validation layer.

## External links

- [OpenAI Agents tool execution lifecycle](https://github.com/openai/openai-agents-python/blob/main/.agents/references/tool-execution-lifecycle.md)
- [OpenAI Agents orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)
- [OpenAI guidance on tool orchestration and bounded retries](https://developers.openai.com/api/docs/guides/latest-model)
- [Evidence tracing and execution provenance survey](https://arxiv.org/html/2606.04990v4)
- [MCPToolBenchPP dataset](https://huggingface.co/datasets/su2026/MCPToolBenchPP)
- [MCPMark evaluation project](https://github.com/eval-sys/mcpmark)

## Decision

The current complex is directionally sound and the minimal router contract is
confirmed. Do not import external frameworks or copy their procedures into the
router. Continue by strengthening the local receipts and executor-backed cases,
one narrow route at a time.
