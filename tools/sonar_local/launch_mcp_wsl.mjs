#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const distro = process.env.THESEUS_WSL_DISTRO || "Ubuntu-24.04";
const python = process.env.THESEUS_SONAR_PYTHON || "/home/poklad/.cache/theseus-sonar/venv/bin/python";

function toWslPath(value) {
  const normalized = path.resolve(value).replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  return match ? `/mnt/${match[1].toLowerCase()}/${match[2]}` : normalized;
}

const server = `${toWslPath(repoRoot)}/tools/sonar_local/sonar_mcp.py`;
const command = process.platform === "win32" ? "wsl.exe" : python;
const args = process.platform === "win32"
  ? ["-d", distro, "--", python, server]
  : [server];

const child = spawn(command, args, {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(`theseus-sonar MCP launch failed: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
