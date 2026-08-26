#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const queue = resolve(root, "outputs/memory_outbox/events.jsonl");
const statePath = resolve(root, "outputs/memory_outbox/processed.json");
const apiUrl = process.env.AUTOMEM_API_URL || "http://127.0.0.1:8001";
const token = process.env.AUTOMEM_API_TOKEN || "test-token";
const lines = (await readFile(queue, "utf8").catch(() => "")).split(/\r?\n/).filter(Boolean);
const processed = new Set(JSON.parse(await readFile(statePath, "utf8").catch(() => "[]")));
let stored = 0;
let pending = 0;
for (const line of lines) {
  const event = JSON.parse(line);
  if (processed.has(event.event_id) || !event.accept || !event.semantic) continue;
  pending += 1;
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/memory`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ content: event.content, tags: ["codex-hook", "auto-retain", "memory-gate"], importance: 0.7, metadata: { event_id: event.event_id, source: "codex-hook" } }) }).catch(() => null);
  if (!response?.ok) continue;
  pending -= 1;
  processed.add(event.event_id); stored += 1;
}
await mkdir(dirname(statePath), { recursive: true });
await writeFile(statePath, `${JSON.stringify([...processed].slice(-1000), null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ stored, pending }));
