#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONNECTOR_ALIASES = new Map([
  ["exa", "Exa"],
  ["tavily", "Tavily AI"],
  ["parallel", "Parallel Search"],
  ["parallel-search", "Parallel Search"],
  ["acumen", "Acumen by Talarion"],
  ["browser", "Browser"],
  ["chrome", "Chrome"],
  ["automem", "AutoMem"],
]);

function parseArgs(argv) {
  const args = {
    connectors: [],
    privacy: "public-research",
    source: "manual",
    tags: [],
    topic: "",
    why: "",
    readStdin: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1] || "";
    if (value === "--topic") {
      args.topic = next;
      index += 1;
    } else if (value === "--why") {
      args.why = next;
      index += 1;
    } else if (value === "--connectors") {
      args.connectors = next.split(",").map((item) => item.trim()).filter(Boolean);
      index += 1;
    } else if (value === "--privacy") {
      args.privacy = next;
      index += 1;
    } else if (value === "--source") {
      args.source = next;
      index += 1;
    } else if (value === "--tags") {
      args.tags = next.split(",").map((item) => item.trim()).filter(Boolean);
      index += 1;
    } else if (value === "--stdin") {
      args.readStdin = true;
    }
  }

  return args;
}

function normalizeConnectors(connectors) {
  if (!connectors.length) {
    return ["Exa", "Parallel Search", "Tavily AI", "Acumen by Talarion"];
  }
  return connectors.map((name) => CONNECTOR_ALIASES.get(name.toLowerCase()) || name);
}

function redact(text) {
  return text
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

function readHookPayload(enabled) {
  if (!enabled) {
    return null;
  }
  try {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) {
      return null;
    }
    const safeRaw = redact(raw).slice(0, 4000);
    try {
      return JSON.parse(safeRaw);
    } catch {
      return { raw_excerpt: safeRaw };
    }
  } catch (error) {
    return { read_error: error.message };
  }
}

const args = parseArgs(process.argv.slice(2));
const now = new Date();
const day = now.toISOString().slice(0, 10);
const outputDir = join(process.cwd(), "outputs", "research_queue");
const outputPath = join(outputDir, `${day}.jsonl`);

mkdirSync(outputDir, { recursive: true });

const item = {
  id: `${now.toISOString().replaceAll(":", "").replaceAll(".", "-")}-${Math.random()
    .toString(16)
    .slice(2, 8)}`,
  created_at: now.toISOString(),
  status: "pending",
  source: args.source,
  topic: args.topic || "Untitled research queue item",
  why: args.why || "",
  preferred_connectors: normalizeConnectors(args.connectors),
  privacy: args.privacy,
  tags: args.tags,
  hook_payload: readHookPayload(args.readStdin),
};

writeFileSync(outputPath, `${JSON.stringify(item)}\n`, { encoding: "utf8", flag: "a" });
console.log(`${item.id} -> ${outputPath}`);
