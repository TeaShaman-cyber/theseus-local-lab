#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("dashboard exposes the style pulse as a process check", async () => {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(process.execPath, ["tools/workshop_dashboard/dashboard.mjs", "--json"], {
      cwd: process.cwd(),
      timeout: 20_000,
    }));
  } catch (error) {
    stdout = error.stdout || "";
  }
  const dashboard = JSON.parse(stdout);
  const row = dashboard.rows.find((item) => item.id === "style-pulse");

  assert.ok(row, "style pulse row should be visible on the workshop dashboard");
  assert.ok(["OK", "WARN", "FAIL"].includes(row.status));
});
