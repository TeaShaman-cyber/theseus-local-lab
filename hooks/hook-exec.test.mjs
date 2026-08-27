import assert from "node:assert/strict";
import test from "node:test";

import { runNode } from "./hook-exec.mjs";

test("runNode terminates a child that exceeds its timeout", () => {
  const result = runNode(["-e", "setTimeout(() => {}, 1000)"], "", { timeoutMs: 50 });
  assert.ok(result.error, "timeout should produce an error result");
  assert.equal(result.error.code, "ETIMEDOUT");
  assert.equal(result.status, null);
});
