#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

test("recovery contract exposes every persistent stack with bounded statuses", async () => {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(process.execPath, ["tools/workshop_recovery/recovery_contract.mjs", "--json", "--no-write"], { cwd: process.cwd(), timeout: 45_000 }));
  } catch (error) {
    stdout = error.stdout || "";
  }
  const report = JSON.parse(stdout);
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "tools", "workshop_recovery", "recovery_contract.json"), "utf8"));
  const expectedIds = manifest.stacks.map((stack) => stack.id).sort();
  assert.deepEqual(report.stacks.map((stack) => stack.id).sort(), expectedIds);
  assert.ok(report.stacks.some((stack) => stack.id === "automem"));
  assert.ok(report.stacks.some((stack) => stack.id === "mempalace"));
  const mempalace = report.stacks.find((stack) => stack.id === "mempalace");
  if (mempalace.command_check) assert.ok(["OK", "FAIL"].includes(mempalace.command_check.status));
  for (const stack of report.stacks) assert.ok(["OK", "WARN", "FAIL"].includes(stack.status));
});
