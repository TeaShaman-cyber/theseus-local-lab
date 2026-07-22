#!/usr/bin/env node

import { spawn } from "node:child_process";

function parseArgs(argv) {
  const separator = argv.indexOf("--");
  if (separator < 0 || !argv[separator + 1]) {
    throw new Error("Usage: mcp_stdio_probe.mjs [--timeout-ms N] -- <command> [args...]");
  }

  let timeoutMs = 15_000;
  for (let index = 0; index < separator; index += 1) {
    if (argv[index] === "--timeout-ms") {
      timeoutMs = Number(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argv[index]}`);
    }
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 100) {
    throw new Error("--timeout-ms must be at least 100");
  }

  return {
    timeoutMs,
    command: argv[separator + 1],
    commandArgs: argv.slice(separator + 2),
  };
}

const args = parseArgs(process.argv.slice(2));
const child = spawn(args.command, args.commandArgs, {
  env: process.env,
  shell: false,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let buffer = "";
let stderr = "";
let settled = false;
let initialized = false;

function finish(result) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  child.stdin.end();
  child.kill();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

const timer = setTimeout(() => {
  finish({
    ok: false,
    stage: initialized ? "tools/list" : "initialize",
    error: "timeout",
    timeout_ms: args.timeoutMs,
    stderr_tail: stderr.slice(-1000),
  });
}, args.timeoutMs);

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }

    if (message.id === 1 && message.result?.serverInfo) {
      initialized = true;
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
    }

    if (message.id === 2 && Array.isArray(message.result?.tools)) {
      finish({
        ok: true,
        stage: "tools/list",
        server: message.result.serverInfo || null,
        tool_count: message.result.tools.length,
        tool_names: message.result.tools.map((tool) => tool.name),
      });
    }
  }
});

child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});
child.on("error", (error) => finish({ ok: false, stage: "spawn", error: error.message }));
child.on("close", (code, signal) => {
  if (!settled) {
    finish({
      ok: false,
      stage: initialized ? "tools/list" : "initialize",
      error: "process exited before probe completed",
      exit_code: code,
      signal,
      stderr_tail: stderr.slice(-1000),
    });
  }
});

child.stdin.write(`${JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "theseus-mcp-probe", version: "1.0.0" },
  },
})}\n`);
