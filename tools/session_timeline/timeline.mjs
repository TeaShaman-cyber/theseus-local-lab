#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

function localIso(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  const local = new Date(date.getTime() + offsetMinutes * 60_000)
    .toISOString()
    .replace("Z", "");
  return `${local}${sign}${hours}:${minutes}`;
}

function todayPath(now) {
  const outputDir = join(process.cwd(), "outputs", "session_timeline");
  mkdirSync(outputDir, { recursive: true });
  return join(outputDir, `${now.toISOString().slice(0, 10)}.jsonl`);
}

function numericArg(args, name) {
  if (args[name] === undefined || args[name] === "") return undefined;
  const value = Number(args[name]);
  if (!Number.isFinite(value)) {
    throw new Error(`--${name.replaceAll("_", "-")} must be numeric`);
  }
  return value;
}

async function mirrorToSink(event, url) {
  if (!url) return null;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`timeline sink failed: ${response.status} ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

async function add(args) {
  const now = new Date();
  const event = {
    created_at: now.toISOString(),
    local_time: localIso(now),
    source: args.source || "manual",
    event: args.event || "note",
    note: args.note || "",
    context_percent: numericArg(args, "context_percent"),
    limit_percent_remaining: numericArg(args, "limit_percent_remaining"),
    artifacts: asArray(args.artifact),
    tags: asArray(args.tag),
    metrics: parseMetric(args.metric),
  };

  for (const key of ["context_percent", "limit_percent_remaining"]) {
    if (event[key] === undefined) delete event[key];
  }
  if (!event.artifacts.length) delete event.artifacts;
  if (!event.tags.length) delete event.tags;
  if (!Object.keys(event.metrics).length) delete event.metrics;

  const outputPath = todayPath(now);
  writeFileSync(outputPath, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" });
  const sinkUrl = args.sink_url || process.env.THESEUS_TIMELINE_URL || "";
  let sink = null;
  if (sinkUrl) {
    sink = await mirrorToSink(event, sinkUrl);
  }
  console.log(JSON.stringify({ wrote: outputPath, sink, event }, null, 2));
}

function list(args) {
  const now = new Date();
  const path = args.file || todayPath(now);
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
