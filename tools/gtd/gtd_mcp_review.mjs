#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const composeFile = "gtd/compose.crates.yml";
const status = process.argv[2] || "inbox";
const allowedStatuses = new Set([
  "inbox", "next_action", "waiting_for", "later", "calendar",
  "someday", "done", "reference", "trash", "project", "context",
]);

if (!allowedStatuses.has(status)) {
  process.stderr.write(`Unsupported GTD status: ${status}\n`);
  process.exit(2);
}

const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "theseus-gtd-review", version: "0.1.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "list", arguments: { status } },
  },
];

const child = spawn("docker", [
  "compose", "-f", composeFile, "run", "--rm", "-T", "gtd",
], { cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });

let stdout = "";
let stderr = "";
const timer = setTimeout(() => {
  child.kill();
  process.stderr.write("GTD review timed out\n");
  process.exit(1);
}, 30_000);

child.stdout.on("data", (chunk) => { stdout += chunk; });
child.stderr.on("data", (chunk) => { stderr += chunk; });
child.on("error", (error) => {
  clearTimeout(timer);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
child.on("close", (code) => {
  clearTimeout(timer);
  const response = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    })
    .find((item) => item.id === 2);
  const text = response?.result?.content?.find((item) => item.type === "text")?.text;
  if (code !== 0 || !text) {
    process.stderr.write(stderr.trim() || "GTD review failed\n");
    process.exit(1);
  }
  process.stdout.write(`GTD review: ${status}\n\n${text}`);
  if (!text.endsWith("\n")) process.stdout.write("\n");
});

child.stdin.end(requests.map((request) => JSON.stringify(request)).join("\n") + "\n");
