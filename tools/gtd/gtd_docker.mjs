#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const operation = process.argv[2] || "preflight";
const workspaceRoot = process.cwd();
const composeFile = "gtd/compose.yml";
const cratesComposeFile = "gtd/compose.crates.yml";

const commands = {
  preflight: ["docker", ["version", "--format", "{{.Server.Version}}"]],
  config: ["docker", ["compose", "-f", composeFile, "config"]],
  build: ["docker", ["compose", "-f", composeFile, "build"]],
  "diagnostic-build": ["docker", ["compose", "-f", composeFile, "build"]],
  "crates-build": ["docker", ["compose", "-f", cratesComposeFile, "build"]],
};

if (!commands[operation]) {
  process.stdout.write(JSON.stringify({
    schema: "theseus.gtd.docker.v1",
    status: "invalid_operation",
    operation,
    allowed: Object.keys(commands),
    read_only: operation !== "build",
  }, null, 2) + "\n");
  process.exit(0);
}

const [command, args] = commands[operation];
const timeoutMs = ["build", "diagnostic-build", "crates-build"].includes(operation)
  ? 15 * 60 * 1000
  : 15_000;
const diagnosticBuild = ["diagnostic-build", "crates-build"].includes(operation);
let stdout = "";
let stderr = "";
let settled = false;

const child = spawn(command, args, {
  cwd: workspaceRoot,
  windowsHide: true,
  stdio: diagnosticBuild ? "inherit" : ["ignore", "pipe", "pipe"],
  env: diagnosticBuild
    ? { ...process.env, BUILDKIT_PROGRESS: "plain" }
    : process.env,
});

const timer = setTimeout(() => {
  if (settled) return;
  settled = true;
  child.kill();
  process.stdout.write(JSON.stringify({
    schema: "theseus.gtd.docker.v1",
    operation,
    status: "timeout",
    read_only: operation !== "build",
    timeout_ms: timeoutMs,
  }, null, 2) + "\n");
  process.exit(0);
}, timeoutMs);

if (!diagnosticBuild) {
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
}
child.on("error", (error) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  process.stdout.write(JSON.stringify({
    schema: "theseus.gtd.docker.v1",
    operation,
    status: "unavailable",
    read_only: operation !== "build",
    error: error.message,
  }, null, 2) + "\n");
});
child.on("close", (code) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  process.stdout.write(JSON.stringify({
    schema: "theseus.gtd.docker.v1",
    operation,
    status: code === 0 ? "ready" : "blocked",
    read_only: operation !== "build",
    exit_code: code,
    stdout: stdout.trim().slice(-4000),
    stderr: stderr.trim().slice(-4000),
  }, null, 2) + "\n");
});
