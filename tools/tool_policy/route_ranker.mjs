#!/usr/bin/env node
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { rankRoutes } from "./tool_policy.mjs";

function parseArgs(argv) {
  let goal = "";
  let log = false;
  const candidates = [];

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--goal") {
      goal = argv[++i] || "";
    } else if (item === "--candidate") {
      candidates.push({ command: argv[++i] || "" });
    } else if (item === "--mcp") {
      candidates.push({ surface: "mcp", command: argv[++i] || "" });
    } else if (item === "--vscode-task") {
      candidates.push({ surface: "vscode-task", command: argv[++i] || "" });
    } else if (item === "--log") {
      log = true;
    } else {
      throw new Error(`Unknown option: ${item}`);
    }
  }

  return { goal, candidates, log };
}

async function logRanking(result) {
  const day = new Date().toISOString().slice(0, 10);
  const path = join(process.cwd(), "outputs", "tool_policy", `${day}.jsonl`);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(
    path,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      type: "route-ranking",
      result,
    })}\n`,
  );
}

try {
  const { goal, candidates, log } = parseArgs(process.argv.slice(2));
  const result = rankRoutes({ goal, candidates });
  if (log) await logRanking(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
}

