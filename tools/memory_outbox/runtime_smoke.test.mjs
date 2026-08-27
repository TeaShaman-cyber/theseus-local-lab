import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const smokePath = "tools/memory_outbox/runtime_smoke.mjs";

test("runtime smoke does not invoke provider or Stop flush routes", async () => {
  const source = await readFile(smokePath, "utf8");
  assert.match(source, /memory_gate\.mjs/);
  assert.doesNotMatch(source, /hook-router\.mjs/);
  assert.doesNotMatch(source, /memory_outbox[\\/]flush(?:-mempalace)?\.mjs/);
});

test("runtime smoke reports a gate-only, write-free result", async () => {
  const { stdout } = await execFileAsync(process.execPath, [smokePath], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10_000,
  });
  const result = JSON.parse(stdout);
  assert.equal(result.safe, true);
  assert.equal(result.provider_writes, false);
  assert.equal(result.outbox_writes, false);
  assert.equal(result.gate_accept, true);
});
