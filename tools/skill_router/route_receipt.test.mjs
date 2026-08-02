import test from "node:test";
import assert from "node:assert/strict";
import { buildNoSkillReceipt } from "./route_receipt.mjs";

test("emits a completed receipt for the no-skill fast path", () => {
  assert.deepEqual(buildNoSkillReceipt(), {
    schema_version: 1,
    type: "route-receipt",
    case_id: "no-skill-trivial-chat",
    route: "no-skill",
    selected_skills: [],
    executor: "none",
    status: "completed",
    verification: "response delivered",
    stop: "after response",
    evidence: "bounded no-skill contract receipt",
  });
});

test("does not mislabel a working route as no-skill", () => {
  assert.throws(() => buildNoSkillReceipt("local-shell-task"), /not a no-skill case/);
});
