#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tasksPath = path.join(repoRoot, ".vscode", "tasks.json");
const tasks = JSON.parse(readFileSync(tasksPath, "utf8")).tasks || [];

const buckets = {
  rawDockerTcp: [],
  wslShell: [],
  legacyMonolithPath: [],
  portableOrUnclassified: [],
};

for (const task of tasks) {
  const label = task.label || "<unnamed>";
  const body = JSON.stringify(task);

  if (body.includes("127.0.0.1:2375")) {
    buckets.rawDockerTcp.push(label);
  } else if (/wsl(?:\.exe)?/i.test(body)) {
    buckets.wslShell.push(label);
  } else if (
    body.includes("Documents\\\\Codex\\\\2026-07-08") ||
    body.includes("/mnt/c/Users/s.poklad/Documents/Codex/2026-07-08")
  ) {
    buckets.legacyMonolithPath.push(label);
  } else {
    buckets.portableOrUnclassified.push(label);
  }
}

console.log(
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      task_count: tasks.length,
      buckets,
    },
    null,
    2,
  ),
);
