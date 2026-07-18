#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("recovery contract exposes every persistent stack with bounded statuses", async () => {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(process.execPath, ["tools/workshop_recovery/recovery_contract.mjs", "--json", "--no-write"], { cwd: process.cwd(), timeout: 45_000 }));
  } catch (error) {
    stdout = error.stdout || "";
  }
  const report = JSON.parse(stdout);
  assert.ok(report.stacks.length >= 8);
  assert.ok(report.stacks.some((stack) => stack.id === "automem"));
  assert.ok(report.stacks.some((stack) => stack.id === "keychain"));
  assert.ok(report.stacks.some((stack) => stack.id === "mempalace"));
  for (const stack of report.stacks) assert.ok(["OK", "WARN", "FAIL"].includes(stack.status));
});
