import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

function gate(payload) {
  return JSON.parse(execFileSync(process.execPath, ["tools/memory_gate/memory_gate.mjs"], { input: JSON.stringify(payload), encoding: "utf8" }));
}

test("rejects ordinary noise", () => {
  assert.equal(gate({ session_id: "s1", message: "ok thanks" }).accept, false);
});

test("accepts durable engineering signal", () => {
  const result = gate({ session_id: "s1", summary: "Decision: keep AutoMem as durable semantic memory." });
  assert.equal(result.accept, true);
  assert.equal(result.semantic, true);
  assert.equal(result.episodic, true);
  assert.equal(result.event_id.length, 24);
});

test("rejects secret-bearing payloads", () => {
  assert.equal(gate({ session_id: "s1", summary: "Decision: API_KEY=super-secret-value" }).accept, false);
});
