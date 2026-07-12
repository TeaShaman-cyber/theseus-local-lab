#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const enqueueScript = resolve(root, "tools", "research_queue", "enqueue.mjs");
let hookInput = "";

try {
  hookInput = readFileSync(0, "utf8");
} catch {
  hookInput = "";
}

const result = spawnSync(
  process.execPath,
  [
    enqueueScript,
    "--stdin",
    "--source",
    "codex-hook",
    "--topic",
    process.env.THESEUS_HOOK_TOPIC || "Review hook event for possible connector-backed research",
    "--why",
    process.env.THESEUS_HOOK_WHY || "Hook captured an event that may need Exa, Tavily, Parallel Search, Acumen, or browser follow-up.",
    "--connectors",
    process.env.THESEUS_HOOK_CONNECTORS || "exa,parallel,tavily,acumen,browser",
    "--privacy",
    process.env.THESEUS_HOOK_PRIVACY || "public-research",
    "--tags",
    process.env.THESEUS_HOOK_TAGS || "hook,research-pipeline",
  ],
  {
    cwd: root,
    encoding: "utf8",
    input: hookInput,
    stdio: ["pipe", "pipe", "pipe"],
  },
);

if (result.stderr) {
  process.stderr.write(result.stderr);
}
if (result.stdout) {
  process.stderr.write(result.stdout);
}

process.stdout.write(
  `${JSON.stringify({
    continue: true,
    suppressOutput: true,
    systemMessage: result.status === 0 ? "Research follow-up queued." : "Research queue hook failed softly.",
  })}\n`,
);

process.exit(0);
