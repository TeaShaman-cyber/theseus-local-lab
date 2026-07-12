#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function parseArgs(argv) {
  const args = { limit: 10 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--limit") {
      args.limit = Number.parseInt(argv[index + 1] || "10", 10);
      index += 1;
    }
  }
  return args;
}

function readItems(root) {
  const dir = join(root, "outputs", "research_queue");
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) => {
      const path = join(dir, name);
      return readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { id: "parse-error", created_at: "", topic: line.slice(0, 120) };
          }
        });
    })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

const args = parseArgs(process.argv.slice(2));
const items = readItems(process.cwd()).slice(0, args.limit);

if (!items.length) {
  console.log("No research queue items.");
  process.exit(0);
}

for (const item of items) {
  console.log(`- ${item.created_at} [${item.status}] ${item.topic}`);
  console.log(`  id: ${item.id}`);
  console.log(`  connectors: ${(item.preferred_connectors || []).join(", ") || "(none)"}`);
  if (item.why) {
    console.log(`  why: ${item.why}`);
  }
}
