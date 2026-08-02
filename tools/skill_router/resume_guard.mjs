function normalize(value) {
  return String(value ?? "").trim();
}

export function evaluateResume({ priorCalls = [], resumedCalls = [] } = {}) {
  if (!Array.isArray(priorCalls) || !Array.isArray(resumedCalls)) {
    throw new Error("priorCalls and resumedCalls must be arrays");
  }

  const prior = new Map();
  for (const call of priorCalls) {
    const callId = normalize(call?.call_id);
    const state = normalize(call?.state);
    if (!callId || !state) throw new Error("every prior call needs call_id and state");
    prior.set(callId, state);
  }

  return resumedCalls.map((call) => {
    const callId = normalize(call?.call_id);
    if (!callId) throw new Error("every resumed call needs call_id");
    const previousState = prior.get(callId);

    if (previousState === "completed") {
      return {
        call_id: callId,
        status: "duplicate-blocked",
        action: "do-not-reexecute",
        reason: "call already completed before resume",
      };
    }

    if (["pending", "interrupted"].includes(previousState)) {
      return {
        call_id: callId,
        status: "resume-allowed",
        action: "continue-existing-call",
        previous_state: previousState,
      };
    }

    return {
      call_id: callId,
      status: "new-call-allowed",
      action: "execute-as-new-call",
      previous_state: previousState || null,
    };
  });
}
