#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchWithTimeout } from "./provider-timeout.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const queue = process.env.MEMORY_OUTBOX_QUEUE_PATH || resolve(root, "outputs/memory_outbox/events.jsonl");
const statePath = process.env.MEMORY_OUTBOX_PROCESSED_PATH || resolve(root, "outputs/memory_outbox/processed.json");
const apiUrl = process.env.AUTOMEM_API_URL || "http://127.0.0.1:8001";
const isLocal = /^(https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal)(:\d+)?\/?$/i.test(apiUrl);
const token = process.env.AUTOMEM_API_TOKEN || (isLocal ? "test-token" : "");
const apiBase = apiUrl.replace(/\/$/, "");
const lines = (await readFile(queue, "utf8").catch(() => "")).split(/\r?\n/).filter(Boolean);
const processed = new Set(JSON.parse(await readFile(statePath, "utf8").catch(() => "[]")));
let stored = 0;
let pending = 0;

async function verifyStoredMemory(response, event) {
  if (!response?.ok) return false;
  const receipt = await response.json().catch(() => null);
  const memoryId = receipt?.memory_id || receipt?.id || receipt?.response?.memory_id;
  if (!memoryId) return false;
  const readBack = await fetchWithTimeout(`${apiBase}/memory/${encodeURIComponent(memoryId)}`, {
    headers: { authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!readBack?.ok) return false;
  const payload = await readBack.json().catch(() => null);
  const memory = payload?.memory || payload;
  const readBackId = memory?.id || memory?.memory_id;
  return readBackId === memoryId
    && memory?.metadata?.event_id === event.event_id
    && memory?.content === event.content;
}

for (const line of lines) {
  const event = JSON.parse(line);
  if (processed.has(event.event_id) || !event.accept || !event.semantic) continue;
  pending += 1;
  if (!token) continue;
  const response = await fetchWithTimeout(
    `${apiBase}/memory`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({
        content: event.content,
        tags: ["codex-hook", "auto-retain", "memory-gate"],
        importance: 0.7,
        metadata: { event_id: event.event_id, source: "codex-hook" },
      }),
    },
  );
  if (!(await verifyStoredMemory(response, event))) continue;
  pending -= 1;
  processed.add(event.event_id); stored += 1;
}
await mkdir(dirname(statePath), { recursive: true });
await writeFile(statePath, `${JSON.stringify([...processed].slice(-1000), null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ stored, pending }));
