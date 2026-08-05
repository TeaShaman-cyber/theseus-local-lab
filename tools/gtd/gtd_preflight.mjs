#!/usr/bin/env node

import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import process from "node:process";

const workspaceRoot = process.cwd();
const gtdRoot = `${workspaceRoot}/gtd`;
const runtime = process.argv.includes("--runtime")
  ? process.argv[process.argv.indexOf("--runtime") + 1]
  : "windows";
const distro = process.env.THESEUS_WSL_DISTRO || "Ubuntu-24.04";

function run(command, args) {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ ok: false, timeout: true, error: "process timeout" });
    }, 5000);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const checks = {
  workspace_root: workspaceRoot,
  gtd_root: {
    path: gtdRoot,
    exists: await pathExists(gtdRoot),
  },
  runtime,
};

if (runtime === "wsl-native") {
  checks.wsl_native = {
    platform: process.platform,
    distro: process.env.WSL_DISTRO_NAME || "unknown",
    cargo: await run("cargo", ["--version"]),
    rustc: await run("rustc", ["--version"]),
  };
} else if (runtime === "wsl") {
  checks.wsl = {
    distro,
    visibility: {
      status: "deferred",
      reason: "Run visibility and toolchain checks inside a WSL-native VS Code task.",
    },
    toolchain: {
      status: "deferred",
      reason: "Probe cargo/rustc from a WSL-native VS Code task, not a Windows subprocess.",
    },
  };
} else {
  checks.windows = {
    cargo: await run("cargo", ["--version"]),
    rustc: await run("rustc", ["--version"]),
  };
}

const gtdReady = checks.gtd_root.exists;
const toolchainReady = runtime === "wsl-native"
  ? checks.wsl_native.cargo.ok && checks.wsl_native.rustc.ok
  : runtime === "wsl"
    ? false
    : checks.windows.cargo.ok && checks.windows.rustc.ok;
const ready = gtdReady && toolchainReady;

const result = {
  schema: "theseus.gtd.preflight.v1",
  status: ready ? "ready" : "blocked",
  read_only: true,
  checks,
  next_step: ready
    ? "Run the isolated gtd-mcp build or MCP initialize task."
    : "Install or expose the Rust toolchain in the selected runtime, then rerun this task.",
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
// Read-only preflight reports its state in JSON; an absent toolchain is an
// expected, actionable state rather than a transport failure in VS Code.
process.exitCode = 0;
