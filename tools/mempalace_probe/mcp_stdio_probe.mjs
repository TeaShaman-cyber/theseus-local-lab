#!/usr/bin/env node

import { spawn } from "node:child_process";

const timeoutMs = 15_000;
const nativeDocker = process.argv.includes("--native-docker");
const child = spawn(
  nativeDocker ? "docker.exe" : "wsl.exe",
  nativeDocker
    ? [
      "run",
      "-i",
      "--rm",
      "-v",
      "theseus-mempalace-clean:/data",
      "theseus-mempalace:pilot",
    ]
    : [
      "-d",
      "Ubuntu-24.04",
      "--",
    "docker",
    "run",
    "-i",
    "--rm",
    "-v",
    "theseus-mempalace-clean:/data",
    "theseus-mempalace:pilot",
    ],
  { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
);

let stdout = "";
let stderr = "";
let settled = false;
let initialized = false;

const finish = (result) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  child.stdin.end();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.ok ? 0 : 1);
};

const timer = setTimeout(() => {
  child.kill();
  finish({ ok: false, stage: "initialize", error: "timeout", timeout_ms: timeoutMs, stderr: stderr.slice(0, 1000) });
}, timeoutMs);

child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      if (message.id === 1 && message.result?.serverInfo) {
        initialized = true;
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
      }
      if (initialized && message.id === 2 && Array.isArray(message.result?.tools)) {
        finish({
          ok: true,
          stage: "tools/list",
          server: { name: "mempalace", version: "3.5.0" },
          tool_count: message.result.tools.length,
          tool_names: message.result.tools.map((tool) => tool.name).slice(0, 40),
        });
      }
    } catch {
      // MCP diagnostics only care about valid JSON-RPC replies.
    }
  }
});
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
child.on("error", (error) => finish({ ok: false, stage: "spawn", error: error.message }));
child.on("close", (code) => {
  if (!settled) finish({ ok: false, stage: "exit", exit_code: code, stdout: stdout.slice(0, 1000), stderr: stderr.slice(0, 1000) });
});

child.stdin.write(`${JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "theseus-mempalace-probe", version: "1.0" },
  },
})}\n`);
