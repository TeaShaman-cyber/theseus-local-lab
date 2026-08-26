#!/usr/bin/env node
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outbox = resolve(root, "outputs/memory_outbox/events.jsonl");
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const event = JSON.parse(raw || "{}");
if (!event.accept || !event.event_id) process.exit(0);
await mkdir(dirname(outbox), { recursive: true });
await appendFile(outbox, `${JSON.stringify({ ...event, queued_at: new Date().toISOString() })}\n`, "utf8");
process.stdout.write(JSON.stringify({ queued: true, event_id: event.event_id }));
