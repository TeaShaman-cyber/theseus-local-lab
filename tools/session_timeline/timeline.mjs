#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { writeTimelineEvent, timelinePath } from "./event_writer.mjs";

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }

    const key = value.slice(2).replaceAll("-", "_");
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    if (args[key] === undefined) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      args[key].push(next);
    } else {
      args[key] = [args[key], next];
    }
    index += 1;
  }
  return args;
}

function asArray(value) {
  if (value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function parseMetric(value) {
  const pairs = asArray(value);
  const metrics = {};
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    const key = pair.slice(0, separator).trim();
    const raw = pair.slice(separator + 1).trim();
    if (!key) continue;
    const numeric = Number(raw);
    metrics[key] = Number.isFinite(numeric) && raw !== "" ? numeric : raw;
  }
  return metrics;
}

function numericArg(args, name) {
  if (args[name] === undefined || args[name] === "") return undefined;
  const value = Number(args[name]);
  if (!Number.isFinite(value)) {
    throw new Error(`--${name.replaceAll("_", "-")} must be numeric`);
  }
  return value;
}

async function add(args) {
  const options = {};
  if (args.sink_url !== undefined) options.sinkUrl = args.sink_url;
  const result = await writeTimelineEvent({
    source: args.source || "manual",
    event: args.event || "note",
    note: args.note || "",
    context_percent: numericArg(args, "context_percent"),
    limit_percent_remaining: numericArg(args, "limit_percent_remaining"),
    artifact: args.artifact,
    tag: args.tag,
    metrics: parseMetric(args.metric),
  }, options);
  console.log(JSON.stringify({ wrote: result.path, sink: result.sink, event: result.event }, null, 2));
}

function list(args) {
  const now = new Date();
  const path = args.file || timelinePath(process.cwd(), now);
  const limit = numericArg(args, "limit") || 20;
  if (!existsSync(path)) {
    console.log(JSON.stringify({ path, events: [] }, null, 2));
    return;
  }

  const events = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .slice(-limit);
  console.log(JSON.stringify({ path, events }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "add";
  if (command === "add") {
    await add(args);
    return;
  }
  if (command === "list") {
    list(args);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
