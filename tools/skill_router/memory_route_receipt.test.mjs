import test from "node:test";
import assert from "node:assert/strict";
import { buildMemoryReceipt } from "./memory_route_receipt.mjs";

test("builds a verified read-only memory receipt", () => {
  const receipt = buildMemoryReceipt({
    memoryId: "checkpoint-123",
    result: "AutoMem returned the external review checkpoint",
  });
  assert.equal(receipt.route, "memory-continuity");
  assert.deepEqual(receipt.selected_skills, ["theseus-memory-stack"]);
  assert.equal(receipt.executor, "AutoMem recall");
  assert.equal(receipt.memory_id, "checkpoint-123");
  assert.equal(receipt.verification, "AutoMem returned the external review checkpoint");
  assert.match(receipt.stop, /do not promote/);
});

test("requires an observed memory id", () => {
  assert.throws(() => buildMemoryReceipt(), /memoryId is required/);
});
