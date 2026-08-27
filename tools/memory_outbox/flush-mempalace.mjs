#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { providerTimeoutMs, spawnWithTimeout } from "./provider-timeout.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const queue = process.env.MEMORY_OUTBOX_QUEUE_PATH || resolve(root, "outputs/memory_outbox/events.jsonl");
const statePath = process.env.MEMORY_OUTBOX_MEMPALACE_PROCESSED_PATH || resolve(root, "outputs/memory_outbox/mempalace-processed.json");
const endpoint = process.env.MEMPALACE_MCP_URL || "http://127.0.0.1:18765/mcp";
const lines = (await readFile(queue, "utf8").catch(() => "")).split(/\r?\n/).filter(Boolean);
const processed = new Set(JSON.parse(await readFile(statePath, "utf8").catch(() => "[]")));
const events = lines.map((line) => JSON.parse(line)).filter((event) => event.accept && event.episodic && !processed.has(event.event_id));
if (!events.length) {
  process.stdout.write(JSON.stringify({ stored: 0, pending: 0 }));
  process.exit(0);
}

const wing = "theseus-local-lab";
const room = "hooks";
const items = events.map((event) => ({ wing, room, content: event.content }));
const checkpointArgs = { items, diary: { agent_name: "lad", topic: "memory-autoretain", entry: `SESSION:${new Date().toISOString().slice(0,10)}|Codex.memory-gate+episodic.flush|EVENTS:${events.length}|★★★`, wing } };
const testBinary = process.env.MEMORY_OUTBOX_TEST_MC_PORTER_BIN;
const testPrefix = process.env.MEMORY_OUTBOX_TEST_MC_PORTER_PREFIX_ARGS;
const mcporterBinary = testBinary || "npx.cmd";
const mcporterPrefix = testPrefix ? JSON.parse(testPrefix) : ["--yes", "mcporter@0.13.7"];
const providerTimeout = providerTimeoutMs(process.env.MEMORY_OUTBOX_PROVIDER_TIMEOUT_MS);

function parseToolOutput(stdout) {
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.split(/\r?\n/).reverse().map((line) => line.trim()).find((line) => {
      try { JSON.parse(line); return true; } catch { return false; }
    }) ? JSON.parse(text.split(/\r?\n/).reverse().map((line) => line.trim()).find((line) => {
      try { JSON.parse(line); return true; } catch { return false; }
    })) : null;
  }
}

function unwrapToolOutput(value) {
  if (!value || typeof value !== "object") return value;
  if (value.structuredContent && typeof value.structuredContent === "object") return value.structuredContent;
  if (value.result && typeof value.result === "object") return unwrapToolOutput(value.result);
  if (Array.isArray(value.content)) {
    const text = value.content.find((item) => item && item.type === "text")?.text;
    if (text) return parseToolOutput(text) || value;
  }
  return value;
}

function callMcporter(toolName, toolArgs) {
  return spawnWithTimeout(mcporterBinary, [
    ...mcporterPrefix,
    "call",
    `${endpoint}.${toolName}`,
    "--args",
    "-",
    "--output",
    "json",
  ], { windowsHide: true, input: JSON.stringify(toolArgs) }, providerTimeout);
}

function drawerId(value) {
  return value?.drawer_id || value?.id || "";
}

function drawerPayload(value) {
  const unwrapped = unwrapToolOutput(value);
  return unwrapped?.drawer || unwrapped?.memory || unwrapped;
}

async function readBackDrawer(receipt) {
  const id = drawerId(receipt);
  if (!id) return null;
  const readBackCall = await callMcporter("mempalace_get_drawer", { drawer_id: id });
  if (readBackCall.code !== 0) return null;
  const drawer = drawerPayload(parseToolOutput(readBackCall.stdout));
  if (drawerId(drawer) !== id || drawer?.wing !== wing || drawer?.room !== room) return null;
  return drawer;
}

const checkpointCall = await callMcporter("mempalace_checkpoint", checkpointArgs);
if (checkpointCall.stderr) process.stderr.write(checkpointCall.stderr);
if (checkpointCall.code !== 0) {
  process.stdout.write(JSON.stringify({ stored: 0, pending: events.length }));
  process.exit(0);
}
const checkpoint = unwrapToolOutput(parseToolOutput(checkpointCall.stdout)) || {};
const receipts = [
  ...(Array.isArray(checkpoint.added) ? checkpoint.added : []),
  ...(Array.isArray(checkpoint.duplicates) ? checkpoint.duplicates.flatMap((item) => item.matches || []) : []),
];
const verifiedEventIds = new Set();
for (const receipt of receipts) {
  const drawer = await readBackDrawer(receipt);
  if (!drawer) continue;
  const candidateEvents = events.filter((event) => !verifiedEventIds.has(event.event_id) && event.content === drawer.content);
  for (const event of candidateEvents) {
    verifiedEventIds.add(event.event_id);
    break;
  }
}
for (const eventId of verifiedEventIds) processed.add(eventId);
await mkdir(dirname(statePath), { recursive: true });
await writeFile(statePath, `${JSON.stringify([...processed].slice(-1000), null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ stored: verifiedEventIds.size, pending: events.length - verifiedEventIds.size }));
