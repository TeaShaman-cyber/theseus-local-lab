#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const composeFile = "tools/sonar_local/compose.yml";
const command = process.argv[2] || "status";
const forwarded = process.argv.slice(3);
const commands = new Set(["build", "status", "refresh", "preflight", "mcp", "mcp-smoke", "http"]);

if (!commands.has(command)) {
  console.error(`Unsupported Sonar Docker command: ${command}`);
  process.exit(2);
}

const childArgs = ["compose", "-f", composeFile];
if (command === "build") {
  childArgs.push("build", "sonar");
} else if (command === "http") {
  childArgs.push("up", "--no-deps", "sonar-http");
} else {
  childArgs.push("run", "--rm", "-T", "sonar");
  if (command === "mcp") {
    childArgs.push("python", "sonar_mcp.py");
  } else if (command === "mcp-smoke") {
    childArgs.push("python", "mcp_smoke.py");
  } else {
    childArgs.push("python", "sonar_local.py", command, ...forwarded);
  }
}

const child = spawn("docker", childArgs, {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Sonar Docker route failed: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
