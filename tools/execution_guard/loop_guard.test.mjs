import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAttempts } from "./loop_guard.mjs";

test("detects three materially equivalent failures and stops blind retry", () => {
  const result = evaluateAttempts([
    { route: "vscode-task", failure: "task-not-found" },
    { route: "vscode-task", failure: "task-not-found" },
    { route: "vscode-task", failure: "task-not-found" },
  ]);

  assert.equal(result.status, "LOOP_DETECTED");
  assert.equal(result.action, "stop-blind-retry");
  assert.match(result.fallback, /compatible executor|ask the user/);
});

test("does not merge different failure classes into one loop", () => {
  const result = evaluateAttempts([
    { route: "vscode-task", failure: "task-not-found" },
    { route: "node-wrapper", failure: "module-not-found" },
    { route: "node-wrapper", failure: "module-not-found" },
  ]);

  assert.equal(result.status, "different-failure-class");
  assert.equal(result.action, "reassess-route");
});

test("keeps fewer than three equivalent failures below the loop threshold", () => {
  const result = evaluateAttempts([
    { route: "node-wrapper", failure: "exit-1" },
    { route: "node-wrapper", failure: "exit-1" },
  ]);

  assert.equal(result.status, "below-loop-threshold");
  assert.equal(result.action, "one-valid-retry-or-fallback");
});
