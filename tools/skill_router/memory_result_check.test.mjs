import test from "node:test";
import assert from "node:assert/strict";
import { verifyMemoryRecall } from "./memory_result_check.mjs";

test("verifies the expected memory and keeps it non-authoritative", () => {
  const result = verifyMemoryRecall({
    expectedId: "checkpoint-1",
    recalled: {
      memory_id: "checkpoint-1",
      type: "Decision",
      content: "External review checkpoint",
    },
  });

  assert.equal(result.status, "verified");
  assert.equal(result.memory_type, "Decision");
  assert.equal(result.runtime_authority, "not-promoted");
});

test("rejects a memory returned under the wrong id", () => {
  const result = verifyMemoryRecall({
    expectedId: "checkpoint-1",
    recalled: {
      memory_id: "checkpoint-2",
      type: "Decision",
      content: "Different checkpoint",
    },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason, "memory-id-mismatch");
});

test("rejects an incomplete memory result", () => {
  const result = verifyMemoryRecall({
    expectedId: "checkpoint-1",
    recalled: { memory_id: "checkpoint-1", type: "Decision" },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason, "memory-result-incomplete");
});
