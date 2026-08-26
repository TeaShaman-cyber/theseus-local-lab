#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const queue = resolve(root, "outputs/memory_outbox/events.jsonl");
const statePath = resolve(root, "outputs/memory_outbox/mempalace-processed.json");
const endpoint = process.env.MEMPALACE_MCP_URL || "http://127.0.0.1:18765/mcp";
const lines = (await readFile(queue, "utf8").catch(() => "")).split(/\r?\n/).filter(Boolean);
const processed = new Set(JSON.parse(await readFile(statePath, "utf8").catch(() => "[]")));
const events = lines.map((line) => JSON.parse(line)).filter((event) => event.accept && event.episodic && !processed.has(event.event_id));
if (!events.length) process.exit(0);
const items = events.map((event) => ({ wing: "theseus-local-lab", room: "hooks", content: event.content }));
const args = JSON.stringify({ items, diary: { agent_name: "lad", topic: "memory-autoretain", entry: `SESSION:${new Date().toISOString().slice(0,10)}|Codex.memory-gate+episodic.flush|EVENTS:${events.length}|★★★`, wing: "theseus-local-lab" } });
const child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npx.cmd --yes mcporter@0.13.7 call ${endpoint}.mempalace_checkpoint --args - --output json`], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
let stdout = ""; child.stdout.on("data", (chunk) => { stdout += chunk; });
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
child.stdin.end(args);
const code = await new Promise((resolveCode) => child.on("close", resolveCode));
if (code !== 0) process.exit(0);
await mkdir(dirname(statePath), { recursive: true });
await writeFile(statePath, `${JSON.stringify([...processed, ...events.map((event) => event.event_id)].slice(-1000), null, 2)}\n`, "utf8");
process.stdout.write(stdout);
