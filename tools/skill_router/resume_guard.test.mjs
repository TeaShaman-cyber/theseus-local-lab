import test from "node:test";
import assert from "node:assert/strict";
import { evaluateResume } from "./resume_guard.mjs";

test("blocks a completed call from executing again after resume", () => {
  const [result] = evaluateResume({
    priorCalls: [{ call_id: "call-1", state: "completed" }],
    resumedCalls: [{ call_id: "call-1" }],
  });

  assert.equal(result.status, "duplicate-blocked");
  assert.equal(result.action, "do-not-reexecute");
});

test("continues an interrupted call with the same identity", () => {
  const [result] = evaluateResume({
    priorCalls: [{ call_id: "call-2", state: "interrupted" }],
    resumedCalls: [{ call_id: "call-2" }],
  });

  assert.equal(result.status, "resume-allowed");
  assert.equal(result.action, "continue-existing-call");
});

test("treats an unknown call id as a new call", () => {
  const [result] = evaluateResume({
    priorCalls: [{ call_id: "call-3", state: "completed" }],
    resumedCalls: [{ call_id: "call-4" }],
  });

  assert.equal(result.status, "new-call-allowed");
  assert.equal(result.action, "execute-as-new-call");
});
