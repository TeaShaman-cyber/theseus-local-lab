import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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

test("redacts private values from accepted content", () => {
  const result = gate({
    session_id: "s1",
    summary: "Decision: keep the route. Path C:\\Users\\s.poklad\\private\\notes.txt; see https://example.test/private.",
  });
  assert.equal(result.accept, true);
  assert.match(result.content, /Decision: keep the route\./);
  assert.match(result.content, /\[REDACTED_PATH\]/);
  assert.match(result.content, /\[REDACTED_URL\]/);
  assert.doesNotMatch(result.content, /C:\\Users\\s\.poklad|https:\/\/example\.test/i);
});

test("extracts durable text from Codex transcript path", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "memory-gate-"));
  const file = path.join(dir, "rollout.jsonl");
  await writeFile(file, `${JSON.stringify({ payload: { role: "user", content: "Decision: retain only verified fixes in AutoMem." }})}\n`);
  try {
    assert.equal(gate({ session_id: "s2", transcript_path: file }).accept, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("redacts private values extracted from a transcript", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "memory-gate-"));
  const file = path.join(dir, "rollout.jsonl");
  await writeFile(file, `${JSON.stringify({ payload: { role: "user", content: "Decision: keep C:\\\\Users\\\\s.poklad\\\\private\\\\notes.txt out of memory." }})}\n`);
  try {
    const result = gate({ session_id: "s3", transcript_path: file });
    assert.equal(result.accept, true);
    assert.match(result.content, /\[REDACTED_PATH\]/);
    assert.doesNotMatch(result.content, /C:\\Users\\s\.poklad/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
