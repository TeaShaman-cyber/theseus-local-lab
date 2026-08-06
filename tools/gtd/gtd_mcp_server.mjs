#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

// Transparent stdio bridge for Codex MCP. Diagnostics belong in separate
// wrappers; this process must preserve MCP JSON-RPC stdin/stdout exactly.
const child = spawn("docker", [
  "compose", "-f", "gtd/compose.crates.yml", "run", "--rm", "-T", "--no-deps", "gtd",
], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: "inherit",
});

child.on("error", (error) => {
  process.stderr.write(`gtd MCP transport unavailable: ${error.message}\n`);
  process.exit(1);
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
