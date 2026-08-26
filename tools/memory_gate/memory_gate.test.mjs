import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

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

test("extracts durable text from Codex transcript path", async () => {
  const dir = await mkdtemp(`${tmpdir()}\\memory-gate-`);
  const file = `${dir}\\rollout.jsonl`;
  await writeFile(file, `${JSON.stringify({ payload: { role: "user", content: "Decision: retain only verified fixes in AutoMem." }})}\n`);
  try {
    assert.equal(gate({ session_id: "s2", transcript_path: file }).accept, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
