#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "theseus-memory-smoke-"));
const transcript = join(dir, "rollout.jsonl");
await writeFile(transcript, `${JSON.stringify({ payload: { role: "assistant", content: "Decision: runtime memory smoke verifies transcript gate to AutoMem and MemPalace." } })}\n`);
const input = JSON.stringify({ session_id: `memory-smoke-${Date.now()}`, transcript_path: transcript });
const child = spawn(process.execPath, ["hooks/hook-router.mjs", "--event", "Stop"], { cwd: root, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
let output = ""; child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => process.stderr.write(chunk)); child.stdin.end(input);
const code = await new Promise((resolve) => child.on("close", resolve));
await rm(dir, { recursive: true, force: true });
if (code !== 0) process.exit(code);
process.stdout.write(output);
