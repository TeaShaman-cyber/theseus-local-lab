#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const composeFile = "gtd/compose.crates.yml";
const timeoutMs = 30_000;
const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "theseus-gtd-smoke", version: "0.1.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
];

const child = spawn("docker", [
  "compose", "-f", composeFile, "run", "--rm", "-T", "gtd",
], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
let settled = false;

const finish = (result, exitCode = 0) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  process.stdout.write(JSON.stringify({
    schema: "theseus.gtd.mcp-smoke.v1",
    read_only: true,
    ...result,
  }, null, 2) + "\n");
  process.exit(exitCode);
};

const timer = setTimeout(() => {
  child.kill();
  finish({ status: "timeout", timeout_ms: timeoutMs }, 1);
}, timeoutMs);

child.stdout.on("data", (chunk) => { stdout += chunk; });
child.stderr.on("data", (chunk) => { stderr += chunk; });
child.on("error", (error) => finish({ status: "unavailable", error: error.message }, 1));
child.on("close", (code) => {
  const responses = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  const initialize = responses.find((item) => item.id === 1);
  const toolsList = responses.find((item) => item.id === 2);
  const tools = toolsList?.result?.tools?.map((tool) => tool.name) ?? [];
  const ready = code === 0
    && initialize?.result?.protocolVersion
    && tools.length > 0;
  finish({
    status: ready ? "ready" : "blocked",
    exit_code: code,
    protocol_version: initialize?.result?.protocolVersion ?? null,
    server: initialize?.result?.serverInfo ?? null,
    tools,
    stderr: stderr.trim().slice(-2000),
  }, ready ? 0 : 1);
});

child.stdin.end(requests.map((request) => JSON.stringify(request)).join("\n") + "\n");
