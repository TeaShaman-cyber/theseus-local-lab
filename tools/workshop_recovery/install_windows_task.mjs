#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";

const taskName = "Theseus Workshop Recovery";
const runner = path.join(import.meta.dirname, "recovery_contract.mjs");
const action = `"${process.execPath}" "${runner}" --recover --quiet`;
const result = spawnSync(
  "schtasks.exe",
  ["/Create", "/TN", taskName, "/TR", action, "/SC", "MINUTE", "/MO", "5", "/F"],
  { encoding: "utf8", windowsHide: true },
);

if (result.status !== 0) {
  console.error((result.stderr || result.stdout || "could not create scheduled task").trim());
  process.exit(result.status || 1);
}
console.log(`${taskName} installed: checks and restores declared workshop stacks every 5 minutes.`);
